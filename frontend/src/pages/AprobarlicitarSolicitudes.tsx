import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPost, ApiError } from '../services/api'
import type { Rol, Usuario } from '../types/api'

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * SCRUM-10: Pantalla de administrador para aprobar solicitudes de registro
 * y asignar roles a usuarios sin rol.
 * 
 * Usuarios se registran sin rol. El administrador debe:
 * 1. Ver lista de usuarios sin rol asignado
 * 2. Seleccionar un rol disponible
 * 3. Asignarlo con POST /usuario-rol/asignar
 */
export function AprobarlicitarSolicitudes() {
  const [usuariosSinRol, setUsuariosSinRol] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noAutorizado, setNoAutorizado] = useState(false)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null)
  const [rolSeleccionado, setRolSeleccionado] = useState<number | null>(null)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const contenidoModalRef = useRef<HTMLDivElement>(null)

  // Cargar usuarios sin rol y lista de roles
  useEffect(() => {
    Promise.all([apiGet<Usuario[]>('/usuarios/'), apiGet<Rol[]>('/roles/')])
      .then(([listaUsuarios, listaRoles]) => {
        // Filtrar solo usuarios sin rol
        const sinRol = listaUsuarios.filter((u) => u.roles.length === 0)
        setUsuariosSinRol(sinRol)
        setRoles(listaRoles)
        setCargando(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setNoAutorizado(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de solicitudes.')
        setCargando(false)
      })
  }, [])

  // Abrir modal para asignar rol
  function abrirModalAsignar(usuario: Usuario) {
    setUsuarioSeleccionado(usuario)
    setRolSeleccionado(null)
    setMostrarModal(true)
  }

  useEffect(() => {
    if (!mostrarModal) return
    contenidoModalRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [mostrarModal])

  function cerrarModalAsignar() {
    setMostrarModal(false)
    setUsuarioSeleccionado(null)
    setRolSeleccionado(null)
  }

  function manejarTecladoModal(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      cerrarModalAsignar()
      return
    }

    if (evento.key !== 'Tab' || !contenidoModalRef.current) return

    const focables = contenidoModalRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if (focables.length === 0) return

    const primero = focables[0]
    const ultimo = focables[focables.length - 1]

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primero.focus()
    }
  }

  // Asignar rol al usuario
  async function asignarRol() {
    if (!usuarioSeleccionado || !rolSeleccionado) {
      setError('Por favor selecciona un rol')
      return
    }

    setProcesandoId(usuarioSeleccionado.idUsuario)
    setError(null)

    try {
      await apiPost('/usuario-rol/asignar', {
        idUsuario: usuarioSeleccionado.idUsuario,
        idRol: rolSeleccionado,
      })

      const rolAsignado = roles.find((r) => r.idRol === rolSeleccionado)?.nombre

      // Remover usuario de la lista
      setUsuariosSinRol((prev) =>
        prev.filter((u) => u.idUsuario !== usuarioSeleccionado.idUsuario)
      )

      let mensaje = `${usuarioSeleccionado.nombre} ahora tiene el rol ${rolAsignado ?? 'seleccionado'}.`

      // El código de instructor ya no se genera a mano desde Usuarios.tsx —
      // se dispara acá mismo, al aprobar el rol, y queda fijo (el endpoint
      // es idempotente: si el usuario ya tiene código, devuelve el mismo).
      if (rolAsignado === 'Instructor') {
        try {
          const { codigo } = await apiPost<{ codigo: string; idUsuario: string }>(
            '/usuarios/instructor/codigo/generar',
            { idUsuario: usuarioSeleccionado.idUsuario },
          )
          mensaje += ` Código de instructor: ${codigo}.`
        } catch {
          mensaje += ' No se pudo generar su código de instructor — hazlo desde "Código de instructor".'
        }
      }

      setMostrarModal(false)
      setMensajeExito(mensaje)
      setUsuarioSeleccionado(null)
      setRolSeleccionado(null)
      setTimeout(() => setMensajeExito(null), 6000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al asignar rol')
    } finally {
      setProcesandoId(null)
    }
  }

  if (noAutorizado) {
    return (
      <AppShell activo="Aprobar solicitudes de registro">
        <div className="flex items-center justify-center py-24">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
              <span aria-hidden="true" className="material-symbols-outlined">error</span>
            </div>
            <h1 className="text-lg font-bold text-on-surface">Acceso denegado</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Solo un Administrador puede aprobar solicitudes de registro.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  const usuariosFiltrados = busqueda.trim()
    ? usuariosSinRol.filter((u) => {
        const texto = busqueda.trim().toLocaleLowerCase('es-CO')
        return u.nombre.toLocaleLowerCase('es-CO').includes(texto) || u.email.toLocaleLowerCase('es-CO').includes(texto)
      })
    : usuariosSinRol

  return (
    <AppShell activo="Aprobar solicitudes de registro">
      <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        <span>Dashboard</span>
        <span className="text-outline">/</span>
        <span className="font-semibold text-primary">Solicitudes y Auditoría</span>
      </nav>

      {/* Encabezado — mismo estilo "Centro de Solicitudes" del mockup */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <span aria-hidden="true" className="material-symbols-outlined">badge</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Aprobar solicitudes de registro</h1>
            <p className="text-sm text-on-surface-variant">
              Usuarios que ya se registraron y están a la espera de que les asignes un rol.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato
              real del backend (no hay métrica de tiempo de resolución ni de
              "eficiencia de matriz" hoy). No usar como si fuera dinámico sin
              agregar el endpoint/cálculo correspondiente primero. */}
          <div className="hidden items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800 sm:flex">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">timer</span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-on-surface dark:text-slate-100">14 min</p>
              <p className="text-[11px] text-on-surface-variant dark:text-slate-400">Resolución prom.</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800 sm:flex">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">verified</span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-on-surface dark:text-slate-100">94.2%</p>
              <p className="text-[11px] text-on-surface-variant dark:text-slate-400">Eficiencia matriz</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-tertiary-container px-4 py-1.5 text-sm font-semibold text-on-tertiary-container">
            <span className="h-2 w-2 rounded-full bg-tertiary" />
            {usuariosSinRol.length} pendiente{usuariosSinRol.length !== 1 ? 's' : ''} de aprobación
          </span>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {mensajeExito && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check_circle</span>
          {mensajeExito}
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <p className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {/* Tarjetas de solicitudes — una por usuario, mismo patrón que el mockup */}
      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
          </svg>
          Cargando solicitudes…
        </div>
      ) : usuariosSinRol.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest py-16 text-center dark:border-slate-700 dark:bg-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <span aria-hidden="true" className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <p className="font-semibold text-on-surface dark:text-slate-100">No hay solicitudes pendientes</p>
            <p className="text-sm text-on-surface-variant dark:text-slate-400">Todos los usuarios ya tienen un rol asignado.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface dark:text-slate-100">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">filter_alt</span>
              Solicitudes pendientes de aprobación
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">search</span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Filtrar por nombre o correo…"
                  className="rounded-xl border border-outline bg-surface-container-lowest py-1.5 pl-8 pr-3 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant dark:bg-slate-700">
                Todos ({usuariosFiltrados.length})
              </span>
            </div>
          </div>

          <div className="space-y-3">
          {usuariosFiltrados.map((usuario) => (
            <div
              key={usuario.idUsuario}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
                  {letraInicial(usuario.nombre)}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-on-surface dark:text-slate-100">{usuario.nombre}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-semibold text-on-tertiary-container">
                      <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                      Sin rol
                    </span>
                    <span className="text-xs text-on-surface-variant dark:text-slate-400">Solicitada {formatFecha(usuario.fechaRegistro)}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant dark:text-slate-400">{usuario.email}</p>
                </div>
              </div>

              <button
                onClick={() => abrirModalAsignar(usuario)}
                disabled={procesandoId === usuario.idUsuario}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">person_add</span>
                {procesandoId === usuario.idUsuario ? 'Asignando…' : 'Aprobar registro y asignar rol'}
              </button>
            </div>
          ))}
          </div>
        </>
      )}

      {/* Modal para asignar rol */}
      {mostrarModal && usuarioSeleccionado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asignar-rol-titulo"
          onKeyDown={manejarTecladoModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div ref={contenidoModalRef} className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">
                {letraInicial(usuarioSeleccionado.nombre)}
              </span>
              <div>
                <h2 id="asignar-rol-titulo" className="font-bold text-on-surface dark:text-slate-100">
                  Asignar rol a {usuarioSeleccionado.nombre}
                </h2>
                <p className="text-xs text-on-surface-variant dark:text-slate-400">{usuarioSeleccionado.email}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-on-surface-variant dark:text-slate-300">
                Selecciona el rol a asignar
              </label>
              <div className="flex flex-col gap-2">
                {roles.map((rol) => (
                  <button
                    key={rol.idRol}
                    type="button"
                    onClick={() => setRolSeleccionado(rol.idRol)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      rolSeleccionado === rol.idRol
                        ? 'border-primary bg-primary-container text-on-primary-container'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {rol.nombre}
                    {rolSeleccionado === rol.idRol && (
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cerrarModalAsignar}
                className="flex-1 rounded-xl border border-outline px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={asignarRol}
                disabled={!rolSeleccionado || procesandoId !== null}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
              >
                {procesandoId ? 'Asignando…' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
