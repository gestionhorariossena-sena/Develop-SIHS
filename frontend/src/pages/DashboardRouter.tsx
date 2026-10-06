import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import type { Usuario } from '../types/api'
import { Dashboard } from './Dashboard'
import { DashboardAprendiz } from './DashboardAprendiz'
import { DashboardInstructor } from './DashboardInstructor'

/**
 * Punto de entrada de /dashboard: elige qué "home" mostrar según el rol
 * del usuario autenticado, para no dispararle a un Aprendiz ni a un
 * Instructor los fetches de gestión (`/horarios/`, `/usuarios/`, etc.)
 * que hace Dashboard.tsx y para los que no tienen permiso.
 *
 * Mientras se resuelve el perfil se muestra "Cargando…", NO Dashboard.tsx
 * directamente — Dashboard.tsx dispara de una sus propios fetches sin
 * esperar a saber el rol, así que un Instructor puro veía un "No
 * autorizado" de esas llamadas por un instante en cada navegación de
 * vuelta a /dashboard (ej. desde "Mi horario" con el ítem "Inicio" del
 * navbar), antes de que el rol resolviera y recién ahí cambiara a
 * DashboardInstructor.
 *
 * Si falla el fetch de perfil, cae en Dashboard.tsx — falla abierto,
 * mismo criterio que ProtectedRoute.tsx.
 */
export function DashboardRouter() {
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false

    apiGet<Usuario>('/usuarios/me')
      .then((datos) => {
        if (!cancelado) setPerfil(datos)
      })
      .catch(() => {
        if (!cancelado) setError(true)
      })

    return () => {
      cancelado = true
    }
  }, [])

  if (!perfil) {
    if (error) return <Dashboard />

    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  // T-12: un usuario recién registrado (get_current_user lo crea en su
  // primer login, ver supabase_auth.py) no tiene rol todavía -- caía antes
  // en Dashboard.tsx, que dispara fetches de gestión (/horarios/,
  // /usuarios/, etc.) para los que no tiene permiso y solo mostraba
  // errores "No se pudo cargar...". Mientras un Administrador no le
  // asigne un rol (Usuarios.tsx / AprobarlicitarSolicitudes.tsx), ve este
  // aviso en vez de una pantalla rota.
  if (perfil.roles.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-900">
        <div className="max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h1 className="mb-2 text-lg font-semibold text-on-surface dark:text-slate-100">Cuenta pendiente de aprobación</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">
            Tu cuenta ya está creada, pero todavía no tiene un rol asignado. Un Administrador debe
            asignarte uno antes de que puedas usar el sistema.
          </p>
        </div>
      </div>
    )
  }

  const puedeGestionar = perfil.roles.some((rol) => rol.nombre === 'Administrador' || rol.nombre === 'Coordinador')
  const esInstructor = perfil.roles.some((rol) => rol.nombre === 'Instructor')
  const esAprendiz = perfil.roles.some((rol) => rol.nombre === 'Aprendiz')

  // El orden importa: quien además tiene rol de gestión ve Dashboard.tsx,
  // que es el home más completo. Solo un Aprendiz/Instructor "puro" cae en
  // su home de autoservicio.
  if (esAprendiz && !puedeGestionar && !esInstructor) return <DashboardAprendiz />
  if (esInstructor && !puedeGestionar) return <DashboardInstructor />

  return <Dashboard esAdministrador={perfil.roles.some((rol) => rol.nombre === 'Administrador')} />
}
