import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { supabase } from '../services/supabaseClient'

/**
 * El login habla directo con Supabase Auth (supabase.auth.signInWithPassword),
 * NO con el backend — así es como está pensada la arquitectura: Supabase
 * hace la autenticación, el backend confía en el token que ella emite. Una
 * vez hay sesión, el resto de páginas (Dashboard) sí llaman al backend
 * usando ese token — ver src/services/api.ts.
 */
export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (authError) {
      setError('Correo o contraseña incorrectos.')
      return
    }

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
          onChange={(e) => setEmail(e.target.value)}
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

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sena-600 py-3 font-semibold text-white transition hover:bg-sena-700 disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
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
