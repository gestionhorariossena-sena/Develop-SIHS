import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { apiGet, apiPost } from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { EstadoLogin } from '../types/api'

function formatearTiempoRestante(segundos: number): string {
  const minutos = Math.ceil(segundos / 60)
  return minutos <= 1 ? 'menos de 1 minuto' : `${minutos} minutos`
}

/**
 * El login habla directo con Supabase Auth (supabase.auth.signInWithPassword),
 * NO con el backend para autenticar — así es como está pensada la
 * arquitectura: Supabase hace la autenticación, el backend confía en el
 * token que ella emite. Una vez hay sesión, el resto de páginas (Dashboard)
 * sí llaman al backend usando ese token — ver src/services/api.ts.
 *
 * RF-001/RNF-06 (bloqueo tras 3 intentos fallidos) sí necesita al backend:
 * como Supabase Auth no nos avisa de intentos fallidos, este componente
 * consulta GET /auditoria/estado-login ANTES de intentar el login (para no
 * dejar seguir si ya se gastaron los intentos) y llama a
 * POST /auditoria/intento-fallido-login después de cada fallo (para que
 * quede contado). Ambos endpoints son públicos a propósito — ver
 * backend/app/api/v1/auditoria.py.
 */
export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [segundosParaDesbloqueo, setSegundosParaDesbloqueo] = useState<number | null>(null)

  // Reactiva el formulario solo cuando pasa el tiempo de bloqueo — sin
  // esto, el usuario tendría que recargar la página o tocar el campo de
  // correo para poder reintentar aunque ya se haya cumplido la espera.
  useEffect(() => {
    if (!bloqueado || segundosParaDesbloqueo == null) return

    const id = setTimeout(() => {
      setBloqueado(false)
      setError(null)
    }, segundosParaDesbloqueo * 1000)

    return () => clearTimeout(id)
  }, [bloqueado, segundosParaDesbloqueo])

  function marcarBloqueado(estado: EstadoLogin) {
    setBloqueado(true)
    setSegundosParaDesbloqueo(estado.segundosParaDesbloqueo ?? 0)
    setError(`Demasiados intentos fallidos. Volvé a intentar en ${formatearTiempoRestante(estado.segundosParaDesbloqueo ?? 0)}.`)
  }

  async function consultarEstadoLogin(identificador: string): Promise<EstadoLogin | null> {
    try {
      return await apiGet<EstadoLogin>(`/auditoria/estado-login?identificador=${encodeURIComponent(identificador)}`)
    } catch {
      // Si el backend no responde, no bloqueamos el login por eso — el
      // peor caso es que el conteo de intentos no funcione esta vez, no
      // que nadie pueda iniciar sesión.
      return null
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const estadoPrevio = await consultarEstadoLogin(email)

    if (estadoPrevio?.bloqueado) {
      marcarBloqueado(estadoPrevio)
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      apiPost('/auditoria/intento-fallido-login', { identificador: email }).catch(() => {})

      const estadoActual = await consultarEstadoLogin(email)
      setLoading(false)

      if (estadoActual?.bloqueado) {
        marcarBloqueado(estadoActual)
        return
      }

      const intentosRestantes = estadoActual?.intentosRestantes
      setError(
        intentosRestantes != null
          ? `Correo o contraseña incorrectos. Te quedan ${intentosRestantes} ${intentosRestantes === 1 ? 'intento' : 'intentos'}.`
          : 'Correo o contraseña incorrectos.',
      )
      return
    }

    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <AuthLayout>
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Iniciar sesión</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Acceso exclusivo para coordinadores e instructores del Centro de Gestión de Mercados,
        Logística y TI.
      </p>

      <form onSubmit={handleSubmit}>
        <FormField
          id="email"
          label="Correo institucional"
          type="email"
          placeholder="nombre.apellido@sena.edu.co"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            // Si cambia el correo, no tiene sentido seguir mostrando el
            // bloqueo del intento anterior — se vuelve a chequear en el
            // próximo submit.
            setBloqueado(false)
          }}
          required
        />
        <FormField
          id="password"
          label="Contraseña"
          type="password"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="mb-5 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 bg-white text-sena-600 dark:border-slate-700 dark:bg-slate-900" />
            Recordarme
          </label>
          <Link to="/recuperar-contrasena" className="font-medium text-sena-700 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || bloqueado}
          className="w-full rounded-lg bg-sena-700 py-3 font-semibold text-white transition hover:bg-sena-800 disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : bloqueado ? 'Cuenta bloqueada temporalmente' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="font-semibold text-sena-700 hover:underline">
          Solicita registro
        </Link>
      </p>
    </AuthLayout>
  )
}
