import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPatch, ApiError } from '../services/api'
import type { Horario, SolicitudCambioHorario, Usuario } from '../types/api'

type Tab = 'pendiente' | 'aprobada' | 'rechazada'

const TABS: { valor: Tab; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'rechazada', etiqueta: 'Rechazadas' },
]

const ETIQUETA_TIPO: Record<SolicitudCambioHorario['tipo'], string> = {
  novedad: 'Novedad',
  permuta: 'Permuta',
  'cambio-ambiente': 'Cambio de ambiente',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

/**
 * Bandeja del coordinador para lo que reportan los instructores — el ítem
 * «Cambios» del navbar, que hasta H-4 (2026-09-24) estaba en gris con el
 * tooltip «Módulo aún no implementado» pese a tener el backend completo
 * (`/solicitudes-cambio-horario`, los cuatro endpoints).
 *
 * Es la otra punta de ModalReportarNovedad: allá el instructor reporta,
 * acá coordinación resuelve, y el instructor recibe una notificación con
 * la decisión (H-8). La lista se pide entera y se filtra por tab en el
 * cliente, igual que el resto de bandejas del sistema.
 *
 * **Aprobar registra la decisión, no mueve el horario.** El backend es
 * explícito al respecto (ver `SolicitudCambioHorarioService.resolver`):
 * el motivo es texto libre, no un "ambiente destino" estructurado, así
 * que no hay datos para aplicar el cambio automáticamente. La pantalla lo
 * dice en pantalla en vez de dejar creer que el horario ya cambió.
 */
export function CambiosHorario() {
  const [solicitudes, setSolicitudes] = useState<SolicitudCambioHorario[] | null>(null)
  const [instructores, setInstructores] = useState<Map<string, Usuario>>(new Map())
  const [horarios, setHorarios] = useState<Map<number, Horario>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [resolviendoId, setResolviendoId] = useState<number | null>(null)
  const [tabActivo, setTabActivo] = useState<Tab>('pendiente')

  function cargar() {
    return Promise.all([
      apiGet<SolicitudCambioHorario[]>('/solicitudes-cambio-horario/'),
      apiGet<Usuario[]>('/usuarios/'),
      apiGet<Horario[]>('/horarios/'),
    ])
      .then(([lista, usuarios, listaHorarios]) => {
        setSolicitudes(lista)
        setInstructores(new Map(usuarios.map((u) => [u.idUsuario, u])))
        setHorarios(new Map(listaHorarios.map((h) => [h.idHorario, h])))
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las solicitudes.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
  }, [])

  const porEstado = useMemo(() => {
    const base = solicitudes ?? []
    return {
      pendiente: base.filter((s) => s.estado === 'pendiente'),
      aprobada: base.filter((s) => s.estado === 'aprobada'),
      rechazada: base.filter((s) => s.estado === 'rechazada'),
    }
  }, [solicitudes])

  async function resolver(solicitud: SolicitudCambioHorario, estado: 'aprobada' | 'rechazada') {
    setResolviendoId(solicitud.idSolicitud)
    setError(null)

    try {
      await apiPatch(`/solicitudes-cambio-horario/${solicitud.idSolicitud}/resolver`, { estado })
      const instructor = instructores.get(solicitud.idInstructor)
      setMensajeExito(
        `Solicitud de ${instructor?.nombre ?? 'el instructor'} marcada como ${estado}. Se le notificó.`,
      )
      setTimeout(() => setMensajeExito(null), 6000)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo resolver la solicitud.')
    } finally {
      setResolviendoId(null)
    }
  }

  const visibles = porEstado[tabActivo]

  return (
    <AppShell activo="Cambios">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Operación</p>
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Cambios y novedades</h1>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Lo que los instructores reportan sobre sus franjas. Aprobar deja constancia de la decisión y les
          avisa; el horario se ajusta después en el creador de horarios.
        </p>

        {mensajeExito && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-primary/20 bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container"
          >
            {mensajeExito}
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.valor}
              type="button"
              onClick={() => setTabActivo(tab.valor)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                tabActivo === tab.valor
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.etiqueta} ({porEstado[tab.valor].length})
            </button>
          ))}
        </div>

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando solicitudes…</p>}

        {!cargando && visibles.length === 0 && (
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-6 text-center text-sm text-on-surface-variant dark:border-slate-700 dark:text-slate-400">
            {tabActivo === 'pendiente'
              ? 'No hay novedades sin resolver. Cuando un instructor reporte algo, aparecerá acá.'
              : 'Todavía no hay solicitudes en este estado.'}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {visibles.map((solicitud) => {
            const instructor = instructores.get(solicitud.idInstructor)
            const horario = horarios.get(solicitud.idHorarioOrigen)

            return (
              <li
                key={solicitud.idSolicitud}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                    {ETIQUETA_TIPO[solicitud.tipo]}
                  </span>
                  <span className="text-sm font-semibold text-on-surface dark:text-slate-100">
                    {instructor?.nombre ?? 'Instructor'}
                  </span>
                  <span className="text-xs text-on-surface-variant dark:text-slate-400">
                    {formatFecha(solicitud.fechaSolicitud)}
                  </span>
                </div>

                <p className="mb-2 text-sm text-on-surface-variant dark:text-slate-300">{solicitud.motivo}</p>

                <p className="mb-3 text-xs text-on-surface-variant dark:text-slate-400">
                  {horario
                    ? `Ficha ${horario.fichaCodigo ?? horario.idFicha} · ${formatoHora(horario.horaInicio)} a ${formatoHora(horario.horaFin)} · ${horario.ambienteNombre ?? 'sin ambiente'}`
                    : `Bloque #${solicitud.idHorarioOrigen}`}
                </p>

                {solicitud.estado === 'pendiente' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void resolver(solicitud, 'aprobada')}
                      disabled={resolviendoId === solicitud.idSolicitud}
                      className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resolviendoId === solicitud.idSolicitud ? 'Guardando…' : 'Aprobar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolver(solicitud, 'rechazada')}
                      disabled={resolviendoId === solicitud.idSolicitud}
                      className="h-9 rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                    >
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-on-surface-variant dark:text-slate-400">
                    {solicitud.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                    {solicitud.fechaResolucion ? ` · ${formatFecha(solicitud.fechaResolucion)}` : ''}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </AppShell>
  )
}
