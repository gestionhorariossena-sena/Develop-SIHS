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
  const [cambioPendiente, setCambioPendiente] = useState<{ usuario: Usuario; idRol: number | null } | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Usuario[]>('/usuarios/'), apiGet<Rol[]>('/roles/')])
      .then(([listaUsuarios, listaRoles]) => {
        setUsuarios(listaUsuarios)
        setRoles(listaRoles)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          setNoAutorizado(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de usuarios.')
      })
  }, [])

  function solicitarCambioRol(usuario: Usuario, valor: string) {
    setCambioPendiente({ usuario, idRol: valor === 'none' ? null : Number(valor) })
  }

  async function confirmarCambioRol() {
    if (!cambioPendiente) return

    const { usuario, idRol: idRolNuevo } = cambioPendiente
    setError(null)
    setGuardandoId(usuario.idUsuario)

    try {
      for (const rolActual of usuario.roles) {
        await apiDelete('/usuario-rol/remover', { idUsuario: usuario.idUsuario, idRol: rolActual.idRol })
      }
      if (idRolNuevo !== null) {
        await apiPost('/usuario-rol/asignar', { idUsuario: usuario.idUsuario, idRol: idRolNuevo })
      }

      const rolNuevo = idRolNuevo === null ? undefined : roles.find((r) => r.idRol === idRolNuevo)
      setUsuarios(
        (previo) =>
          previo?.map((u) =>
            u.idUsuario === usuario.idUsuario ? { ...u, roles: rolNuevo ? [rolNuevo] : [] } : u,
          ) ?? previo,
      )
      setCambioPendiente(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el rol.')
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <AppShell activo="Usuarios">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Usuarios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">Correo</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Rol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {usuarios === null ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No hay usuarios registrados todavía.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((usuario) => (
                    <tr key={usuario.idUsuario} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{usuario.nombre}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{usuario.email}</td>
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
                          onChange={(e) => solicitarCambioRol(usuario, e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          <option value="" disabled>
                            {usuario.roles.length ? 'Selecciona un cambio' : 'Sin rol asignado'}
                          </option>
                          {usuario.roles.length > 0 && <option value="none">Quitar todos los roles</option>}
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

      {cambioPendiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-labelledby="confirmar-cambio-rol">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <h2 id="confirmar-cambio-rol" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirmar cambio de permisos</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {cambioPendiente.idRol === null
                ? `Se quitarán todos los roles de ${cambioPendiente.usuario.nombre}. Ya no podrá acceder a las funciones que dependen de ellos.`
                : `Se reemplazarán los roles actuales de ${cambioPendiente.usuario.nombre} por ${roles.find((rol) => rol.idRol === cambioPendiente.idRol)?.nombre ?? 'el rol seleccionado'}.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCambioPendiente(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
              <button type="button" onClick={() => void confirmarCambioRol()} disabled={guardandoId !== null} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{guardandoId ? 'Guardando…' : 'Confirmar cambio'}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
