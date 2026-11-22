import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch, ApiError } from '../../services/api'
import type { Ambiente, AuditoriaConflicto, AuditoriaCrucesResponse, CargaSemanal, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../../types/api'
import { EditarBloqueImportado } from './EditarBloqueImportado'
import { GridAsistente } from '../horario/GridAsistente'
import { celdasDesdeHorarios } from '../horario/celdasAsistente'
import { nombresDias } from '../relacionados/formatoBloque'

interface DrawerHorarioProps {
  horario: Horario
  ficha?: Ficha
  instructor?: Usuario
  ambiente?: Ambiente
  sede?: Sede
  trimestre?: Trimestre
  diasPorId: Record<number, string>
  diasSemana: DiaSemana[]
  jornada: string
  conflictos?: AuditoriaConflicto[] | null
  cargandoConflictos?: boolean
  errorConflictos?: string | null
  onActualizar: (actualizado: Horario) => void
  onCerrar: () => void
}

function periodoLectivo(trimestre?: Trimestre) {
  if (!trimestre) return 'Sin período académico'
  return `${trimestre.nombre} · ${trimestre.fechaInicio} a ${trimestre.fechaFin}`
}

/** Tarjeta central de un bloque: conserva la lista global detrás y mantiene
 * información, relaciones y publicación a la vista. */
export function DrawerHorario({ horario, ficha, instructor, ambiente, sede, trimestre, diasPorId, diasSemana, jornada, conflictos: conflictosCompartidos, cargandoConflictos = false, errorConflictos: errorConflictosCompartidos = null, onActualizar, onCerrar }: DrawerHorarioProps) {
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const dialogoRef = useRef<HTMLElement>(null)
  const [carga, setCarga] = useState<CargaSemanal | null>(null)
  const [estadoCarga, setEstadoCarga] = useState<'cargando' | 'error' | 'listo'>('cargando')
  const [conflictosLocales, setConflictosLocales] = useState<AuditoriaConflicto[] | null>(null)
  const [errorConflictosLocales, setErrorConflictosLocales] = useState(false)
  const [editando, setEditando] = useState(false)
  const [actualizandoPublicacion, setActualizandoPublicacion] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  useEffect(() => {
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cerrarRef.current?.focus()
    return () => focoAnterior?.focus()
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

  function manejarTeclado(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === 'Escape') onCerrar()
    if (evento.key !== 'Tab') return
    const elementos = dialogoRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])')
    if (!elementos?.length) return
    const primero = elementos[0]
    const ultimo = elementos[elementos.length - 1]
    if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus() }
    if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus() }
  }

  const cargaTexto = estadoCarga === 'cargando'
    ? 'Calculando…'
    : estadoCarga === 'error' || !carga
      ? 'No se pudo calcular.'
      : carga.horasMaximas == null
        ? 'Sin tope definido'
        : `${carga.horasAsignadas}h / ${carga.horasMaximas}h`

  async function cambiarPublicacion() {
    setErrorAccion(null)
    setActualizandoPublicacion(true)
    try {
      const actualizado = await apiPatch<Horario>(`/horarios/${horario.idHorario}/estado`, { publicado: !horario.publicado })
      onActualizar(actualizado)
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo actualizar la publicación del bloque.')
    } finally {
      setActualizandoPublicacion(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onClick={onCerrar}>
      <section
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Horario #${horario.idHorario}`}
        onKeyDown={manejarTeclado}
        onClick={(evento) => evento.stopPropagation()}
        className="flex max-h-[min(88vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl dark:border-slate-700"
      >
        <header className="border-b border-outline-variant px-5 py-4 sm:px-7 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Bloque #{horario.idHorario} · Ficha {horario.fichaCodigo ?? 'sin definir'}</p>
              <h2 className="mt-1 text-xl font-semibold text-on-surface dark:text-slate-100">{ficha?.programa.nombrePrograma ?? horario.resultadoDescripcion ?? 'Horario académico'}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button ref={cerrarRef} type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${horario.publicado ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>{horario.publicado ? 'Publicado' : 'Borrador'}</span>
            <span className="rounded-md bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-slate-700 dark:text-slate-300">{jornada}</span>
          </div>
        </header>

        <div className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:p-7 md:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.8fr)]">
          <section aria-label="Información del bloque" className="space-y-4 md:col-start-1 md:row-start-1">
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
            </div>
          </section>

          <section aria-label="Relaciones del bloque" className="space-y-3 md:col-span-2 md:row-start-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Vistas contextuales vinculadas</p>
            <div className="grid gap-3 md:grid-cols-3">
            <Relacion titulo={`Ficha ${horario.fichaCodigo ?? 'sin definir'}`} detalle={ficha ? `${ficha.programa.nombrePrograma} · ${ficha.aprendicesTotales} aprendices` : 'Sin información adicional disponible'} href={`/horarios/completos?perspectiva=ficha&idFicha=${horario.idFicha}&idHorario=${horario.idHorario}`} enlace="Ver horario por ficha" icono="badge" />
            <Relacion titulo={horario.instructorNombre ?? 'Instructor sin definir'} detalle={instructor ? `${instructor.tipoContrato ?? 'Sin contrato'} · ${cargaTexto}` : 'Sin información adicional disponible'} href={`/horarios/completos?perspectiva=instructor&idInstructor=${horario.idInstructor}&idHorario=${horario.idHorario}`} enlace="Ver horario por instructor" icono="person" />
            <Relacion titulo={horario.ambienteNombre ?? 'Ambiente sin definir'} detalle={ambiente ? `${ambiente.numeroAmbiente} · ${sede?.nombreSede ?? 'Sede sin definir'}` : 'Sin información adicional disponible'} href={`/horarios/completos?perspectiva=ambiente&idAmbiente=${horario.idAmbiente}&idHorario=${horario.idHorario}`} enlace="Ver horario por ambiente" icono="meeting_room" />
            </div>
            {errorConflictos ? <p role="status" className="rounded-xl border border-outline-variant p-3 text-sm text-on-surface-variant dark:border-slate-700">No se pudo consultar la validación de cruces.</p> : conflictosPendientes ? <p role="status" className="rounded-xl border border-outline-variant p-3 text-sm text-on-surface-variant dark:border-slate-700">Consultando validación de cruces…</p> : conflictos?.length === 0 ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Validación de cruces superada.</p> : conflictos && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><p className="font-semibold">{conflictos.length} conflicto{conflictos.length === 1 ? '' : 's'} detectado{conflictos.length === 1 ? '' : 's'}</p>{conflictos.map((conflicto, indice) => <p key={`${conflicto.tipo}-${indice}`} className="mt-1">{conflicto.mensaje}</p>)}<Link to="/horarios/auditoria" className="mt-2 inline-block font-semibold underline">Ver en Conflictos →</Link></div>}
          </section>

          <section aria-label="Gestión del bloque" className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-4 md:col-start-2 md:row-start-1 dark:bg-slate-800/60">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Gestión del bloque</p>
              <h3 className="mt-1 text-sm font-semibold text-on-surface">{horario.publicado ? 'Visible para el instructor' : 'Pendiente de publicación'}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{horario.publicado ? 'El instructor puede verlo en su horario.' : 'Aún no es visible en el horario del instructor.'}</p>
            </div>
            {errorAccion && <p role="alert" className="rounded-lg bg-error-container p-3 text-xs text-on-error-container">{errorAccion}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void cambiarPublicacion()} disabled={actualizandoPublicacion} className="min-h-10 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-on-primary-container disabled:opacity-60">
                {actualizandoPublicacion ? 'Actualizando…' : horario.publicado ? 'Retirar de publicación' : 'Publicar bloque'}
              </button>
              <button type="button" onClick={() => { setErrorAccion(null); setEditando((valor) => !valor) }} aria-expanded={editando} className="min-h-10 rounded-md border border-outline px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
                {editando ? 'Cerrar edición' : 'Modificar bloque'}
              </button>
            </div>
            <p className="text-xs leading-5 text-on-surface-variant">Los cambios se validan antes de guardarse.</p>
          </section>

          <section aria-label="Ubicación en la semana" className="md:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-on-surface">Ubicación en la semana</h3>
            <div className="overflow-x-auto rounded-xl border border-outline-variant p-3"><div className="min-w-[760px]"><GridAsistente celdas={celdasDesdeHorarios([horario])} soloFranjasOcupadas /></div></div>
          </section>

          {editando && <section aria-label="Edición del bloque" className="md:col-span-2"><EditarBloqueImportado horario={horario} diasSemana={diasSemana} onCancelar={() => setEditando(false)} onGuardar={(actualizado) => { onActualizar(actualizado); setEditando(false) }} /></section>}

        </div>

        <footer className="flex justify-between gap-3 border-t border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <Link to={`/horarios/historial?idHorario=${horario.idHorario}`} className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-surface-container hover:underline">Ver registro de cambios</Link>
          <button type="button" onClick={onCerrar} className="rounded-md border border-outline px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container">Cerrar detalle</button>
        </footer>
      </section>
    </div>
  )
}

function Relacion({ titulo, detalle, href, enlace, icono }: { titulo: string; detalle: string; href: string; enlace: string; icono: string }) {
  return <div className="rounded-xl bg-surface-container p-3 dark:bg-slate-700/50"><div className="flex gap-3"><span aria-hidden="true" className="material-symbols-outlined text-primary">{icono}</span><div className="min-w-0 flex-1"><p className="font-semibold text-on-surface dark:text-slate-100">{titulo}</p><p className="mt-0.5 text-sm text-on-surface-variant">{detalle}</p><Link to={href} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">{enlace} →</Link></div></div></div>
}
