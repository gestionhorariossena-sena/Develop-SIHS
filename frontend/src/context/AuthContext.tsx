import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import { AuthContext } from './auth-context'

/** RNF-07: Tiempo de inactividad antes de expirar sesión (15 minutos) */
const INACTIVIDAD_TIMEOUT_MS = 15 * 60 * 1000

/** Tiempo de advertencia antes del logout (2 minutos antes) */
const ADVERTENCIA_ANTES_MS = 13 * 60 * 1000

/**
 * Envuelve toda la app (ver App.tsx) y mantiene la sesión de Supabase
 * sincronizada. No hace las llamadas de login/registro/logout en sí — eso
 * vive en cada página (Login.tsx, Registro.tsx) usando `supabase.auth.*`
 * directo — este contexto solo expone la sesión actual para que cualquier
 * componente sepa si hay alguien autenticado y con qué token.
 *
 * SCRUM-17: Detecta inactividad del usuario (sin mouse, keyboard, ni touch
 * events) y después de 15 minutos sin actividad, cierra la sesión
 * automáticamente. Muestra una advertencia 2 minutos antes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarAdvertencia, setMostrarAdvertencia] = useState(false)

  const temporizadorInactividadRef = useRef<number | null>(null)
  const temporizadorAdvertenciaRef = useRef<number | null>(null)
  const ultimaActividadRef = useRef<number>(Date.now())

  /** Cancela los temporizadores de inactividad */
  const cancelarTemporizadores = useCallback(() => {
    if (temporizadorInactividadRef.current) {
      window.clearTimeout(temporizadorInactividadRef.current)
      temporizadorInactividadRef.current = null
    }
    if (temporizadorAdvertenciaRef.current) {
      window.clearTimeout(temporizadorAdvertenciaRef.current)
      temporizadorAdvertenciaRef.current = null
    }
    setMostrarAdvertencia(false)
  }, [])

  /** Inicia los temporizadores de inactividad (SCRUM-17: RNF-07) */
  const reiniciarTemporizadores = useCallback(() => {
    if (!session) return

    cancelarTemporizadores()
    ultimaActividadRef.current = Date.now()

    // Mostrar advertencia después de 13 minutos (2 min antes del logout)
    temporizadorAdvertenciaRef.current = window.setTimeout(() => {
      setMostrarAdvertencia(true)
    }, ADVERTENCIA_ANTES_MS)

    // Logout automático después de 15 minutos sin actividad
    temporizadorInactividadRef.current = window.setTimeout(async () => {
      console.warn('Sesión expirada por inactividad (15 min)')
      await supabase.auth.signOut()
    }, INACTIVIDAD_TIMEOUT_MS)
  }, [session, cancelarTemporizadores])

  /** Detecta actividad del usuario (mouse, keyboard, touch) */
  const manejarActividad = useCallback(() => {
    if (!session) return
    reiniciarTemporizadores()
  }, [session, reiniciarTemporizadores])

  /** Auto-logout cuando se presione "Cerrar sesión" en la advertencia */
  async function cerrarSesionAhora() {
    cancelarTemporizadores()
    await supabase.auth.signOut()
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        reiniciarTemporizadores()
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        reiniciarTemporizadores()
      } else {
        cancelarTemporizadores()
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [reiniciarTemporizadores, cancelarTemporizadores])

  /** Listeners de actividad: detectan mouse, keyboard y touch (SCRUM-17) */
  useEffect(() => {
    if (!session) return

    window.addEventListener('mousedown', manejarActividad)
    window.addEventListener('keydown', manejarActividad)
    window.addEventListener('touchstart', manejarActividad)
    window.addEventListener('mousemove', manejarActividad)

    return () => {
      window.removeEventListener('mousedown', manejarActividad)
      window.removeEventListener('keydown', manejarActividad)
      window.removeEventListener('touchstart', manejarActividad)
      window.removeEventListener('mousemove', manejarActividad)
      cancelarTemporizadores()
    }
  }, [session, manejarActividad, cancelarTemporizadores])

  async function signOut() {
    cancelarTemporizadores()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}

      {/* Advertencia antes de logout (SCRUM-17: RNF-07) */}
      {mostrarAdvertencia && session && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900 dark:bg-slate-800">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-5 w-5"
                >
                  <path d="M12 2a10 10 0 1 0 10 10H12V2" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">¿Aún estás ahí?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tu sesión se cerrará automáticamente en 2 minutos por inactividad.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  cancelarTemporizadores()
                  reiniciarTemporizadores()
                }}
                className="flex-1 rounded-lg bg-sena-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sena-700"
              >
                Continuar usando
              </button>
              <button
                onClick={cerrarSesionAhora}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}
