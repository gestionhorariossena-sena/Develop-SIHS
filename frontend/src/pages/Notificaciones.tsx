import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPatch, ApiError } from '../services/api'
import type { Notificacion } from '../types/api'

type FiltroTipo = 'all' | 'cambios' | 'recordatorios' | 'sistema'
type Grupo = 'Hoy' | 'Esta semana' | 'Anteriores'

// Los únicos tres valores de "tipo" que describe el ticket. El backend no
// los restringe con un enum (String(30) libre) -- cualquier valor que no
// coincida con los dos primeros cae en "Sistema & Coordinación" como
// categoría general, para no ocultar notificaciones de un tipo futuro que
// todavía no exista hoy.
const TIPO_CAMBIOS = 'Cambios de Aula & Horario'
const TIPO_RECORDATORIOS = 'Recordatorios de Tareas'
const TIPO_SISTEMA = 'Sistema & Coordinación'

const PILLS: { id: FiltroTipo; etiqueta: string }[] = [
  { id: 'all', etiqueta: 'Todas' },
  { id: 'cambios', etiqueta: TIPO_CAMBIOS },
  { id: 'recordatorios', etiqueta: TIPO_RECORDATORIOS },
  { id: 'sistema', etiqueta: TIPO_SISTEMA },
]

function categoriaDe(tipo: string): Exclude<FiltroTipo, 'all'> {
  if (tipo === TIPO_CAMBIOS) return 'cambios'
  if (tipo === TIPO_RECORDATORIOS) return 'recordatorios'
  return 'sistema'
}

const CLASE_BADGE: Record<Exclude<FiltroTipo, 'all'>, string> = {
  cambios: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  recordatorios: 'bg-sena-50 text-sena-700 dark:bg-sena-950/50 dark:text-sena-300',
  sistema: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

function inicioDelDia(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

function grupoDe(fechaIso: string): Grupo {
  const fecha = new Date(fechaIso)
  const hoy = inicioDelDia(new Date())
  if (fecha >= hoy) return 'Hoy'

  const haceSieteDias = new Date(hoy)
  haceSieteDias.setDate(hoy.getDate() - 7)
  if (fecha >= haceSieteDias) return 'Esta semana'

  return 'Anteriores'
}

function tiempoRelativo(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'Hace un momento'
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  return `Hace ${Math.round(horas / 24)} d`
}

/** Insignia reutilizable para marcar contenido de vitrina (sin backend
 * real todavía) -- mismo criterio que Avisos.tsx. */
function InsigniaVitrina() {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      Vitrina · sin datos reales aún
    </span>
  )
}

export function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroTipo>('all')
  const [procesandoTodas, setProcesandoTodas] = useState(false)

  useEffect(() => {
    apiGet<Notificacion[]>('/notificaciones/')
      .then(setNotificaciones)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus notificaciones.'))
      .finally(() => setCargando(false))
  }, [])

  const noLeidas = notificaciones.filter((n) => !n.leida).length
  const cambiosEstaSemana = notificaciones.filter(
    (n) => categoriaDe(n.tipo) === 'cambios' && grupoDe(n.fechaCreacion) !== 'Anteriores',
  ).length
  const recordatorios = notificaciones.filter((n) => categoriaDe(n.tipo) === 'recordatorios').length

  const filtradas = notificaciones.filter((n) => filtro === 'all' || categoriaDe(n.tipo) === filtro)

  const grupos = useMemo(() => {
    const acumulado: Record<Grupo, Notificacion[]> = { Hoy: [], 'Esta semana': [], Anteriores: [] }
    for (const notificacion of filtradas) {
      acumulado[grupoDe(notificacion.fechaCreacion)].push(notificacion)
    }
    return acumulado
  }, [filtradas])

  async function marcarLeida(idNotificacion: number) {
    try {
      const actualizada = await apiPatch<Notificacion>(`/notificaciones/${idNotificacion}/leida`)
      setNotificaciones((prev) => prev.map((n) => (n.idNotificacion === idNotificacion ? actualizada : n)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo marcar la notificación como leída.')
    }
  }

  async function marcarTodasLeidas() {
    setProcesandoTodas(true)
    try {
      await apiPatch('/notificaciones/marcar-todas-leidas')
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron marcar todas como leídas.')
    } finally {
      setProcesandoTodas(false)
    }
  }

  return (
    <AppShell activo="Notificaciones">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Centro de Notificaciones</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {noLeidas === 0
              ? 'Sin notificaciones pendientes.'
              : `${noLeidas} ${noLeidas === 1 ? 'notificación no leída' : 'notificaciones no leídas'}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void marcarTodasLeidas()}
          disabled={procesandoTodas || noLeidas === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {procesandoTodas ? 'Marcando…' : 'Marcar todas como leídas'}
        </button>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pendientes por revisar</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{noLeidas}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cambios de horario esta semana</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{cambiosEstaSemana}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recordatorios de tareas</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{recordatorios}</p>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
        {PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setFiltro(pill.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filtro === pill.id
                ? 'bg-sena-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {pill.etiqueta}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando notificaciones...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
            {(['Hoy', 'Esta semana', 'Anteriores'] as Grupo[]).map((grupo) =>
              grupos[grupo].length === 0 ? null : (
                <div key={grupo} className="flex flex-col gap-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{grupo}</h2>
                  {grupos[grupo].map((notificacion) => {
                    const categoria = categoriaDe(notificacion.tipo)
                    const esDeHorario = notificacion.entidadRelacionada === 'horarios' && notificacion.idEntidadRelacionada

                    return (
                      <article
                        key={notificacion.idNotificacion}
                        className={`rounded-xl border p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${
                          notificacion.leida ? 'border-slate-200 bg-white/70 dark:bg-slate-800/70' : 'border-sena-200 bg-white'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CLASE_BADGE[categoria]}`}>
                            {notificacion.tipo}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{tiempoRelativo(notificacion.fechaCreacion)}</span>
                          {!notificacion.leida && <span className="h-1.5 w-1.5 rounded-full bg-sena-600" aria-hidden="true" />}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{notificacion.mensaje}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled
                            title={
                              esDeHorario
                                ? 'Aún no implementado: la pantalla de Mi Horario del Aprendiz es otro ticket de este Epic.'
                                : 'Esta notificación no está relacionada a un horario.'
                            }
                            className="cursor-not-allowed rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400"
                          >
                            Ver en mi horario
                          </button>
                          {!notificacion.leida && (
                            <button
                              type="button"
                              onClick={() => void marcarLeida(notificacion.idNotificacion)}
                              className="rounded-lg bg-sena-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sena-700"
                            >
                              Marcar como leída
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ),
            )}

            {filtradas.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                No hay notificaciones que coincidan con este filtro.
              </p>
            )}
          </div>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Canales de Entrega</p>
                <InsigniaVitrina />
              </div>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                No hay backend de preferencias de canal por usuario todavía (push en navegador / correo institucional).
                Si se decide implementar, sería un campo nuevo en usuarios o una tabla de preferencias -- fuera de
                alcance de este ticket.
              </p>
              <div className="flex flex-col gap-2 opacity-60">
                <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                  Alertas en pantalla
                  <input type="checkbox" checked disabled className="h-4 w-4 cursor-not-allowed" />
                </label>
                <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                  Correo institucional
                  <input type="checkbox" checked disabled className="h-4 w-4 cursor-not-allowed" />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Anticipación de Alerta</p>
                <InsigniaVitrina />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                "Recordar 30 min antes" se resuelve cuando exista el ticket de anotaciones de horario (mismo Epic) --
                no forma parte de este ticket.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Instructores de la Ficha</p>
                <InsigniaVitrina />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Se revisó si había un endpoint accesible para Aprendiz que listara los instructores de su ficha (
                GET /fichas/{'{id}'}/vocero solo trae vocero/subvocero; GET /horarios/ exige rol Coordinador o
                Administrador). No hay dato real accesible hoy, así que queda como vitrina hasta que exista un
                endpoint de solo lectura para Aprendiz.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">¿Inconsistencia en horario?</p>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Si notas un choque entre ambientes asignados o una ausencia no reportada, radica el caso en la Mesa
                de Ayuda institucional.
              </p>
              <a
                href="https://mesadeayuda.sena.edu.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700"
              >
                Crear Radicado en Mesa de Ayuda
              </a>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  )
}
