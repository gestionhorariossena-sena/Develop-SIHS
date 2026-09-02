import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { supabase } from '../services/supabaseClient'

type Paso = 'codigo' | 'nueva-contrasena'

/**
 * Segundo paso de "Olvidé mi contraseña" (el primero es
 * RecuperarContrasena.tsx, que dispara supabase.auth.resetPasswordForEmail).
 * Acá se recibe el código de 6 dígitos que llega al correo y se valida con
 * supabase.auth.verifyOtp(type: 'recovery') — eso abre una sesión temporal
 * de recuperación, que se usa para fijar la contraseña nueva con
 * supabase.auth.updateUser. Todo contra Supabase Auth directo, igual que
 * Login/Registro — no hay llamada al backend acá.
 *
 * Requiere que la plantilla de correo "Reset Password" en Supabase Auth
 * incluya `{{ .Token }}` (no solo el `{{ .ConfirmationURL }}`), si no el
 * correo trae link pero no código.
 */
export function RestablecerContrasena() {
  const navigate = useNavigate()
  const location = useLocation()
  const emailInicial = (location.state as { email?: string } | null)?.email ?? ''

  const [paso, setPaso] = useState<Paso>('codigo')
  const [email, setEmail] = useState(emailInicial)
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleVerificarCodigo(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: codigo,
      type: 'recovery',
    })

    setLoading(false)

    if (authError) {
      setError('Código inválido o vencido. Verifica el correo o solicita uno nuevo.')
      return
    }

    setPaso('nueva-contrasena')
  }

  async function handleCambiarContrasena(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/dashboard')
  }

  return (
    <AuthLayout>
      <div className="mb-5 flex justify-center">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-sena-50 text-sena-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-7 w-7"
          >
            <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v2" />
          </svg>
        </div>
      </div>

      {paso === 'codigo' ? (
        <>
          <h1 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
            Ingresa el código
          </h1>
          <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Escribe el código de verificación de 6 dígitos que enviamos a tu correo.
          </p>

          <form onSubmit={handleVerificarCodigo}>
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
              id="codigo"
              label="Código de verificación"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
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
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
            ¿No te llegó nada?{' '}
            <Link to="/recuperar-contrasena" className="font-medium text-sena-700 hover:underline">
              Solicita un código nuevo
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
            Crea tu nueva contraseña
          </h1>
          <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Código verificado. Ahora define la contraseña con la que vas a iniciar sesión.
          </p>

          <form onSubmit={handleCambiarContrasena}>
            <FormField
              id="password"
              label="Nueva contraseña"
              type="password"
              placeholder="••••••••••"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <FormField
              id="confirmarPassword"
              label="Confirmar contraseña"
              type="password"
              placeholder="••••••••••"
              minLength={6}
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
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
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm font-semibold text-sena-700 dark:border-slate-700">
        <Link to="/login" className="hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
