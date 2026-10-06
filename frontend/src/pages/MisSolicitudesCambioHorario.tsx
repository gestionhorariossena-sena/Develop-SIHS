import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { SolicitudCambioHorario } from '../types/api'

const TIPO: Record<SolicitudCambioHorario['tipo'], string> = {
  novedad: 'Novedad',
  permuta: 'Permuta',
  'cambio-ambiente': 'Cambio de ambiente',
}

const ESTADO: Record<SolicitudCambioHorario['estado'], string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
}

function fechaSolicitud(fecha: string) {
  return new Date(fecha).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MisSolicitudesCambioHorario() {
  const [solicitudes, setSolicitudes] = useState<SolicitudCambioHorario[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<SolicitudCambioHorario[]>('/solicitudes-cambio-horario/mias')
      .then(setSolicitudes)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus solicitudes.')
      })
  }, [])

  return (
    <AppShell activo="Mis solicitudes">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Comunicaciones · Instructor</p>
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Mis solicitudes de cambio</h1>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Consulta el estado de los reportes que enviaste a coordinación.
        </p>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {solicitudes === null && !error && (
          <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando tus solicitudes…</p>
        )}

        {solicitudes?.length === 0 && (
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-6 text-center text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800">
            Todavía no has enviado solicitudes de cambio.
          </p>
        )}

        {solicitudes && solicitudes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {solicitudes.map((solicitud) => (
              <li
                key={solicitud.idSolicitud}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                    {TIPO[solicitud.tipo]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      solicitud.estado === 'pendiente'
                        ? 'bg-tertiary-container text-on-tertiary-container'
                        : solicitud.estado === 'aprobada'
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {ESTADO[solicitud.estado]}
                  </span>
                  <span className="ml-auto text-xs text-on-surface-variant dark:text-slate-400">
                    {fechaSolicitud(solicitud.fechaSolicitud)}
                  </span>
                </div>

                <p className="text-sm text-on-surface dark:text-slate-100">{solicitud.motivo}</p>
                <p className="mt-2 text-xs text-on-surface-variant dark:text-slate-400">
                  {solicitud.fichaCodigo && solicitud.horaInicio && solicitud.horaFin
                    ? `Ficha ${solicitud.fichaCodigo} · ${solicitud.horaInicio.slice(0, 5)} a ${solicitud.horaFin.slice(0, 5)} · ${solicitud.ambienteNombre ?? 'sin ambiente'}`
                    : `Bloque #${solicitud.idHorarioOrigen}`}
                </p>
                {solicitud.fechaResolucion && (
                  <p className="mt-2 text-xs text-on-surface-variant dark:text-slate-400">
                    Resuelta el {fechaSolicitud(solicitud.fechaResolucion)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
