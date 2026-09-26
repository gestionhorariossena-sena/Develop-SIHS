import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { apiPatch, ApiError } from '../services/api'
import { supabase } from '../services/supabaseClient'

/**
 * Pantalla obligatoria tras iniciar sesión con una credencial temporal
 * (usuarios.debe_cambiar_clave === true, ver ProtectedRoute.tsx, que es
 * quien redirige acá y bloquea cualquier otra ruta mientras el flag siga
 * en true). A diferencia de RestablecerContrasena.tsx (recuperación de
 * contraseña olvidada, sin sesión, con código de 6 dígitos por correo),
 * acá ya hay una sesión de Supabase válida — solo hace falta
 * supabase.auth.updateUser({ password }) y, si eso funciona, limpiar el
 * flag en el backend con PATCH /usuarios/me/confirmar-cambio-clave.
 */
export function CambiarClaveObligatorio() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error: authError } = await supabase.auth.updateUser({ password })

    if (authError) {
      setLoading(false)
      setError(authError.message)
      return
    }

    try {
      await apiPatch('/usuarios/me/confirmar-cambio-clave')
    } catch (err) {
      setLoading(false)
      // La contraseña ya quedó cambiada en Supabase Auth -- si esto
      // falla, el usuario puede seguir (ProtectedRoute solo lo volvería
      // a mandar acá si vuelve a ver debeCambiarClave=true, y ya podrá
      // entrar con la contraseña nueva la próxima vez).
      setError(err instanceof ApiError ? err.message : 'La contraseña se guardó, pero hubo un problema confirmando el cambio. Intenta iniciar sesión de nuevo.')
      return
    }

    setLoading(false)
    navigate('/dashboard', { replace: true })
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
            <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v2" />
          </svg>
        </div>
      </div>

      <h1 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
        Establece tu contraseña
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Tu cuenta se creó con una contraseña temporal. Por seguridad, define una nueva antes de continuar —
        no podrás usar el resto de SIHS hasta hacerlo.
      </p>

      <form onSubmit={handleSubmit}>
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
          {loading ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </AuthLayout>
  )
}
