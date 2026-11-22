import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { AuditoriaCrucesResponse, HorarioGuardado } from '../types/api'

type NivelTarea = 'critica' | 'revision' | 'lista'

interface TareaBorrador {
  guardado: HorarioGuardado
  nivel: NivelTarea
  texto: string
}

const NAVEGACION = [
  { etiqueta: 'Crear horario', ruta: '/horarios/crear', icono: 'add_circle' },
  { etiqueta: 'Gestionar horarios', ruta: '/horarios/completos', icono: 'calendar_month' },
  { etiqueta: 'Historial y borradores', ruta: '/horarios/historial', icono: 'inventory_2' },
  { etiqueta: 'Conflictos de horarios', ruta: '/horarios/auditoria', icono: 'verified_user' },
]

const PASOS = [
  ['Preparar', 'Método y ficha'],
  ['Editar', 'Bloques semanales'],
  ['Validar', 'Cruces y carga'],
  ['Vista previa', 'Revisión final'],
  ['Publicar', 'Ahora o programada'],
] as const

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function datosTarea(guardado: HorarioGuardado, idsConConflicto: Set<number>): Omit<TareaBorrador, 'guardado'> {
  const tieneConflicto = (guardado.idsHorarios ?? []).some((id) => idsConConflicto.has(id))
  if (tieneConflicto) return { nivel: 'critica', texto: 'Tiene conflictos por resolver' }

  const asignaciones = guardado.asignaciones ?? []
  const estaPublicado = asignaciones.length > 0 && asignaciones.every((horario) => horario.publicado)
  if (estaPublicado) return { nivel: 'lista', texto: 'Publicado' }

  return { nivel: 'revision', texto: 'Pendiente de revisión' }
}

function clasesNivel(nivel: NivelTarea) {
  if (nivel === 'critica') return 'border-error/30 bg-error-container text-error'
  if (nivel === 'lista') return 'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
  return 'border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
}

/**
 * Primera fase de la entrada unificada de programación. No reemplaza los
 * constructores: los botones llevan a los flujos manual e IA existentes.
 * Solo consume los datos ya disponibles para mostrar borradores y auditoría.
 */
export function CrearHorario() {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  const [borradores, setBorradores] = useState<HorarioGuardado[]>([])
  const [conflictos, setConflictos] = useState<AuditoriaCrucesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([
      apiGet<HorarioGuardado[]>('/horarios-guardados/'),
      apiGet<AuditoriaCrucesResponse>('/horarios/auditoria-cruces'),
    ])
      .then(([guardados, auditoria]) => {
        setBorradores(guardados)
        setConflictos(auditoria)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen de programación.')
      })
      .finally(() => setCargando(false))
  }, [])

  const tareas = useMemo(() => {
    const idsConConflicto = new Set(conflictos?.conflictos.map((conflicto) => conflicto.idHorario) ?? [])
    const prioridad: Record<NivelTarea, number> = { critica: 0, revision: 1, lista: 2 }

    return borradores
      .map((guardado) => ({ guardado, ...datosTarea(guardado, idsConConflicto) }))
      .sort((a, b) => prioridad[a.nivel] - prioridad[b.nivel] || b.guardado.fechaCreacion.localeCompare(a.guardado.fechaCreacion))
  }, [borradores, conflictos])

  const ultimoBorrador = tareas.find((tarea) => tarea.nivel !== 'lista') ?? tareas[0]
  const conflictosActivos = conflictos?.resumen.totalCruces ?? 0

  return (
    <AppShell activo="Crear horario">
      <div className="bg-surface">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-outline-variant pb-3 dark:border-slate-700">
            <div className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant dark:text-slate-400">
              <button
                type="button"
                aria-label="Abrir navegación de programación"
                aria-expanded={menuMovilAbierto}
                onClick={() => setMenuMovilAbierto((abierto) => !abierto)}
                className="rounded-lg p-2 text-on-surface hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary lg:hidden dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined" aria-hidden="true">menu</span>
              </button>
              <span className="material-symbols-outlined text-primary" aria-hidden="true">calendar_add_on</span>
              <span className="truncate">Programación</span>
              <span aria-hidden="true">/</span>
              <strong className="truncate text-on-surface dark:text-slate-100">Crear horario</strong>
            </div>
            <span className="hidden rounded-full border border-primary/25 bg-primary-container px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">
              Coordinación académica
            </span>
          </div>

          <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
            <aside
              aria-label="Navegación de programación"
              className={`${menuMovilAbierto ? 'block' : 'hidden'} mb-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm lg:mb-0 lg:block lg:self-start dark:border-slate-700 dark:bg-slate-800`}
            >
              <p className="px-3 pb-2 pt-1 text-xs font-medium text-on-surface-variant dark:text-slate-400">Programación</p>
              <nav className="space-y-1">
                {NAVEGACION.map((item) => {
                  const activo = item.ruta === '/horarios/crear'
                  return (
                    <Link
                      key={item.ruta}
                      to={item.ruta}
                      onClick={() => setMenuMovilAbierto(false)}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary ${
                        activo
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icono}</span>
                      {item.etiqueta}
                    </Link>
                  )
                })}
              </nav>
            </aside>

            <div className="min-w-0 pb-8">
              <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-on-surface dark:text-slate-100">Crear horario</h1>
                  <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">Prepara, revisa y publica la programación académica.</p>
                </div>
                {!cargando && <span className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{tareas.length} horario{tareas.length === 1 ? '' : 's'} guardado{tareas.length === 1 ? '' : 's'}</span>}
              </header>

              {error && <p role="alert" className="mb-5 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-error">{error}</p>}

              {ultimoBorrador && (
                <section aria-labelledby="continuar-borrador" className="mb-6 rounded-xl border border-primary/30 border-l-4 border-l-primary bg-surface-container-lowest p-4 shadow-sm dark:border-slate-700 dark:border-l-primary dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="material-symbols-outlined rounded-lg bg-primary-container p-2 text-primary" aria-hidden="true">edit_note</span>
                      <div>
                        <p id="continuar-borrador" className="text-xs font-bold uppercase tracking-wide text-primary">Continuar último borrador</p>
                        <h2 className="mt-1 font-semibold text-on-surface dark:text-slate-100">{ultimoBorrador.guardado.ficha}</h2>
                        <p className="mt-1 text-xs text-on-surface-variant dark:text-slate-400">Último cambio: {formatearFecha(ultimoBorrador.guardado.fechaCreacion)} · {ultimoBorrador.texto}</p>
                      </div>
                    </div>
                    <Link to={`/horarios/nuevo?editar=${ultimoBorrador.guardado.idHorarioGuardado}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-primary">
                      {ultimoBorrador.nivel === 'critica' ? 'Resolver conflicto' : 'Continuar'}
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                    </Link>
                  </div>
                </section>
              )}

              <section aria-label="Flujo de creación" className="mb-7 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
                <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {PASOS.map(([titulo, descripcion], indice) => (
                    <li key={titulo} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${indice === 0 ? 'bg-primary-container text-primary' : 'text-on-surface-variant dark:text-slate-400'}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${indice === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface dark:bg-slate-700 dark:text-slate-200'}`}>{indice + 1}</span>
                      <span><strong className="block text-sm">{titulo}</strong><small className="block text-xs">{descripcion}</small></span>
                    </li>
                  ))}
                </ol>
              </section>

              <section aria-labelledby="metodo-inicio" className="mb-7">
                <h2 id="metodo-inicio" className="mb-3 text-sm font-bold uppercase tracking-wide text-on-surface dark:text-slate-100">Elige el método de inicio</h2>
                <div className="grid gap-5 xl:grid-cols-2">
                  <article className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <span className="material-symbols-outlined mb-5 w-fit rounded-lg bg-primary-container p-2 text-primary" aria-hidden="true">view_week</span>
                    <h3 className="text-xl font-bold text-on-surface dark:text-slate-100">Crear manualmente</h3>
                    <p className="mt-2 text-sm text-on-surface-variant dark:text-slate-400">Selecciona una ficha y organiza los bloques en el editor semanal existente.</p>
                    <ul className="my-5 space-y-2 text-sm text-on-surface-variant dark:text-slate-300"><li>✓ Validación de instructor y ambiente al guardar.</li><li>✓ Adecuado para ajustes y fichas individuales.</li></ul>
                    <Link to="/horarios/nuevo" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-primary"><span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>Crear manualmente</Link>
                  </article>
                  <article className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-5 flex items-center justify-between gap-3"><span className="material-symbols-outlined w-fit rounded-lg bg-primary-container p-2 text-primary" aria-hidden="true">auto_awesome</span><span className="rounded-full border border-primary/25 bg-primary-container px-2.5 py-1 text-xs font-semibold text-primary">Para archivos curriculares</span></div>
                    <h3 className="text-xl font-bold text-on-surface dark:text-slate-100">Importar y procesar con IA</h3>
                    <p className="mt-2 text-sm text-on-surface-variant dark:text-slate-400">Carga el archivo que usa el asistente y revisa su propuesta antes de guardar cualquier bloque.</p>
                    <ul className="my-5 space-y-2 text-sm text-on-surface-variant dark:text-slate-300"><li>✓ Extrae datos y prepara una propuesta revisable.</li><li>✓ Mantiene las validaciones y publicación existentes.</li></ul>
                    <p className="mb-4 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant dark:bg-slate-900 dark:text-slate-400">La IA no publica ni modifica horarios automáticamente.</p>
                    <Link to="/horarios/asistente-ia" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-primary"><span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload_file</span>Importar archivo</Link>
                  </article>
                </div>
              </section>

              <section aria-labelledby="tareas-pendientes" className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-5 py-4 dark:border-slate-700"><div><h2 id="tareas-pendientes" className="font-bold text-on-surface dark:text-slate-100">Borradores y tareas pendientes</h2><p className="text-sm text-on-surface-variant dark:text-slate-400">Ordenados por urgencia de validación.</p></div><Link to="/horarios/historial" className="text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Ver historial</Link></div>
                {cargando ? <p className="px-5 py-8 text-sm text-on-surface-variant dark:text-slate-400">Cargando borradores…</p> : tareas.length === 0 ? <p className="px-5 py-8 text-sm text-on-surface-variant dark:text-slate-400">No hay horarios guardados para revisar.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-5 py-3">Ficha</th><th className="px-5 py-3">Última edición</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-outline-variant dark:divide-slate-700">{tareas.map((tarea) => <tr key={tarea.guardado.idHorarioGuardado}><td className="px-5 py-4"><strong className="block text-on-surface dark:text-slate-100">{tarea.guardado.ficha}</strong><span className="text-xs text-on-surface-variant dark:text-slate-400">{tarea.guardado.programaNombre ?? 'Programa sin registrar'}</span></td><td className="px-5 py-4 text-on-surface-variant dark:text-slate-300">{formatearFecha(tarea.guardado.fechaCreacion)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${clasesNivel(tarea.nivel)}`}>{tarea.texto}</span></td><td className="px-5 py-4 text-right"><Link to={`/horarios/nuevo?editar=${tarea.guardado.idHorarioGuardado}`} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-primary">{tarea.nivel === 'critica' ? 'Resolver conflicto' : 'Continuar'}</Link></td></tr>)}</tbody></table></div>}
              </section>

              <section aria-label="Resumen de auditoría" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-container/40 px-4 py-3 dark:bg-sena-950/30"><div className="flex items-center gap-3"><span className="material-symbols-outlined rounded-lg bg-surface-container-lowest p-2 text-primary dark:bg-slate-800" aria-hidden="true">shield</span><p className="text-sm text-on-surface dark:text-slate-200"><strong>Auditoría preventiva:</strong> {cargando ? 'verificando horarios guardados…' : conflictosActivos === 0 ? 'no hay cruces activos en la auditoría actual.' : `${conflictosActivos} cruce${conflictosActivos === 1 ? '' : 's'} activo${conflictosActivos === 1 ? '' : 's'} requiere${conflictosActivos === 1 ? '' : 'n'} revisión.`}</p></div><Link to="/horarios/auditoria" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Abrir auditoría <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span></Link></section>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
