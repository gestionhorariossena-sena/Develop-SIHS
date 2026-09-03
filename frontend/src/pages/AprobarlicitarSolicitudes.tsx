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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900">Acceso denegado</h1>
            <p className="mt-1 text-sm text-slate-500">
              Solo un Administrador puede aprobar solicitudes de registro.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activo="Aprobar solicitudes de registro">
      {/* Encabezado */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sena-50 text-sena-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9.75 12 15.5l-2.25-2.25M4.5 6h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aprobar solicitudes de registro</h1>
          <p className="text-sm text-slate-500">
            Usuarios que ya se registraron y están a la espera de que les asignes un rol.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {usuariosSinRol.length} pendiente{usuariosSinRol.length !== 1 ? 's' : ''} de aprobación
        </span>
      </div>

      {/* Mensaje de éxito */}
      {mensajeExito && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          {mensajeExito}
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Tabla de solicitudes */}
      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
          </svg>
          Cargando solicitudes…
        </div>
      ) : usuariosSinRol.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">No hay solicitudes pendientes</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Todos los usuarios ya tienen un rol asignado.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">Usuario</th>
                <th scope="col" className="px-4 py-3">Solicitado</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {usuariosSinRol.map((usuario) => (
                <tr key={usuario.idUsuario} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sena-100 text-sm font-semibold text-sena-700">
                        {letraInicial(usuario.nombre)}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{usuario.nombre}</p>
                        <p className="text-slate-500 dark:text-slate-400">{usuario.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatFecha(usuario.fechaRegistro)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Sin rol
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirModalAsignar(usuario)}
                      disabled={procesandoId === usuario.idUsuario}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sena-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM3 19.5a6.5 6.5 0 0 1 11.34-4.33" />
                      </svg>
                      {procesandoId === usuario.idUsuario ? 'Asignando…' : 'Asignar rol'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <div ref={contenidoModalRef} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sena-100 text-sm font-semibold text-sena-700">
                {letraInicial(usuarioSeleccionado.nombre)}
              </span>
              <div>
                <h2 id="asignar-rol-titulo" className="font-bold text-slate-900 dark:text-slate-100">
                  Asignar rol a {usuarioSeleccionado.nombre}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{usuarioSeleccionado.email}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Selecciona el rol a asignar
              </label>
              <div className="flex flex-col gap-2">
                {roles.map((rol) => (
                  <button
                    key={rol.idRol}
                    type="button"
                    onClick={() => setRolSeleccionado(rol.idRol)}
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      rolSeleccionado === rol.idRol
                        ? 'border-sena-600 bg-sena-50 text-sena-700 dark:bg-sena-950/50'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {rol.nombre}
                    {rolSeleccionado === rol.idRol && (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={cerrarModalAsignar}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={asignarRol}
                disabled={!rolSeleccionado || procesandoId !== null}
                className="flex-1 rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-50"
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
