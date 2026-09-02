import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { supabase } from '../services/supabaseClient'

/** También va directo a Supabase Auth (resetPasswordForEmail) — el envío
 * del correo de recuperación lo maneja Supabase, no el backend. El correo
 * trae un código de 6 dígitos que se valida en
 * RestablecerContrasena.tsx (supabase.auth.verifyOtp), no un link que
 * redirija de vuelta a la app. */
export function RecuperarContrasena() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email)

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setEnviado(true)
  }

  return (
    <AuthLayout>
      <div className="mb-5 flex justify-center">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-sena-50 text-sena-700 dark:bg-sena-950/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-7 w-7"
          >
            <path d="M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          </svg>
        </div>
      </div>

      <h1 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-slate-100">Recuperar contraseña</h1>
      <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Ingresa tu correo institucional y te enviaremos las instrucciones para restablecer el
        acceso.
      </p>

      {enviado ? (
        <div>
          <p className="mb-4 rounded-lg bg-sena-50 p-4 text-center text-sm text-sena-700 dark:bg-sena-950/50">
            Si el correo existe en el sistema, te llegará un código de verificación en unos
            minutos.
          </p>
          <button
            type="button"
            onClick={() => navigate('/restablecer-contrasena', { state: { email } })}
            className="w-full rounded-lg bg-sena-700 py-3 font-semibold text-white transition hover:bg-sena-800"
          >
            Ya tengo mi código
          </button>
        </div>
      ) : (
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

          {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sena-700 py-3 font-semibold text-white transition hover:bg-sena-800 disabled:opacity-60"
          >
            {loading ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
        El código es válido por 30 minutos y de un solo uso.
      </p>

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm font-semibold text-sena-700 dark:border-slate-700">
        <Link to="/login" className="hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
