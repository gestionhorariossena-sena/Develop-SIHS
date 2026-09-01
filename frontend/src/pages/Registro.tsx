import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { apiPost } from '../services/api'
import { supabase } from '../services/supabaseClient'

type RolSolicitado = 'Coordinador' | 'Instructor' | 'Aprendiz'
type TipoDocumento = 'CC' | 'CE' | 'TI' | 'PAS'

/**
 * El registro también habla directo con Supabase Auth (supabase.auth.signUp).
 * El rol elegido en el formulario NO asigna un rol real todavía — se guarda
 * como metadata del usuario (rol_solicitado) para que un Administrador lo
 * revise y lo asigne de verdad después con POST /usuario-rol/asignar (ver
 * backend/app/api/v1/usuario_rol.py). Por eso el mensaje de éxito dice
 * "quedó pendiente de aprobación" en vez de meter a la persona directo al
 * dashboard — coincide con lo que dice el mockup 02-registro.png.
 */
export function Registro() {
  const navigate = useNavigate()
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('CC')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [rol, setRol] = useState<RolSolicitado>('Coordinador')
  const [codigoInstructor, setCodigoInstructor] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [codigoFicha, setCodigoFicha] = useState('')
  const [programaFormacion, setProgramaFormacion] = useState('')
  const [aceptaPolitica, setAceptaPolitica] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (rol === 'Instructor' && (!codigoInstructor.trim() || !especialidad.trim())) {
      setError('Completa el código de instructor y la especialidad.')
      return
    }
    if (rol === 'Aprendiz' && (!codigoFicha.trim() || !programaFormacion.trim())) {
      setError('Completa el código de ficha y el programa de formación.')
      return
    }
    if (!aceptaPolitica) {
      setError('Debes aceptar el tratamiento de datos personales.')
      return
    }

    if (rol === 'Instructor') {
      setLoading(true)
      try {
        const validacion = await apiPost<{ valido: boolean; codigo: string | null; idUsuario: string | null }>(
          '/usuarios/instructor/codigo/validar',
          { codigo: codigoInstructor.trim() },
        )

        if (!validacion.valido || !validacion.idUsuario) {
          setLoading(false)
          setError('El código de instructor no es válido o no existe.')
          return
        }
      } catch {
        setLoading(false)
        setError('No se pudo validar el código de instructor en este momento.')
        return
      }
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: `${nombres.trim()} ${apellidos.trim()}`,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          tipo_documento: tipoDocumento,
          numero_documento: numeroDocumento.trim(),
          telefono: telefono.trim(),
          rol_solicitado: rol,
          ...(rol === 'Instructor' && {
            codigo_instructor: codigoInstructor.trim(),
            especialidad: especialidad.trim(),
          }),
          ...(rol === 'Aprendiz' && {
            codigo_ficha: codigoFicha.trim(),
            programa_formacion: programaFormacion.trim(),
          }),
        },
      },
    })
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/login', { state: { registroExitoso: true } })
  }

  return (
    <AuthLayout>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Crear cuenta</h1>
      <p className="mb-6 text-sm text-slate-500">
        Tu solicitud será validada por la coordinación académica del centro.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            id="nombres"
            label="Nombres"
            placeholder="Ej. Laura Camila"
            value={nombres}
            onChange={(e) => setNombres(e.target.value)}
            required
          />
          <FormField
            id="apellidos"
            label="Apellidos"
            placeholder="Ej. Restrepo Duarte"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            required
          />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tipoDocumento" className="mb-1.5 block text-sm font-medium text-slate-700">
              Tipo de documento
            </label>
            <select
              id="tipoDocumento"
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none"
            >
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="TI">Tarjeta de identidad</option>
              <option value="PAS">Pasaporte</option>
            </select>
          </div>
          <FormField
            id="numeroDocumento"
            label="Número de documento"
            inputMode="numeric"
            value={numeroDocumento}
            onChange={(e) => setNumeroDocumento(e.target.value)}
            required
          />
        </div>
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
          id="telefono"
          label="Teléfono"
          type="tel"
          placeholder="Ej. 300 123 4567"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <FormField
            id="password"
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <FormField
            id="confirmarPassword"
            label="Confirmar contraseña"
            type="password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            required
          />
        </div>

        <div className="mb-4">
          <p id="rol-label" className="mb-2 text-sm font-medium text-slate-700">
            Selecciona tu rol
          </p>
          <div role="radiogroup" aria-labelledby="rol-label" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(['Coordinador', 'Instructor', 'Aprendiz'] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={rol === opcion}
                onClick={() => setRol(opcion)}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  rol === opcion
                    ? 'border-sena-600 bg-sena-50 shadow-sm ring-1 ring-sena-600'
                    : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className="block text-base font-semibold text-slate-900">{opcion}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {opcion === 'Coordinador'
                    ? 'Programa y aprueba'
                    : opcion === 'Instructor'
                      ? 'Consulta su carga'
                      : 'Consulta su ficha'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {rol === 'Instructor' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-sena-200 bg-sena-50 px-3 py-2 text-sm text-sena-800">
              El código de instructor lo entrega la coordinación y debe coincidir con el generado
              para el registro del docente.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="codigoInstructor"
                label="Código de instructor"
                placeholder="Ej. INS-7Q3F8R"
                value={codigoInstructor}
                onChange={(e) => setCodigoInstructor(e.target.value)}
                required
              />
              <FormField
                id="especialidad"
                label="Especialidad"
                placeholder="Ej. Teleinformática"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {rol === 'Aprendiz' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id="codigoFicha"
              label="Código de ficha"
              value={codigoFicha}
              onChange={(e) => setCodigoFicha(e.target.value)}
              required
            />
            <FormField
              id="programaFormacion"
              label="Programa de formación"
              placeholder="Ej. Análisis y desarrollo de software"
              value={programaFormacion}
              onChange={(e) => setProgramaFormacion(e.target.value)}
              required
            />
          </div>
        )}

        <label className="mb-5 flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={aceptaPolitica}
            onChange={(e) => setAceptaPolitica(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sena-600"
          />
          Acepto el tratamiento de mis datos personales conforme a la política institucional del
          SENA.
        </label>

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
          {loading ? 'Enviando…' : 'Registrarme'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Ya tengo cuenta ·{' '}
        <Link to="/login" className="font-semibold text-sena-700 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
