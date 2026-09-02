import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Envuelve una página que exige sesión iniciada. Si no hay sesión, manda a /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">Cargando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
