import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiDelete, apiGet, apiPost, ApiError } from '../services/api'
import type { Rol, Usuario } from '../types/api'

const estiloEstado: Record<Usuario['estado'], string> = {
  activo: 'bg-emerald-50 text-emerald-700',
  inactivo: 'bg-slate-100 text-slate-500',
}

/**
 * Alta administrativa: quien se registra (Registro.tsx) solo deja pedido un
 * "rol_solicitado" en la metadata de Supabase Auth — acá un Administrador ve
 * a todos los usuarios con fila en la tabla "usuarios" (se crea sola en su
 * primer request autenticado, ver get_current_user en supabase_auth.py) y les
 * asigna el rol real con POST /usuario-rol/asignar. Como un usuario solo
 * tiene un rol a la vez en la práctica, cambiar de rol remueve el anterior
 * (DELETE /usuario-rol/remover) antes de asignar el nuevo.
 */
export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [roles, setRoles] = useState<Rol[]>([])
  const [error, setError] = useState<string | null>(null)
  const [noAutorizado, setNoAutorizado] = useState(false)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Usuario[]>('/usuarios/'), apiGet<Rol[]>('/roles/')])
      .then(([listaUsuarios, listaRoles]) => {
        setUsuarios(listaUsuarios)
        setRoles(listaRoles)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setNoAutorizado(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de usuarios.')
      })
  }, [])

  async function cambiarRol(usuario: Usuario, idRolNuevo: number) {
    setError(null)
    setGuardandoId(usuario.idUsuario)

    try {
      for (const rolActual of usuario.roles) {
        await apiDelete('/usuario-rol/remover', { idUsuario: usuario.idUsuario, idRol: rolActual.idRol })
      }
      await apiPost('/usuario-rol/asignar', { idUsuario: usuario.idUsuario, idRol: idRolNuevo })

      const rolNuevo = roles.find((r) => r.idRol === idRolNuevo)
      setUsuarios(
        (previo) =>
          previo?.map((u) =>
            u.idUsuario === usuario.idUsuario ? { ...u, roles: rolNuevo ? [rolNuevo] : [] } : u,
          ) ?? previo,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el rol.')
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <AppShell activo="Usuarios">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Usuarios registrados en el sistema y su rol asignado. El rol pedido al registrarse queda
          como solicitud — acá se asigna el rol real.
        </p>
      </div>

      {noAutorizado && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-800">
          Solo un Administrador puede ver y gestionar los usuarios registrados.
        </div>
      )}

      {!noAutorizado && error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!noAutorizado && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios === null ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No hay usuarios registrados todavía.
                  </td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.idUsuario} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{usuario.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{usuario.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estiloEstado[usuario.estado]}`}
                      >
                        {usuario.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={usuario.roles[0]?.idRol ?? ''}
                        disabled={guardandoId === usuario.idUsuario}
                        onChange={(e) => cambiarRol(usuario, Number(e.target.value))}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 disabled:opacity-60"
                      >
                        <option value="" disabled>
                          Sin rol asignado
                        </option>
                        {roles.map((rol) => (
                          <option key={rol.idRol} value={rol.idRol}>
                            {rol.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
