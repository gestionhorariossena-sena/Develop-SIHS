import { useState } from 'react'
import { apiPatch } from '../services/api'
import type { Notificacion } from '../types/api'

type TipoNotificacion = Notificacion['tipo']
type GrupoNotificacion = 'Hoy' | 'Ayer' | 'Esta semana'

const GRUPOS: GrupoNotificacion[] = ['Hoy', 'Ayer', 'Esta semana']

const estiloTipo: Record<TipoNotificacion, string> = {
  cruce:
    'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
  horario:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  ambiente:
    'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  sistema:
    'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
}

function IconoTipo({ tipo }: { tipo: TipoNotificacion }) {
  const claseSvg = 'h-4 w-4'

  switch (tipo) {
    case 'cruce':
      return (
        <svg
          className={claseSvg}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v4m0 3h.01"
          />
        </svg>
      )

    case 'horario':
      return (
        <svg
          className={claseSvg}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
          />
        </svg>
      )

    case 'ambiente':
      return (
        <svg
          className={claseSvg}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 21s7-6.34 7-11.5A7 7 0 0 0 5 9.5C5 14.66 12 21 12 21Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
          />
        </svg>
      )

    case 'sistema':
      return (
        <svg
          className={claseSvg}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
          />
        </svg>
      )
  }
}

interface NotificacionesPanelProps {
  notificaciones: Notificacion[]
  onNotificacionesActualizadas: (
    notificaciones: Notificacion[],
  ) => void
  onCerrar: () => void
}

function obtenerGrupo(fechaCreacion: string): GrupoNotificacion {
  const fecha = new Date(fechaCreacion)
  const ahora = new Date()

  const inicioHoy = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
  )

  const inicioAyer = new Date(inicioHoy)
  inicioAyer.setDate(inicioAyer.getDate() - 1)

  const inicioSemana = new Date(inicioHoy)
  const diaSemana = inicioSemana.getDay()
  const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1
  inicioSemana.setDate(inicioSemana.getDate() - diasDesdeLunes)

  if (fecha >= inicioHoy) {
    return 'Hoy'
  }

  if (fecha >= inicioAyer) {
    return 'Ayer'
  }

  if (fecha >= inicioSemana) {
    return 'Esta semana'
  }

  return 'Esta semana'
}

function formatearHora(fechaCreacion: string) {
  const fecha = new Date(fechaCreacion)

  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function NotificacionesPanel({
  notificaciones,
  onNotificacionesActualizadas,
  onCerrar,
}: NotificacionesPanelProps) {
  const [marcandoTodas, setMarcandoTodas] = useState(false)
  const [marcandoId, setMarcandoId] = useState<number | null>(null)

  const cantidadNoLeidas = notificaciones.filter(
    (notificacion) => !notificacion.leida,
  ).length

  async function marcarTodasLeidas() {
    if (cantidadNoLeidas === 0 || marcandoTodas) return

    setMarcandoTodas(true)

    try {
      await apiPatch('/notificaciones/marcar-todas-leidas')

      onNotificacionesActualizadas(
        notificaciones.map((notificacion) => ({
          ...notificacion,
          leida: true,
        })),
      )
    } catch {
      // El estado no cambia si el backend no confirma la operación.
    } finally {
      setMarcandoTodas(false)
    }
  }

  async function marcarComoLeida(idNotificacion: number) {
    if (marcandoId !== null) return

    const notificacion = notificaciones.find(
      (item) => item.idNotificacion === idNotificacion,
    )

    if (!notificacion || notificacion.leida) return

    setMarcandoId(idNotificacion)

    try {
      const actualizada = await apiPatch<Notificacion>(
        `/notificaciones/${idNotificacion}/leida`,
      )

      onNotificacionesActualizadas(
        notificaciones.map((item) =>
          item.idNotificacion === idNotificacion
            ? actualizada
            : item,
        ),
      )
    } catch {
      // El estado no cambia si el backend no confirma la operación.
    } finally {
      setMarcandoId(null)
    }
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <span className="absolute -top-1 right-3 h-2 w-2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />

      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Notificaciones
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cantidadNoLeidas > 0
              ? `${cantidadNoLeidas} sin leer`
              : 'Al día'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void marcarTodasLeidas()}
            disabled={cantidadNoLeidas === 0 || marcandoTodas}
            title={
              cantidadNoLeidas === 0
                ? 'No hay notificaciones sin leer'
                : 'Marcar todas como leídas'
            }
            className={`text-xs font-medium ${
              cantidadNoLeidas === 0 || marcandoTodas
                ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                : 'text-sena-600 hover:text-sena-700 dark:text-sena-400 dark:hover:text-sena-300'
            }`}
          >
            {marcandoTodas ? 'Marcando…' : 'Marcar leídas'}
          </button>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar"
            aria-label="Cerrar notificaciones"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-50 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notificaciones.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No tienes notificaciones.
          </p>
        )}

        {GRUPOS.map((grupo) => {
          const items = notificaciones.filter(
            (notificacion) =>
              obtenerGrupo(notificacion.fechaCreacion) === grupo,
          )

          if (items.length === 0) return null

          return (
            <div key={grupo}>
              <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {grupo}
              </p>

              {items.map((notificacion) => (
                <button
                  key={notificacion.idNotificacion}
                  type="button"
                  onClick={() =>
                    void marcarComoLeida(
                      notificacion.idNotificacion,
                    )
                  }
                  disabled={
                    notificacion.leida ||
                    marcandoId === notificacion.idNotificacion
                  }
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-700/60"
                >
                  <span className="mt-1.5 w-1.5 shrink-0">
                    {!notificacion.leida && (
                      <span className="block h-1.5 w-1.5 rounded-full bg-orange-500" />
                    )}
                  </span>

                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      estiloTipo[notificacion.tipo]
                    }`}
                  >
                    <IconoTipo tipo={notificacion.tipo} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`text-sm ${
                          notificacion.leida
                            ? 'font-medium text-slate-700 dark:text-slate-300'
                            : 'font-semibold text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {notificacion.tipo.charAt(0).toUpperCase() +
                          notificacion.tipo.slice(1)}
                      </p>

                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                        {formatearHora(
                          notificacion.fechaCreacion,
                        )}
                      </span>
                    </div>

                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {notificacion.mensaje}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}