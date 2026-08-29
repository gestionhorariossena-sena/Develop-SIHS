import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPost, ApiError } from '../services/api'
import type { Rol, Usuario } from '../types/api'

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

  // Cargar usuarios sin rol y lista de roles
  useEffect(() => {
    setCargando(true)
    setError(null)

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

      // Remover usuario de la lista
      setUsuariosSinRol((prev) =>
        prev.filter((u) => u.idUsuario !== usuarioSeleccionado.idUsuario)
      )

      setMostrarModal(false)
      setUsuarioSeleccionado(null)
      setRolSeleccionado(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al asignar rol')
    } finally {
      setProcesandoId(null)
    }
  }

  if (noAutorizado) {
    return (
      <AppShell activo="Aprobar solicitudes de registro">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Acceso denegado</h1>
            <p className="text-slate-600 mt-2">
              No tienes permisos para acceder a esta página.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activo="Aprobar solicitudes de registro">
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Encabezado */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Aprobar solicitudes de registro</h1>
            <p className="text-slate-600 mt-2">
              {usuariosSinRol.length} usuario{usuariosSinRol.length !== 1 ? 's' : ''} pendiente{usuariosSinRol.length !== 1 ? 's' : ''} de aprobación
            </p>
          </div>

          {/* Mensajes de error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Tabla de solicitudes */}
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-600">Cargando solicitudes...</p>
            </div>
          ) : usuariosSinRol.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
              <p className="text-emerald-700 font-medium">
                ✓ No hay solicitudes pendientes
              </p>
              <p className="text-emerald-600 text-sm mt-1">
                Todos los usuarios ya tienen un rol asignado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosSinRol.map((usuario) => (
                    <tr
                      key={usuario.idUsuario}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {usuario.nombre}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {usuario.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                          Sin rol
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => abrirModalAsignar(usuario)}
                          disabled={procesandoId === usuario.idUsuario}
                          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {procesandoId === usuario.idUsuario ? 'Asignando...' : 'Asignar rol'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal para asignar rol */}
        {mostrarModal && usuarioSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Asignar rol a {usuarioSeleccionado.nombre}
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Selecciona un rol
                </label>
                <select
                  value={rolSeleccionado || ''}
                  onChange={(e) => setRolSeleccionado(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Selecciona un rol --</option>
                  {roles.map((rol) => (
                    <option key={rol.idRol} value={rol.idRol}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={asignarRol}
                  disabled={!rolSeleccionado || procesandoId !== null}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Asignar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
