import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { apiGet } from '../services/api'
import type { Usuario } from '../types/api'

const RUTA_CAMBIO_CLAVE_OBLIGATORIO = '/cambiar-clave-obligatorio'

/**
 * Envuelve una página que exige sesión iniciada. Si no hay sesión, manda a
 * /login. Si el perfil trae debeCambiarClave=true (credencial temporal sin
 * cambiar, ver usuarios.debe_cambiar_clave), redirige a
 * CambiarClaveObligatorio.tsx en vez de dejar entrar a cualquier otra ruta
 * protegida -- es el único choque de gate para esto, así que no hace falta
 * repetir el chequeo en cada página nueva.
 *
 * El fetch de perfil falla "abierto" (no bloquea navegación) si
 * GET /usuarios/me falla por algo que no sea el propio flag -- esto es una
 * guía de UX, no el límite de seguridad real (ese lo sigue poniendo la
 * sesión de Supabase).
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(true)

  useEffect(() => {
    // Sin sesión no hay perfil que pedir -- `cargandoPerfil` ni se
    // consulta en ese caso (ver el `session &&` de más abajo), así que no
    // hace falta tocarlo acá (evita un setState síncrono al inicio del
    // efecto, que dispararía la regla react-hooks/set-state-in-effect).
    if (!session) return

    let cancelado = false

    apiGet<Usuario>('/usuarios/me')
      .then((datos) => {
        if (!cancelado) setPerfil(datos)
      })
      .catch(() => {
        if (!cancelado) setPerfil(null)
      })
      .finally(() => {
        if (!cancelado) setCargandoPerfil(false)
      })

    return () => {
      cancelado = true
    }
  }, [session])

  if (loading || (session && cargandoPerfil)) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">Cargando…</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const debeCambiarClave = perfil?.debeCambiarClave ?? false
  if (debeCambiarClave && location.pathname !== RUTA_CAMBIO_CLAVE_OBLIGATORIO) {
    return <Navigate to={RUTA_CAMBIO_CLAVE_OBLIGATORIO} replace />
  }

  return <>{children}</>
}
