import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { apiGet } from '../services/api'
import type { Usuario } from '../types/api'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: string[]
}

/**
 * Protege una página para usuarios autenticados.
 * Si se especifican roles, también verifica que el usuario tenga
 * al menos uno de los roles requeridos.
 */
export function ProtectedRoute({
  children,
  roles,
}: ProtectedRouteProps) {
  const { session, loading } = useAuth()

  const requiereRol = Boolean(roles?.length)

  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [loadingPerfil, setLoadingPerfil] = useState(requiereRol)

  const rolesKey = roles?.join('|') ?? ''

  useEffect(() => {
    if (!session || !requiereRol) {
      return
    }

    let cancelado = false

    apiGet<Usuario>('/usuarios/me')
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
  }, [session, requiereRol, rolesKey])

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
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}