import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Usuario } from '../types/api'

/**
 * Lista de solo lectura de los códigos de instructor ya emitidos —
 * "Código de instructor: completar el flujo frontend y vincularlo a un
 * trimestre". No pide nada nuevo al backend: usa GET /usuarios/ (mismo
 * endpoint que Usuarios.tsx, admin-only) y filtra los que tienen rol
 * Instructor, igual que ya hacía Usuarios.tsx antes de este cambio.
 *
 * El código ya no se genera acá — se dispara solo al aprobar el rol
 * Instructor en AprobarlicitarSolicitudes.tsx, y queda fijo una vez
 * creado (UsuarioService.generar_codigo_instructor es idempotente).
 */
export function CodigoInstructor() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noAutorizado, setNoAutorizado] = useState(false)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Usuario[]>('/usuarios/')
      .then(setUsuarios)
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          setNoAutorizado(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de instructores.')
      })
  }, [])

  const instructores = usuarios?.filter((usuario) =>
    usuario.roles.some((rol) => rol.nombre === 'Instructor'),
  ) ?? []

  async function copiar(idUsuario: string, codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiadoId(idUsuario)
      setTimeout(() => setCopiadoId((previo) => (previo === idUsuario ? null : previo)), 2000)
    } catch {
      // No bloquea la experiencia si el navegador no permite copiar.
    }
  }

  return (
    <AppShell activo="Código de instructor">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Código de instructor</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Código único de cada instructor, generado automáticamente al aprobar su rol. Es fijo — no
          se regenera.
        </p>
      </div>

      {noAutorizado && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-800">
          Solo un Administrador puede ver los códigos de instructor.
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
                <th scope="col" className="px-4 py-3">Código</th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {usuarios === null ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : instructores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No hay instructores registrados todavía.
                  </td>
                </tr>
              ) : (
                instructores.map((instructor) => (
                  <tr key={instructor.idUsuario} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{instructor.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{instructor.email}</td>
                    <td className="px-4 py-3">
                      {instructor.codigoInstructor ? (
                        <span className="rounded-full border border-sena-200 bg-sena-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-sena-700 dark:border-sena-700 dark:bg-sena-950/50 dark:text-sena-300">
                          {instructor.codigoInstructor}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">Sin código aún</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {instructor.codigoInstructor && (
                        <button
                          type="button"
                          onClick={() => copiar(instructor.idUsuario, instructor.codigoInstructor as string)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {copiadoId === instructor.idUsuario ? 'Copiado' : 'Copiar'}
                        </button>
                      )}
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
