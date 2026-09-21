import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import type { Usuario } from '../types/api'
import { Dashboard } from './Dashboard'
import { DashboardAprendiz } from './DashboardAprendiz'

type EstadoRol = 'cargando' | 'aprendiz' | 'otro'

/**
 * Punto de entrada de /dashboard: elige qué "home" mostrar según el rol
 * del usuario autenticado, para no dispararle a un Aprendiz los fetches
 * de gestión (`/horarios/`, `/usuarios/`, etc.) que hace Dashboard.tsx y
 * para los que no tiene permiso.
 *
 * Hoy solo distingue Aprendiz (DashboardAprendiz.tsx) del resto
 * (Dashboard.tsx, pensado para Coordinador/Administrador) -- todavía no
 * existe un DashboardInstructor.tsx en este repo, así que un Instructor
 * cae en Dashboard.tsx por ahora, igual que antes de este ticket. Si se
 * agrega esa variante más adelante, sumar la rama acá con el mismo
 * patrón (otro `if` antes del `return` final).
 *
 * Si falla el fetch de perfil, cae en Dashboard.tsx -- falla abierto,
 * mismo criterio que ProtectedRoute.tsx.
 */
export function DashboardRouter() {
  const [estado, setEstado] = useState<EstadoRol>('cargando')

  useEffect(() => {
    let cancelado = false

    apiGet<Usuario>('/usuarios/me')
      .then((perfil) => {
        if (cancelado) return
        const esAprendiz = perfil.roles.some((rol) => rol.nombre === 'Aprendiz')
        setEstado(esAprendiz ? 'aprendiz' : 'otro')
      })
      .catch(() => {
        if (!cancelado) setEstado('otro')
      })

    return () => {
      cancelado = true
    }
  }, [])

  if (estado === 'cargando') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  return estado === 'aprendiz' ? <DashboardAprendiz /> : <Dashboard />
}
