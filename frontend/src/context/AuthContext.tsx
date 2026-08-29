import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import { AuthContext } from './auth-context'

/**
 * Envuelve toda la app (ver App.tsx) y mantiene la sesión de Supabase
 * sincronizada. No hace las llamadas de login/registro/logout en sí — eso
 * vive en cada página (Login.tsx, Registro.tsx) usando `supabase.auth.*`
 * directo — este contexto solo expone la sesión actual para que cualquier
 * componente sepa si hay alguien autenticado y con qué token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>{children}</AuthContext.Provider>
  )
}
