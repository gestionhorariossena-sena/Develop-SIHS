import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { FormField } from '../components/FormField'
import { apiPost, ApiError } from '../services/api'
import { supabase } from '../services/supabaseClient'

type RolSolicitado = 'Instructor' | 'Aprendiz'
type TipoDocumento = 'CC' | 'CE' | 'TI' | 'PAS'

/**
 * El registro también habla directo con Supabase Auth (supabase.auth.signUp).
 * El rol elegido en el formulario NO asigna un rol real todavía — se guarda
 * como metadata del usuario (rol_solicitado) para que un Administrador lo
 * revise y lo asigne de verdad después con POST /usuario-rol/asignar (ver
 * backend/app/api/v1/usuario_rol.py). Por eso el mensaje de éxito dice
 * "quedó pendiente de aprobación" en vez de meter a la persona directo al
 * dashboard — coincide con lo que dice el mockup 02-registro.png.
 *
 * "Coordinador" salió de este selector (pedido 2026-09-07): un registro
 * directo con contraseña propia era demasiado abierto para un rol que
 * administra el resto del sistema. En su lugar, "¿Eres coordinador?
 * Solicita acceso" abre un formulario corto (nombre, correo, documento,
 * motivo) que llama a `POST /solicitudes-acceso/` — endpoint público del
 * ticket "[Backend] Endpoints /solicitudes-acceso" (mismo Epic SCRUM-96).
 * Este paso NO crea cuenta de Supabase Auth: solo registra la solicitud
 * para que un Administrador la apruebe desde el Panel de Administración,
 * que es quien de verdad crea la cuenta y envía la credencial temporal.
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
  const [rol, setRol] = useState<RolSolicitado>('Instructor')
  const [codigoInstructor, setCodigoInstructor] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [codigoFicha, setCodigoFicha] = useState('')
  const [programaFormacion, setProgramaFormacion] = useState('')
  const [aceptaPolitica, setAceptaPolitica] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [mostrarSolicitudCoordinador, setMostrarSolicitudCoordinador] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!numeroDocumento.trim()) {
      setError('El número de documento es obligatorio.')
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
      <h1 className="mb-2 text-2xl font-bold text-on-surface dark:text-slate-100">Crear cuenta</h1>
      <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
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
            <label htmlFor="tipoDocumento" className="mb-1.5 block text-sm font-medium text-on-surface-variant dark:text-slate-300">
              Tipo de documento
            </label>
            <select
              id="tipoDocumento"
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
              className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3.5 py-2.5 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          <p id="rol-label" className="mb-2 text-sm font-medium text-on-surface-variant dark:text-slate-300">
            Selecciona tu rol
          </p>
          <div role="radiogroup" aria-labelledby="rol-label" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['Instructor', 'Aprendiz'] as const).map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={rol === opcion}
                onClick={() => setRol(opcion)}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  rol === opcion
                    ? 'border-primary bg-primary-container shadow-sm ring-1 ring-primary dark:bg-sena-950/50'
                    : 'border-outline bg-surface-container-lowest hover:border-outline-variant hover:bg-surface-container-low dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <span className="block text-base font-semibold text-on-surface dark:text-slate-100">{opcion}</span>
                <span className="mt-1 block text-xs text-on-surface-variant dark:text-slate-400">
                  {opcion === 'Instructor' ? 'Consulta su carga' : 'Consulta su ficha'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {rol === 'Instructor' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary-container px-3 py-2 text-sm text-on-primary-container">
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

        <label className="mb-5 flex items-start gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={aceptaPolitica}
            onChange={(e) => setAceptaPolitica(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-outline text-primary"
          />
          Acepto el tratamiento de mis datos personales conforme a la política institucional del
          SENA.
        </label>

        {error && (
          <p role="alert" className="mb-4 text-sm text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-on-primary transition hover:bg-on-primary-container disabled:opacity-60"
        >
          {loading ? 'Enviando…' : 'Registrarme'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-on-surface-variant">
        ¿Eres coordinador?{' '}
        <button
          type="button"
          onClick={() => setMostrarSolicitudCoordinador(true)}
          className="font-semibold text-primary hover:underline"
        >
          Solicita acceso
        </button>
      </p>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Ya tengo cuenta ·{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>

      {mostrarSolicitudCoordinador && (
        <SolicitudAccesoCoordinador onCerrar={() => setMostrarSolicitudCoordinador(false)} />
      )}
    </AuthLayout>
  )
}

interface SolicitudAccesoCoordinadorProps {
  onCerrar: () => void
}

/**
 * Formulario corto de "¿Eres coordinador? Solicita acceso" — campos vistos
 * en el mockup del Panel de Administración (cada solicitud trae nombre,
 * correo, documento y el texto completo de motivo/justificación). Llama a
 * `POST /solicitudes-acceso/` (público, sin sesión) y muestra confirmación;
 * no crea cuenta acá, eso ocurre solo si un Administrador aprueba la
 * solicitud desde el Panel de Administración.
 */
function SolicitudAccesoCoordinador({ onCerrar }: SolicitudAccesoCoordinadorProps) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)

  useEffect(() => {
    function manejarTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', manejarTeclado)
    return () => window.removeEventListener('keydown', manejarTeclado)
  }, [onCerrar])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      await apiPost('/solicitudes-acceso/', {
        nombre: nombre.trim(),
        email: email.trim(),
        numeroDocumento: numeroDocumento.trim(),
        motivo: motivo.trim(),
      })
      setEnviada(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar tu solicitud. Inténtalo nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitud-acceso-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-xl dark:bg-slate-800">
        {enviada ? (
          <>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-container text-primary">
              <span className="material-symbols-outlined text-[22px]">check_circle</span>
            </div>
            <h2 className="mb-1 text-lg font-bold text-on-surface dark:text-slate-100">Solicitud enviada</h2>
            <p className="mb-5 text-sm text-on-surface-variant dark:text-slate-400">
              Tu solicitud fue enviada, un Administrador la revisará. Si la aprueba, recibirás una
              credencial temporal en el correo que indicaste.
            </p>
            <button
              type="button"
              onClick={onCerrar}
              className="w-full rounded-xl bg-primary py-2.5 font-semibold text-on-primary hover:bg-on-primary-container"
            >
              Cerrar
            </button>
          </>
        ) : (
          <>
            <h2 id="solicitud-acceso-titulo" className="mb-1 text-lg font-bold text-on-surface dark:text-slate-100">
              Solicita acceso como Coordinador
            </h2>
            <p className="mb-4 text-sm text-on-surface-variant dark:text-slate-400">
              Un Administrador revisará tu solicitud. Si la aprueba, te llegará una credencial
              temporal por correo.
            </p>

            <form onSubmit={handleSubmit}>
              <FormField
                id="solicitud-nombre"
                label="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
              <FormField
                id="solicitud-email"
                label="Correo institucional"
                type="email"
                placeholder="nombre.apellido@sena.edu.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FormField
                id="solicitud-documento"
                label="Número de documento"
                inputMode="numeric"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                required
              />
              <div className="mb-4">
                <label htmlFor="solicitud-motivo" className="mb-1.5 block text-sm font-medium text-on-surface-variant dark:text-slate-300">
                  Motivo y justificación
                </label>
                <textarea
                  id="solicitud-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  required
                  rows={3}
                  placeholder="Ej. Asumí funciones de coordinación académica de la jornada..."
                  className="w-full rounded-xl border border-outline px-3.5 py-2.5 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {error && (
                <p role="alert" className="mb-4 text-sm text-error">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCerrar}
                  className="flex-1 rounded-xl border border-outline px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-on-primary-container disabled:opacity-60"
                >
                  {enviando ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
