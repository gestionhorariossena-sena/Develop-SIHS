import { useContext } from 'react'
import { AuthContext } from '../context/auth-context'

/** Acceso corto al contexto de sesión: `const { session, signOut } = useAuth()` */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return context
}
