import { NOTIFICACIONES } from '../data/notificacionesEjemplo'
import type { GrupoNotificacion, TipoNotificacion } from '../data/notificacionesEjemplo'

const GRUPOS: GrupoNotificacion[] = ['Hoy', 'Ayer', 'Esta semana']

const estiloTipo: Record<TipoNotificacion, string> = {
  cruce: 'bg-orange-50 text-orange-600',
  horario: 'bg-emerald-50 text-emerald-600',
  ambiente: 'bg-slate-100 text-slate-500',
  sistema: 'bg-slate-100 text-slate-500',
}

function IconoTipo({ tipo }: { tipo: TipoNotificacion }) {
  const claseSvg = 'h-4 w-4'

  switch (tipo) {
    case 'cruce':
      return (
        <svg className={claseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 3h.01" />
        </svg>
      )
    case 'horario':
      return (
        <svg className={claseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <svg className={claseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 21s7-6.34 7-11.5A7 7 0 0 0 5 9.5C5 14.66 12 21 12 21Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      )
    case 'sistema':
      return (
        <svg className={claseSvg} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  onCerrar: () => void
}

/**
 * Tarjeta flotante que abre el ícono de campana del header (ver AppShell).
 * Presentacional pura: `onCerrar` la controla el padre, que también decide
 * dónde posicionarla (relative/absolute) y cuándo cerrarla por click afuera
 * o Escape.
 */
export function NotificacionesPanel({ onCerrar }: NotificacionesPanelProps) {
  const cantidadNoLeidas = NOTIFICACIONES.filter((n) => !n.leida).length

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
      <span className="absolute -top-1 right-3 h-2 w-2 rotate-45 border-l border-t border-slate-200 bg-white" />

      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
          <p className="text-xs text-slate-500">
            {cantidadNoLeidas > 0 ? `${cantidadNoLeidas} sin leer` : 'Al día'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Aún no implementado en el backend"
            className="cursor-not-allowed text-xs font-medium text-slate-400"
          >
            Marcar leídas
          </button>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {NOTIFICACIONES.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No tienes notificaciones.</p>
        )}
        {GRUPOS.map((grupo) => {
          const items = NOTIFICACIONES.filter((n) => n.grupo === grupo)
          if (items.length === 0) return null

          return (
            <div key={grupo}>
              <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {grupo}
              </p>
              {items.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                  <span className="mt-1.5 w-1.5 shrink-0">
                    {!n.leida && <span className="block h-1.5 w-1.5 rounded-full bg-orange-500" />}
                  </span>

                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${estiloTipo[n.tipo]}`}
                  >
                    <IconoTipo tipo={n.tipo} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm ${n.leida ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                        {n.titulo}
                      </p>
                      <span className="shrink-0 text-[11px] text-slate-400">{n.hora}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
