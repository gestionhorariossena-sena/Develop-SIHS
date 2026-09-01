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
  const [codigosInstructor, setCodigosInstructor] = useState<string[]>([])
  const [codigoActual, setCodigoActual] = useState<string | null>(null)
  const [idInstructorSeleccionado, setIdInstructorSeleccionado] = useState('')
  const instructores = usuarios?.filter((usuario) =>
    usuario.roles.some((rol) => rol.nombre === 'Instructor'),
  ) ?? []

  async function generarCodigoInstructor() {
    if (!idInstructorSeleccionado) {
      setError('Selecciona el instructor para quien deseas generar el código.')
      return
    }

    try {
      const resultado = await apiPost<{ codigo: string; idUsuario: string }>(
        '/usuarios/instructor/codigo/generar',
        { idUsuario: idInstructorSeleccionado },
      )

      setCodigosInstructor((previo) =>
        previo.includes(resultado.codigo) ? previo : [...previo, resultado.codigo],
      )
      setCodigoActual(resultado.codigo)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el código del instructor.')
    }
  }

  async function copiarCodigo() {
    if (!codigoActual) return

    try {
      await navigator.clipboard.writeText(codigoActual)
    } catch {
      // No bloquea la experiencia si el navegador no permite copiar.
    }
  }

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
        <>
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Generar código único de instructor</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Selecciona el instructor que recibirá el código para registrarse en el formulario de acceso.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <label className="sr-only" htmlFor="instructor-codigo">
                  Instructor para el código
                </label>
                <select
                  id="instructor-codigo"
                  value={idInstructorSeleccionado}
                  onChange={(evento) => setIdInstructorSeleccionado(evento.target.value)}
                  disabled={usuarios === null || instructores.length === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">
                    {usuarios === null
                      ? 'Cargando instructores…'
                      : instructores.length === 0
                        ? 'No hay instructores disponibles'
                        : 'Selecciona un instructor'}
                  </option>
                  {instructores.map((instructor) => (
                    <option key={instructor.idUsuario} value={instructor.idUsuario}>
                      {instructor.nombre} · {instructor.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={generarCodigoInstructor}
                  disabled={!idInstructorSeleccionado}
                  className="rounded-lg bg-sena-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generar código
                </button>
              </div>
            </div>

            {codigoActual && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-sena-200 bg-sena-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-sena-700 dark:bg-sena-950/50">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sena-700">Código generado</p>
                  <p className="mt-1 text-2xl font-bold tracking-[0.18em] text-slate-900 dark:text-slate-100">{codigoActual}</p>
                </div>

                <button
                  type="button"
                  onClick={copiarCodigo}
                  className="rounded-lg border border-sena-300 bg-white px-3 py-2 text-sm font-medium text-sena-700 hover:bg-sena-100 dark:border-sena-700 dark:bg-slate-800 dark:hover:bg-sena-950/50"
                >
                  Copiar
                </button>
              </div>
            )}

            {codigosInstructor.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Códigos emitidos</p>
                <div className="flex flex-wrap gap-2">
                  {codigosInstructor.map((codigo) => (
                    <span
                      key={codigo}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {codigo}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                          onChange={(e) => cambiarRol(usuario, Number(e.target.value))}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
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
        </>
      )}
    </AppShell>
  )
}
