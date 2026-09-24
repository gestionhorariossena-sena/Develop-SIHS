import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getPerfil } from '../services/perfil'
import type { Usuario } from '../types/api'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: string[]
}

/**
 * Protege una página para usuarios autenticados.
 * Si se especifican roles, también verifica que el usuario tenga
 * al menos uno de los roles requeridos.
 *
 * Sin `roles` la pantalla queda abierta a cualquier sesión — reservarlo
 * para las que ya reparten por rol adentro (`/dashboard`). Toda ruta
 * privada nueva debería declarar los suyos: hasta H-5 ninguna lo hacía y
 * cualquiera llegaba escribiendo la URL a pantallas que no podía usar,
 * para toparse con un 403 del backend a mitad de un formulario.
 *
 * El perfil se pide por `getPerfil()` (cacheado por sesión) y no con un
 * apiGet suelto: esto corre en CADA navegación.
 */
export function ProtectedRoute({
  children,
  roles,
}: ProtectedRouteProps) {
  const { session, loading } = useAuth()

  const requiereRol = Boolean(roles?.length)

  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [loadingPerfil, setLoadingPerfil] = useState(requiereRol)

  const idUsuario = session?.user?.id ?? ''

  useEffect(() => {
    if (!idUsuario || !requiereRol) {
      return
    }

    // `loadingPerfil` ya arranca en true cuando la ruta pide roles, y este
    // componente se monta de nuevo en cada navegación: no hace falta
    // volver a ponerlo acá.
    let cancelado = false

    getPerfil(idUsuario)
      .then((usuario) => {
        if (!cancelado) {
          setPerfil(usuario)
        }
      })
      .catch(() => {
        if (!cancelado) {
          setPerfil(null)
        }
      })
      .finally(() => {
        if (!cancelado) {
          setLoadingPerfil(false)
        }
      })

    return () => {
      cancelado = true
    }
  }, [idUsuario, requiereRol])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!requiereRol) {
    return <>{children}</>
  }

  if (loadingPerfil) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  const tieneRolRequerido =
    perfil?.roles.some((rol) => roles?.includes(rol.nombre)) ?? false

  if (!tieneRolRequerido) {
    // A /dashboard, que ya reparte por rol (DashboardRouter.tsx) y manda a
    // un Aprendiz a su propia pantalla. Es una puerta cerrada, no un error:
    // la persona acaba donde sí puede trabajar.
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
