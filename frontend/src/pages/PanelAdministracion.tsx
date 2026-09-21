import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPost, ApiError } from '../services/api'
import type { Rol, SolicitudAcceso } from '../types/api'

type Tab = 'pendiente' | 'aprobada' | 'rechazada' | 'todas'

const TABS: { valor: Tab; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'rechazada', etiqueta: 'Rechazadas' },
  { valor: 'todas', etiqueta: 'Historial Completo' },
]

const MOTIVOS_RECHAZO = [
  'Correo electrónico no coincide con dominio institucional @sena.edu.co',
  'Falta soporte de resolución de nombramiento o contrato vigente',
  'Centro o sede no corresponde a CGMLTI Calle 52',
  'Solicitud duplicada',
]
const OTRO_MOTIVO = 'Otro motivo personalizado'

function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/)
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase()
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function esDelMesActual(iso: string, ahora: Date) {
  const fecha = new Date(iso)
  return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth()
}

/**
 * SCRUM-121: Panel de Administración de solicitudes de acceso — reemplaza
 * la VISTA de AprobarlicitarSolicitudes.tsx (que sigue existiendo, ver
 * abajo). Mockup: _Docs/Diseño/mockups-stitch/panel_de_administracion_sihs_sena.
 *
 * Depende de los endpoints `/solicitudes-acceso` (ticket "[Backend]
 * Endpoints /solicitudes-acceso", Epic SCRUM-96) que TODAVÍA NO EXISTEN en
 * el backend — mismo patrón que Registro.tsx (SCRUM-124), que ya llama a
 * `POST /solicitudes-acceso/` desde el flujo público. El contrato de
 * campos que usa esta pantalla (`types/api.ts#SolicitudAcceso`) es el que
 * quedó documentado en los tickets de Jira SCRUM-103 (tabla) y SCRUM-109
 * (endpoints), no una adivinanza — cuando el backend exista, esta pantalla
 * debería funcionar sin cambios de contrato.
 *
 * AprobarlicitarSolicitudes.tsx (SCRUM-10, ya Finalizado) NO se borra ni se
 * modifica — trabaja sobre un concepto distinto (usuarios YA registrados
 * sin rol, vía `GET /usuarios/` filtrando `roles.length === 0`) y su lógica
 * de `POST /usuario-rol/asignar` se sigue reutilizando acá mismo al
 * aprobar. Solo se retira su entrada de navegación (ver AppShell.tsx),
 * pero su ruta `/aprobar-solicitudes` sigue viva (decisión explícita:
 * se conserva como referencia/lógica reutilizable).
 *
 * Todas las solicitudes se piden UNA vez sin filtro (`GET
 * /solicitudes-acceso/`, sin query `estado`) porque el ribbon de métricas y
 * los contadores de cada tab necesitan ver los cuatro estados a la vez —
 * filtrar por tab/rol pasa client-side sobre esa única lista, igual que el
 * resto de pantallas de catálogo (Instructores.tsx, Fichas.tsx). El
 * endpoint sí soporta `?estado=` para cuando haga falta paginar server-side.
 *
 * Cifras que SÍ son reales (derivadas de `solicitudes`): conteos por
 * estado, desglose por rol de las pendientes, tiempo promedio en cola de
 * las pendientes, aprobadas del mes en curso. Cifras que el mockup muestra
 * pero no son derivables hoy (ej. "100% cambiaron clave al 1er login" — no
 * hay forma de saber si la persona ya cambió su clave, `debe_cambiar_clave`
 * ni siquiera existe todavía) quedan como contenido estático de vitrina, no
 * como un porcentaje inventado.
 */
export function PanelAdministracion() {
  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[] | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noAutorizado, setNoAutorizado] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [tabActivo, setTabActivo] = useState<Tab>('pendiente')
  const [filtroRol, setFiltroRol] = useState<number | 'todos'>('todos')

  const [rolOtorgado, setRolOtorgado] = useState<Record<number, number>>({})
  const [procesandoId, setProcesandoId] = useState<number | null>(null)

  const [solicitudRechazando, setSolicitudRechazando] = useState<SolicitudAcceso | null>(null)
  const [motivoSeleccionado, setMotivoSeleccionado] = useState(MOTIVOS_RECHAZO[0])
  const [observacionAdicional, setObservacionAdicional] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null)

  function cargarSolicitudes() {
    setCargando(true)
    return Promise.all([apiGet<SolicitudAcceso[]>('/solicitudes-acceso/'), apiGet<Rol[]>('/roles/')])
      .then(([listaSolicitudes, listaRoles]) => {
        setSolicitudes(listaSolicitudes)
        setRoles(listaRoles)
        setError(null)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setNoAutorizado(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las solicitudes de acceso.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mismo patrón que cargarAmbientes() en Ambientes.tsx.
    cargarSolicitudes()
  }, [])

  const pendientes = useMemo(() => (solicitudes ?? []).filter((s) => s.estado === 'pendiente'), [solicitudes])
  const aprobadas = useMemo(() => (solicitudes ?? []).filter((s) => s.estado === 'aprobada'), [solicitudes])
  const rechazadas = useMemo(() => (solicitudes ?? []).filter((s) => s.estado === 'rechazada'), [solicitudes])

  const desglosePendientesPorRol = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const s of pendientes) mapa.set(s.rolSolicitado.nombre, (mapa.get(s.rolSolicitado.nombre) ?? 0) + 1)
    return [...mapa.entries()].map(([rol, cantidad]) => `${rol} (${cantidad})`).join(' · ')
  }, [pendientes])

  const tiempoPromedioEnColaHoras = useMemo(() => {
    if (pendientes.length === 0) return null
    const ahora = new Date()
    const totalHoras = pendientes.reduce((total, s) => total + (ahora.getTime() - new Date(s.fechaSolicitud).getTime()) / 3_600_000, 0)
    return (totalHoras / pendientes.length).toFixed(1)
  }, [pendientes])

  const aprobadasEsteMes = useMemo(
    () => aprobadas.filter((s) => s.fechaResolucion && esDelMesActual(s.fechaResolucion, new Date())),
    [aprobadas],
  )

  const ultimasEvaluadas = useMemo(
    () =>
      [...aprobadas, ...rechazadas]
        .filter((s) => s.fechaResolucion)
        .sort((a, b) => new Date(b.fechaResolucion as string).getTime() - new Date(a.fechaResolucion as string).getTime())
        .slice(0, 5),
    [aprobadas, rechazadas],
  )

  const listaPorTab: Record<Tab, SolicitudAcceso[]> = {
    pendiente: pendientes,
    aprobada: aprobadas,
    rechazada: rechazadas,
    todas: solicitudes ?? [],
  }

  const solicitudesVisibles = useMemo(() => {
    const base = listaPorTab[tabActivo]
    return filtroRol === 'todos' ? base : base.filter((s) => s.idRolSolicitado === filtroRol)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActivo, filtroRol, solicitudes])

  function abrirRechazo(solicitud: SolicitudAcceso) {
    setSolicitudRechazando(solicitud)
    setMotivoSeleccionado(MOTIVOS_RECHAZO[0])
    setObservacionAdicional('')
    setErrorRechazo(null)
  }

  function cerrarRechazo() {
    setSolicitudRechazando(null)
    setErrorRechazo(null)
  }

  async function aprobar(solicitud: SolicitudAcceso) {
    const idRol = rolOtorgado[solicitud.idSolicitud] ?? solicitud.idRolSolicitado
    setProcesandoId(solicitud.idSolicitud)
    setError(null)

    try {
      await apiPost(`/solicitudes-acceso/${solicitud.idSolicitud}/aprobar`, { idRol })
      setMensajeExito(`Solicitud de ${solicitud.nombre} aprobada. Se despachó una credencial temporal a ${solicitud.email}.`)
      setTimeout(() => setMensajeExito(null), 6000)
      await cargarSolicitudes()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar la solicitud.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function confirmarRechazo() {
    if (!solicitudRechazando) return

    const observacion = observacionAdicional.trim()
    const motivoRechazo =
      motivoSeleccionado === OTRO_MOTIVO ? observacion : observacion ? `${motivoSeleccionado} — ${observacion}` : motivoSeleccionado

    if (!motivoRechazo) {
      setErrorRechazo('Ingresa el motivo del rechazo.')
      return
    }

    setRechazando(true)
    setErrorRechazo(null)

    try {
      await apiPost(`/solicitudes-acceso/${solicitudRechazando.idSolicitud}/rechazar`, { motivoRechazo })
      setMensajeExito(`Solicitud de ${solicitudRechazando.nombre} rechazada.`)
      setTimeout(() => setMensajeExito(null), 6000)
      cerrarRechazo()
      await cargarSolicitudes()
    } catch (err) {
      setErrorRechazo(err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud.')
    } finally {
      setRechazando(false)
    }
  }

  if (noAutorizado) {
    return (
      <AppShell activo="Solicitudes de acceso">
        <div className="flex items-center justify-center py-24">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
              <span aria-hidden="true" className="material-symbols-outlined">error</span>
            </div>
            <h1 className="text-lg font-bold text-on-surface">Acceso denegado</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Solo un Administrador puede ver y resolver solicitudes de acceso al sistema.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activo="Solicitudes de acceso">
      <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        <span>Dashboard</span>
        <span className="text-outline">/</span>
        <span className="font-semibold text-primary">Administración</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-on-surface">
            Solicitudes de Acceso al Sistema
            <span className="inline-flex items-center gap-1.5 rounded-full border border-tertiary/30 bg-tertiary-container px-3 py-1 text-xs font-bold text-on-tertiary-container">
              <span className="h-2 w-2 rounded-full bg-tertiary" />
              {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} de validación
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
            Revisa, valida la identidad y aprueba las peticiones de registro originadas desde el portal público. Al
            aprobar, el sistema asigna el rol vía <code className="rounded bg-surface-container px-1 py-0.5 text-xs">POST /usuario-rol/asignar</code> y despacha una credencial temporal.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarSolicitudes}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">sync</span>
          Sincronizar Cola
        </button>
      </div>

      {mensajeExito && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check_circle</span>
          {mensajeExito}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>
      )}

      {/* Tarjetas de métricas */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-tertiary/30 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Pendientes de Aprobación</span>
            <span className="rounded-lg bg-tertiary-container p-1.5 text-on-tertiary-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">pending_actions</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold text-on-surface">{pendientes.length}</div>
            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
              {desglosePendientesPorRol || 'Sin solicitudes pendientes'}
            </p>
          </div>
          <div className="flex items-center gap-1 border-t border-outline-variant pt-2 text-[11px] text-on-surface-variant">
            <span aria-hidden="true" className="material-symbols-outlined text-[13px]">schedule</span>
            <span>{tiempoPromedioEnColaHoras != null ? `Tiempo prom. en cola: ${tiempoPromedioEnColaHoras} horas` : 'Sin solicitudes en cola'}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Aprobadas Este Mes</span>
            <span className="rounded-lg bg-primary-container p-1.5 text-on-primary-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check_circle</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold text-on-surface">{aprobadasEsteMes.length}</div>
            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">Credenciales temporales despachadas</p>
          </div>
          {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato
              real del backend: no hay forma de saber si la persona ya
              cambió su clave en el primer login (ni siquiera existe todavía
              `debe_cambiar_clave`), así que no se muestra un % inventado. */}
          <div className="border-t border-outline-variant pt-2 text-[11px] text-on-surface-variant">
            <span>Cambio de clave forzado en el primer ingreso</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Rechazadas con Justificación</span>
            <span className="rounded-lg bg-error-container p-1.5 text-on-error-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">block</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold text-on-surface">{rechazadas.length}</div>
            <p className="mt-0.5 text-[11px] text-on-surface-variant">Todas con motivo formal registrado</p>
          </div>
          <div className="border-t border-outline-variant pt-2 text-[11px] text-on-surface-variant">
            <span>Notificación remitida al solicitante</span>
          </div>
        </div>

        {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato
            real del backend: es texto informativo estático sobre el
            protocolo de seguridad, no una cifra derivada de datos. */}
        <div className="flex flex-col justify-between rounded-xl border border-primary/30 bg-primary-container/40 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-primary-container">
            <span className="font-semibold">Protocolo de Seguridad</span>
            <span className="rounded-lg bg-primary-container p-1.5 text-on-primary-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">verified_user</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-xs font-semibold text-on-primary-container">Autenticación Forzada 1er Ingreso</div>
            <p className="mt-1 text-[11px] leading-snug text-on-primary-container">
              Contraseña autogenerada de un solo uso, con cambio obligatorio antes de navegar el sistema.
            </p>
          </div>
          <div className="border-t border-primary/20 pt-2 font-mono text-[10px] text-on-primary-container">
            SMTP institucional — pendiente ticket de envío de credencial
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Columna principal: tabs + lista de solicitudes */}
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg bg-surface-container p-1 text-xs font-medium">
              {TABS.map((tab) => (
                <button
                  key={tab.valor}
                  type="button"
                  onClick={() => setTabActivo(tab.valor)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
                    tabActivo === tab.valor
                      ? 'bg-surface-container-lowest font-bold text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>{tab.etiqueta}</span>
                  {tab.valor !== 'todas' && (
                    <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
                      {listaPorTab[tab.valor].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <select
              value={filtroRol}
              onChange={(evento) => setFiltroRol(evento.target.value === 'todos' ? 'todos' : Number(evento.target.value))}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface"
            >
              <option value="todos">Todos los roles solicitados</option>
              {roles.map((rol) => (
                <option key={rol.idRol} value={rol.idRol}>
                  Rol: {rol.nombre}
                </option>
              ))}
            </select>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
              </svg>
              Cargando solicitudes…
            </div>
          ) : solicitudesVisibles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <span aria-hidden="true" className="material-symbols-outlined">check_circle</span>
              </div>
              <div>
                <p className="font-semibold text-on-surface">No hay solicitudes en esta vista</p>
                <p className="text-sm text-on-surface-variant">Cambiá de tab o de filtro de rol para ver otras solicitudes.</p>
              </div>
            </div>
          ) : (
            solicitudesVisibles.map((solicitud) => (
              <article key={solicitud.idSolicitud} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary-container text-sm font-bold text-on-primary-container">
                      {iniciales(solicitud.nombre)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-on-surface">{solicitud.nombre}</h3>
                        <span className="rounded bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container">
                          Solicita: {solicitud.rolSolicitado.nombre}
                        </span>
                        {solicitud.estado === 'pendiente' && (
                          <span className="flex items-center gap-1 rounded bg-tertiary-container px-2 py-0.5 text-[10px] font-bold text-on-tertiary-container">
                            <span className="h-1.5 w-1.5 rounded-full bg-tertiary" /> Pendiente de validación
                          </span>
                        )}
                        {solicitud.estado === 'aprobada' && (
                          <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container">Aprobada</span>
                        )}
                        {solicitud.estado === 'rechazada' && (
                          <span className="rounded bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">Rechazada</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">mail</span>
                          {solicitud.email}
                        </span>
                        <span>·</span>
                        <span>Doc. {solicitud.numeroDocumento}</span>
                        <span>·</span>
                        <span>Radicado: {formatFecha(solicitud.fechaSolicitud)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-outline-variant bg-surface-container px-2.5 py-1 font-mono text-[11px] text-on-surface-variant">
                    ID #{solicitud.idSolicitud}
                  </span>
                </div>

                <div className="space-y-1.5 rounded-lg border border-outline-variant bg-surface-container p-3.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-on-surface-variant">
                    <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-primary">format_quote</span>
                    <span>Motivo y justificación declarada por el solicitante:</span>
                  </div>
                  <p className="pl-5 leading-relaxed text-on-surface italic">«{solicitud.motivo}»</p>
                </div>

                {solicitud.estado === 'pendiente' ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`rol-otorgar-${solicitud.idSolicitud}`} className="mb-1 block text-xs font-semibold text-on-surface-variant">
                          Rol a otorgar en sistema:
                        </label>
                        <select
                          id={`rol-otorgar-${solicitud.idSolicitud}`}
                          value={rolOtorgado[solicitud.idSolicitud] ?? solicitud.idRolSolicitado}
                          onChange={(evento) =>
                            setRolOtorgado((prev) => ({ ...prev, [solicitud.idSolicitud]: Number(evento.target.value) }))
                          }
                          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-on-surface"
                        >
                          {roles.map((rol) => (
                            <option key={rol.idRol} value={rol.idRol}>
                              {rol.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Sede y jornada autorizada:</label>
                        {/* Contenido de mockup (Stitch) — sin backend real hoy:
                            usuario_rol no se ancla a sede/jornada. Disabled,
                            no simular que hace algo. */}
                        <select
                          disabled
                          title="Aún no implementado en el backend"
                          className="w-full cursor-not-allowed rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface-variant"
                        >
                          <option>Todas las sedes y jornadas</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 border-t border-outline-variant pt-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                        <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-primary">mark_email_read</span>
                        <span>Enviará contraseña provisoria al correo institucional y forzará su cambio al entrar.</span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirRechazo(solicitud)}
                          disabled={procesandoId === solicitud.idSolicitud}
                          className="inline-flex items-center gap-1 rounded-lg border border-outline px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:border-error hover:bg-error-container hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[15px]">close</span>
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => aprobar(solicitud)}
                          disabled={procesandoId === solicitud.idSolicitud}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span>
                          {procesandoId === solicitud.idSolicitud ? 'Aprobando…' : 'Aprobar y Enviar Credencial'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : solicitud.estado === 'aprobada' ? (
                  <p className="border-t border-outline-variant pt-3 text-[11px] text-on-surface-variant">
                    Aprobada {solicitud.fechaResolucion ? formatFecha(solicitud.fechaResolucion) : ''} — credencial temporal despachada.
                  </p>
                ) : (
                  <div className="border-t border-outline-variant pt-3 text-[11px] text-on-surface-variant">
                    <p>Rechazada {solicitud.fechaResolucion ? formatFecha(solicitud.fechaResolucion) : ''}</p>
                    {solicitud.motivoRechazo && <p className="mt-1 text-on-surface">Motivo: {solicitud.motivoRechazo}</p>}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {/* Columna lateral */}
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">lock_clock</span>
                <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface">Flujo al Aprobar</h4>
              </div>
              <span className="rounded bg-primary-container px-2 py-0.5 font-mono text-[10px] text-on-primary-container">Automatizado</span>
            </div>
            {/* Contenido informativo — estos 3 pasos SÍ son reales una vez
                estén los tickets de backend correspondientes (endpoint de
                aprobar, envío de credencial, columna debe_cambiar_clave). */}
            <div className="space-y-2.5 text-xs text-on-surface-variant">
              <div className="flex items-start gap-2.5 rounded-lg border border-outline-variant bg-surface-container p-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-on-primary-container">1</span>
                <div>
                  <span className="font-semibold text-on-surface">Ejecución del Endpoint:</span>
                  <p className="mt-0.5 font-mono text-[11px] text-on-surface-variant">POST /usuario-rol/asignar</p>
                  <p className="mt-0.5 text-[11px]">Vincula el usuario con el rol verificado en la base de datos central.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-outline-variant bg-surface-container p-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-on-primary-container">2</span>
                <div>
                  <span className="font-semibold text-on-surface">Despacho de Credencial Temporal:</span>
                  <p className="mt-0.5 text-[11px]">Correo al dominio institucional con contraseña autogenerada de un solo uso.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-outline-variant bg-surface-container p-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-[10px] font-bold text-on-primary-container">3</span>
                <div>
                  <span className="font-semibold text-on-surface">Cambio Forzado en 1er Ingreso:</span>
                  <p className="mt-0.5 text-[11px]">
                    <code className="rounded bg-surface-container-high px-1 text-[10px]">debe_cambiar_clave = true</code> impide navegar hasta establecer clave personal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">history</span>
              <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface">Últimas Evaluadas</h4>
            </div>
            {ultimasEvaluadas.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Todavía no hay solicitudes aprobadas ni rechazadas.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {ultimasEvaluadas.map((s) => (
                  <div
                    key={s.idSolicitud}
                    className={`flex items-center justify-between rounded-lg border p-2.5 ${
                      s.estado === 'aprobada' ? 'border-outline-variant bg-surface-container' : 'border-error/20 bg-error-container/30'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-semibold text-on-surface">{s.nombre}</div>
                      <div className="font-mono text-[10px] text-on-surface-variant">Rol: {s.rolSolicitado.nombre}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                        s.estado === 'aprobada' ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[12px]">{s.estado === 'aprobada' ? 'check' : 'close'}</span>
                      {s.estado === 'aprobada' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {solicitudRechazando && (
            <div className="space-y-3 rounded-xl border border-tertiary/40 bg-tertiary-container/40 p-4 shadow-sm">
              <div className="flex items-center justify-between text-on-tertiary-container">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">report</span>
                  <span className="text-xs font-bold uppercase tracking-wide">Protocolo de Rechazo</span>
                </div>
                <span className="font-mono text-[10px]">Auditable</span>
              </div>
              <p className="text-[11px] leading-snug text-on-tertiary-container">
                Vas a rechazar la solicitud de <strong>{solicitudRechazando.nombre}</strong>. El motivo se notificará al
                solicitante:
              </p>
              <div className="space-y-2">
                <select
                  value={motivoSeleccionado}
                  onChange={(evento) => setMotivoSeleccionado(evento.target.value)}
                  className="w-full rounded-lg border border-tertiary/40 bg-surface-container-lowest p-2 text-xs text-on-surface"
                >
                  {MOTIVOS_RECHAZO.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      Motivo: {motivo}
                    </option>
                  ))}
                  <option value={OTRO_MOTIVO}>{OTRO_MOTIVO}...</option>
                </select>
                <textarea
                  value={observacionAdicional}
                  onChange={(evento) => setObservacionAdicional(evento.target.value)}
                  placeholder={
                    motivoSeleccionado === OTRO_MOTIVO
                      ? 'Describe el motivo del rechazo (obligatorio)...'
                      : 'Observación adicional para el solicitante (opcional)...'
                  }
                  rows={2}
                  className="w-full rounded-lg border border-tertiary/40 bg-surface-container-lowest p-2 text-xs text-on-surface placeholder:text-on-surface-variant"
                />
              </div>
              {errorRechazo && <p className="text-[11px] font-medium text-error">{errorRechazo}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cerrarRechazo}
                  disabled={rechazando}
                  className="rounded-lg border border-tertiary/40 px-3 py-1.5 text-xs font-medium text-on-tertiary-container transition-colors hover:bg-tertiary-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarRechazo}
                  disabled={rechazando}
                  className="rounded-lg bg-tertiary px-3 py-1.5 text-xs font-semibold text-on-tertiary shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {rechazando ? 'Rechazando…' : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
