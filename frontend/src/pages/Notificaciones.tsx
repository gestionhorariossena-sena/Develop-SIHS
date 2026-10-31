import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Link } from 'react-router-dom'
import { apiDelete, apiGet, apiPatch, ApiError } from '../services/api'
import type { Notificacion } from '../types/api'

type FiltroTipo = 'all' | 'cambios' | 'cruces' | 'sistema'
type Grupo = 'Hoy' | 'Esta semana' | 'Anteriores'

// Vocabulario cerrado que emite el backend (TIPOS_VALIDOS en
// backend/app/services/notificacion_service.py). Los textos largos de
// antes ("Cambios de Aula & Horario"...) ya no se generan, pero pueden
// quedar filas viejas en BD: se siguen clasificando para no perderlas.
const TIPOS_CAMBIOS = new Set(['horario', 'ambiente', 'Cambios de Aula & Horario'])
const TIPOS_CRUCES = new Set(['cruce'])

const ETIQUETA_TIPO: Record<string, string> = {
  horario: 'Horario',
  ambiente: 'Ambiente',
  cruce: 'Cruce',
  sistema: 'Sistema',
}

const PILLS: { id: FiltroTipo; etiqueta: string }[] = [
  { id: 'all', etiqueta: 'Todas' },
  { id: 'cambios', etiqueta: 'Cambios de horario y ambiente' },
  { id: 'cruces', etiqueta: 'Cruces' },
  { id: 'sistema', etiqueta: 'Sistema y coordinación' },
]

function categoriaDe(tipo: string): Exclude<FiltroTipo, 'all'> {
  if (TIPOS_CAMBIOS.has(tipo)) return 'cambios'
  if (TIPOS_CRUCES.has(tipo)) return 'cruces'
  return 'sistema'
}

const CLASE_BADGE: Record<Exclude<FiltroTipo, 'all'>, string> = {
  cambios: 'bg-primary-container text-on-primary-container',
  cruces: 'bg-tertiary-container text-on-tertiary-container',
  sistema: 'bg-surface-container text-on-surface-variant',
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
  const avisosSistema = notificaciones.filter((n) => categoriaDe(n.tipo) === 'sistema').length

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

  async function eliminar(idNotificacion: number) {
    try {
      await apiDelete(`/notificaciones/${idNotificacion}`)
      setNotificaciones((prev) => prev.filter((n) => n.idNotificacion !== idNotificacion))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la notificación.')
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

  const sinPendientes = noLeidas === 0 && cambiosEstaSemana === 0 && avisosSistema === 0

  return (
    <AppShell activo="Notificaciones">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface">Centro de Notificaciones</h1>
          <p className="text-sm text-on-surface-variant">
            {noLeidas === 0
              ? 'Sin notificaciones pendientes.'
              : `${noLeidas} ${noLeidas === 1 ? 'notificación no leída' : 'notificaciones no leídas'}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void marcarTodasLeidas()}
          disabled={procesandoTodas || noLeidas === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline bg-surface-container-lowest px-3.5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
        >
          {procesandoTodas ? 'Marcando…' : 'Marcar todas como leídas'}
        </button>
      </div>

      <section className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 ${sinPendientes ? 'opacity-55' : ''}`}>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Pendientes por revisar</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{noLeidas}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Cambios de horario esta semana</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{cambiosEstaSemana}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Avisos de coordinación</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{avisosSistema}</p>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low p-1.5">
        {PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setFiltro(pill.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              filtro === pill.id
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {pill.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="py-12 text-center text-sm text-on-surface-variant">Cargando notificaciones...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
            {(['Hoy', 'Esta semana', 'Anteriores'] as Grupo[]).map((grupo) =>
              grupos[grupo].length === 0 ? null : (
                <div key={grupo} className="flex flex-col gap-3">
                  <h2 className="text-sm font-bold text-on-surface">{grupo}</h2>
                  {grupos[grupo].map((notificacion) => {
                    const categoria = categoriaDe(notificacion.tipo)
                    const esDeHorario =
                      (notificacion.entidadRelacionada === 'horarios' || notificacion.entidadRelacionada === 'fichas') &&
                      Boolean(notificacion.idEntidadRelacionada)

                    return (
                      <article
                        key={notificacion.idNotificacion}
                        className={`rounded-xl border p-4 ${
                          notificacion.leida
                            ? 'border-outline-variant bg-surface-container-lowest/70'
                            : 'border-primary/40 bg-surface-container-lowest'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CLASE_BADGE[categoria]}`}>
                            {ETIQUETA_TIPO[notificacion.tipo] ?? notificacion.tipo}
                          </span>
                          <span className="text-xs text-on-surface-variant">{tiempoRelativo(notificacion.fechaCreacion)}</span>
                          {!notificacion.leida && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
                        </div>
                        <p className="text-sm text-on-surface">{notificacion.mensaje}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {esDeHorario && (
                            <Link
                              to="/mi-horario-aprendiz"
                              className="rounded-lg border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                            >
                              Ver en mi horario
                            </Link>
                          )}
                          {!notificacion.leida && (
                            <button
                              type="button"
                              onClick={() => void marcarLeida(notificacion.idNotificacion)}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-on-primary-container"
                            >
                              Marcar como leída
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void eliminar(notificacion.idNotificacion)}
                            aria-label={`Eliminar notificación: ${notificacion.mensaje}`}
                            className="ml-auto rounded-lg px-2 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ),
            )}

            {filtradas.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-11 text-center">
                <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
                  notifications_off
                </span>
                <p className="text-sm font-semibold text-on-surface">
                  {notificaciones.length === 0 ? 'Sin notificaciones por ahora' : 'No hay notificaciones de este tipo'}
                </p>
                <p className="max-w-xs text-sm text-on-surface-variant">
                  {notificaciones.length === 0
                    ? 'Te avisamos acá apenas haya un cambio de horario, un cruce detectado o un comunicado de Coordinación.'
                    : 'Prueba con otro filtro, arriba, para ver el resto de tus notificaciones.'}
                </p>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
              <p className="mb-2 text-sm font-semibold text-on-surface">¿Inconsistencia en horario?</p>
              <p className="mb-4 text-sm text-on-surface-variant">
                Si notas un choque entre ambientes asignados o una ausencia no reportada, radica el caso en la Mesa
                de Ayuda institucional.
              </p>
              <a
                href="https://mesadeayuda.sena.edu.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container"
              >
                Crear radicado
              </a>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  )
}
