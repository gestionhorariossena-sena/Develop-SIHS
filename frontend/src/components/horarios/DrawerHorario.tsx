import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch, ApiError } from '../../services/api'
import type { Ambiente, AuditoriaConflicto, AuditoriaCrucesResponse, CargaSemanal, Ficha, Horario, Sede, Trimestre, Usuario } from '../../types/api'
import { GridAsistente } from '../horario/GridAsistente'
import { celdasDesdeHorarios } from '../horario/celdasAsistente'
import { nombresDias } from '../relacionados/formatoBloque'

type Pestana = 'informacion' | 'relaciones' | 'publicacion' | 'acciones'

interface DrawerHorarioProps {
  horario: Horario
  ficha?: Ficha
  instructor?: Usuario
  ambiente?: Ambiente
  sede?: Sede
  trimestre?: Trimestre
  diasPorId: Record<number, string>
  jornada: string
  conflictos?: AuditoriaConflicto[] | null
  cargandoConflictos?: boolean
  errorConflictos?: string | null
  onCerrar: () => void
  onActualizar: (horario: Horario) => void
}

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'informacion', etiqueta: 'Información' },
  { id: 'relaciones', etiqueta: 'Relaciones' },
  { id: 'publicacion', etiqueta: 'Publicación' },
  { id: 'acciones', etiqueta: 'Acciones' },
]

function periodoLectivo(trimestre?: Trimestre) {
  if (!trimestre) return 'Sin período académico'
  return `${trimestre.nombre} · ${trimestre.fechaInicio} a ${trimestre.fechaFin}`
}

/** Drawer de un bloque de horario. Conserva la lista global visible debajo y
 * concentra las acciones/contexto de ese bloque, sin crear una nueva ruta. */
export function DrawerHorario({ horario, ficha, instructor, ambiente, sede, trimestre, diasPorId, jornada, conflictos: conflictosCompartidos, cargandoConflictos = false, errorConflictos: errorConflictosCompartidos = null, onCerrar, onActualizar }: DrawerHorarioProps) {
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const [pestana, setPestana] = useState<Pestana>('informacion')
  const [carga, setCarga] = useState<CargaSemanal | null>(null)
  const [estadoCarga, setEstadoCarga] = useState<'cargando' | 'error' | 'listo'>('cargando')
  const [conflictosLocales, setConflictosLocales] = useState<AuditoriaConflicto[] | null>(null)
  const [errorConflictosLocales, setErrorConflictosLocales] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorPublicacion, setErrorPublicacion] = useState<string | null>(null)

  useEffect(() => {
    cerrarRef.current?.focus()
  }, [])

  useEffect(() => {
    let activo = true
    apiGet<CargaSemanal>(`/usuarios/${horario.idInstructor}/carga-semanal`)
      .then((respuesta) => { if (activo) { setCarga(respuesta); setEstadoCarga('listo') } })
      .catch(() => { if (activo) setEstadoCarga('error') })
    return () => { activo = false }
  }, [horario.idInstructor])

  useEffect(() => {
    if (conflictosCompartidos !== undefined) return
    let activo = true
    const filtroTrimestre = horario.idTrimestre ? `?idTrimestre=${horario.idTrimestre}` : ''
    apiGet<AuditoriaCrucesResponse>(`/horarios/auditoria-cruces${filtroTrimestre}`)
      .then((respuesta) => { if (activo) setConflictosLocales(respuesta.conflictos.filter((item) => item.idHorario === horario.idHorario || item.idHorarioExistente === horario.idHorario)) })
      .catch(() => { if (activo) setErrorConflictosLocales(true) })
    return () => { activo = false }
  }, [conflictosCompartidos, horario.idHorario, horario.idTrimestre])

  const conflictos = conflictosCompartidos === undefined
    ? conflictosLocales
    : conflictosCompartidos?.filter((item) => item.idHorario === horario.idHorario || item.idHorarioExistente === horario.idHorario) ?? null
  const errorConflictos = conflictosCompartidos === undefined ? errorConflictosLocales : Boolean(errorConflictosCompartidos)
  const conflictosPendientes = conflictosCompartidos === undefined ? conflictos === null : cargandoConflictos

  async function cambiarPublicacion() {
    setErrorPublicacion(null)
    setGuardando(true)
    try {
      const actualizado = await apiPatch<Horario>(`/horarios/${horario.idHorario}/estado`, { publicado: !horario.publicado })
      onActualizar(actualizado)
    } catch (error) {
      setErrorPublicacion(error instanceof ApiError ? error.message : 'No se pudo cambiar la publicación. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function manejarTeclado(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === 'Escape') onCerrar()
  }

  const cargaTexto = estadoCarga === 'cargando'
    ? 'Calculando…'
    : estadoCarga === 'error' || !carga
      ? 'No se pudo calcular.'
      : carga.horasMaximas == null
        ? 'Sin tope definido'
        : `${carga.horasAsignadas}h / ${carga.horasMaximas}h`

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40" onClick={onCerrar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Horario #${horario.idHorario}`}
        onKeyDown={manejarTeclado}
        onClick={(evento) => evento.stopPropagation()}
        className="fixed right-0 top-0 flex h-screen w-full max-w-[460px] flex-col bg-surface-container-lowest shadow-2xl dark:bg-slate-800"
      >
        <header className="border-b border-outline-variant px-5 pb-4 pt-5 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Bloque #{horario.idHorario} · Ficha {horario.fichaCodigo ?? 'sin definir'}</p>
              <h2 className="mt-2 text-lg font-bold text-on-surface dark:text-slate-100">{ficha?.programa.nombrePrograma ?? horario.resultadoDescripcion ?? 'Horario académico'}</h2>
            </div>
            <div className="flex items-center gap-1">
              <Link to={`/horarios/completos?id=${horario.idHorario}`} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container" aria-label="Abrir completo" title="Abrir completo">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">open_in_full</span>
              </Link>
              <button ref={cerrarRef} type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${horario.publicado ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>{horario.publicado ? 'Publicado' : 'Borrador'}</span>
            <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-slate-700 dark:text-slate-300">{jornada}</span>
            <Link to={`/horarios/completos?id=${horario.idHorario}`} className="text-xs font-semibold text-primary hover:underline">Abrir completo →</Link>
          </div>
        </header>

        <div role="tablist" aria-label="Secciones del horario" className="flex overflow-x-auto border-b border-outline-variant px-3 dark:border-slate-700">
          {PESTANAS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={pestana === item.id} onClick={() => setPestana(item.id)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${pestana === item.id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface dark:text-slate-400'}`}>
              {item.etiqueta}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-24">
          {pestana === 'informacion' && <section aria-label="Información del bloque" className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Parámetros del bloque</p>
            <div className="rounded-xl bg-surface-container p-4 dark:bg-slate-700/50">
              <p className="text-xs font-medium text-on-surface-variant">Competencia</p>
              <p className="mt-1 text-sm font-semibold text-on-surface dark:text-slate-100">{horario.resultadoCodigo ?? 'Sin código'} · {horario.resultadoDescripcion ?? 'Sin descripción disponible'}</p>
              <div className="my-3 border-t border-outline-variant dark:border-slate-600" />
              <p className="text-xs font-medium text-on-surface-variant">Resultado de aprendizaje (RAP)</p>
              <p className="mt-1 text-sm text-on-surface dark:text-slate-100">{horario.resultadoDescripcion ?? 'No informado para este bloque.'}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div><p className="text-xs text-on-surface-variant">Carga semanal</p><p className="mt-1 text-sm font-bold text-primary">{cargaTexto}</p></div>
                <div><p className="text-xs text-on-surface-variant">Período lectivo</p><p className="mt-1 text-sm font-semibold text-on-surface dark:text-slate-100">{periodoLectivo(trimestre)}</p></div>
              </div>
            </div>
            <div className="rounded-xl border border-outline-variant p-3 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Horario semanal</p>
              <p className="mt-1 text-sm text-on-surface dark:text-slate-100">{nombresDias(horario.dias, diasPorId)} · {horario.horaInicio.slice(0, 5)}–{horario.horaFin.slice(0, 5)}</p>
              <div className="mt-3"><GridAsistente celdas={celdasDesdeHorarios([horario])} /></div>
            </div>
          </section>}

          {pestana === 'relaciones' && <section aria-label="Relaciones del bloque" className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Vistas contextuales vinculadas</p>
            <Relacion titulo={`Ficha ${horario.fichaCodigo ?? 'sin definir'}`} detalle={ficha ? `${ficha.programa.nombrePrograma} · ${ficha.aprendicesTotales} aprendices` : 'Sin información adicional disponible'} href={`/horarios/completos?perspectiva=ficha&idFicha=${horario.idFicha}&idHorario=${horario.idHorario}`} enlace="Ver horario por ficha" icono="badge" />
            <Relacion titulo={horario.instructorNombre ?? 'Instructor sin definir'} detalle={instructor ? `${instructor.tipoContrato ?? 'Sin contrato'} · ${cargaTexto}` : 'Sin información adicional disponible'} href={`/horarios/completos?perspectiva=instructor&idInstructor=${horario.idInstructor}&idHorario=${horario.idHorario}`} enlace="Ver horario por instructor" icono="person" />
            <Relacion titulo={horario.ambienteNombre ?? 'Ambiente sin definir'} detalle={ambiente ? `${ambiente.numeroAmbiente} · ${sede?.nombreSede ?? 'Sede sin definir'}` : 'Sin información adicional disponible'} href={`/horarios/completos?perspectiva=ambiente&idAmbiente=${horario.idAmbiente}&idHorario=${horario.idHorario}`} enlace="Ver horario por ambiente" icono="meeting_room" />
            {errorConflictos ? <p role="status" className="rounded-xl border border-outline-variant p-3 text-sm text-on-surface-variant dark:border-slate-700">No se pudo consultar la validación de cruces.</p> : conflictosPendientes ? <p role="status" className="rounded-xl border border-outline-variant p-3 text-sm text-on-surface-variant dark:border-slate-700">Consultando validación de cruces…</p> : conflictos?.length === 0 ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Validación de cruces superada.</p> : conflictos && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><p className="font-semibold">{conflictos.length} conflicto{conflictos.length === 1 ? '' : 's'} detectado{conflictos.length === 1 ? '' : 's'}</p>{conflictos.map((conflicto, indice) => <p key={`${conflicto.tipo}-${indice}`} className="mt-1">{conflicto.mensaje}</p>)}<Link to="/horarios/auditoria" className="mt-2 inline-block font-semibold underline">Ver en Conflictos →</Link></div>}
          </section>}

          {pestana === 'publicacion' && <section aria-label="Publicación del bloque" className="space-y-4">
            <div className="rounded-xl border border-outline-variant p-4 dark:border-slate-700"><p className="text-sm font-semibold text-on-surface dark:text-slate-100">{horario.publicado ? 'Bloque publicado' : 'Bloque en borrador'}</p><p className="mt-1 text-sm text-on-surface-variant">{horario.publicado ? 'El instructor puede verlo en su horario.' : 'Aún no es visible en el horario del instructor.'}</p></div>
            {errorPublicacion && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{errorPublicacion}</p>}
            <button type="button" disabled={guardando} onClick={() => void cambiarPublicacion()} className="w-full rounded-xl border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-container disabled:opacity-60">{guardando ? 'Guardando…' : horario.publicado ? 'Despublicar' : 'Publicar ahora'}</button>
            {!horario.publicado && <Link to={`/horarios/publicaciones-programadas?idHorario=${horario.idHorario}`} className="block rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-on-primary">Programar publicación</Link>}
          </section>}

          {pestana === 'acciones' && <section aria-label="Acciones del bloque" className="space-y-3">
            <Link to={`/horarios/historial?id=${horario.idHorario}`} className="block rounded-xl border border-outline-variant p-4 hover:bg-surface-container dark:border-slate-700"><p className="font-semibold text-on-surface dark:text-slate-100">Editar bloque</p><p className="mt-1 text-sm text-on-surface-variant">Abrir los detalles de creación y modificación disponibles.</p></Link>
            <Link to={`/horarios/publicaciones-programadas?idHorario=${horario.idHorario}`} className="block rounded-xl border border-outline-variant p-4 hover:bg-surface-container dark:border-slate-700"><p className="font-semibold text-on-surface dark:text-slate-100">Gestionar publicación</p><p className="mt-1 text-sm text-on-surface-variant">Programar, revisar o cancelar la publicación de este bloque.</p></Link>
          </section>}
        </div>

        <footer className="absolute bottom-0 left-0 right-0 flex gap-2 border-t border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <Link to={`/horarios/historial?id=${horario.idHorario}`} className="flex-1 rounded-xl border border-outline px-3 py-2 text-center text-sm font-semibold text-on-surface hover:bg-surface-container dark:border-slate-600 dark:text-slate-100">Editar bloque</Link>
          <Link to={`/horarios/publicaciones-programadas?idHorario=${horario.idHorario}`} className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-on-primary">Gestionar publicación</Link>
        </footer>
      </aside>
    </div>
  )
}

function Relacion({ titulo, detalle, href, enlace, icono }: { titulo: string; detalle: string; href: string; enlace: string; icono: string }) {
  return <div className="rounded-xl bg-surface-container p-3 dark:bg-slate-700/50"><div className="flex gap-3"><span aria-hidden="true" className="material-symbols-outlined text-primary">{icono}</span><div className="min-w-0 flex-1"><p className="font-semibold text-on-surface dark:text-slate-100">{titulo}</p><p className="mt-0.5 text-sm text-on-surface-variant">{detalle}</p><Link to={href} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">{enlace} →</Link></div></div></div>
}
