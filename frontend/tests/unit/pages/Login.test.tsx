import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Login } from '../../../src/pages/Login'
import type { EstadoLogin } from '../../../src/types/api'
import { apiGet, apiPost } from '../../../src/services/api'
import { supabase } from '../../../src/services/supabaseClient'
import { renderConProviders } from '../../helpers/renderConProviders'

const navegar = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return { ...original, useNavigate: () => navegar }
})

vi.mock('../../../src/services/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('../../../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      setSession: vi.fn(),
    },
  },
}))

function formulario() {
  return {
    identificador: screen.getByRole('textbox', { name: /correo institucional o número de documento/i }),
    password: screen.getByLabelText('Contraseña'),
    enviar: screen.getByRole('button', { name: 'Iniciar sesión' }),
  }
}

describe('Login — Semana 3 / Nicol', () => {
  // Datos de sesión ficticios: no contienen credenciales ni tokens utilizables.
  const sesionSimulada = {
    data: {
      user: { id: 'usuario-login-test', email: 'nicol@sena.edu.co' },
      session: { access_token: 'token-ficticio', user: { id: 'usuario-login-test' } },
    },
    error: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(apiGet).mockResolvedValue({
      bloqueado: false,
      intentos: 0,
      intentosRestantes: 3,
      segundosParaDesbloqueo: null,
    } satisfies EstadoLogin)
    vi.mocked(apiPost).mockResolvedValue({})
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      ...sesionSimulada,
    } as never)
  })

  it('permite escribir correo y contraseña, autentica y navega al dashboard', async () => {
    const usuario = userEvent.setup()
    renderConProviders(<Login />)
    const { identificador, password, enviar } = formulario()

    await usuario.type(identificador, 'nicol@sena.edu.co')
    await usuario.type(password, 'clave-de-prueba')
    await usuario.click(enviar)

    expect(apiGet).toHaveBeenCalledWith('/auditoria/estado-login?identificador=nicol%40sena.edu.co')
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'nicol@sena.edu.co',
      password: 'clave-de-prueba',
    })
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
    expect(navegar).toHaveBeenCalledWith('/dashboard')
    // En un login exitoso por correo no debe hacerse ninguna petición POST a la API.
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('deshabilita el botón y muestra el estado de carga mientras autentica', async () => {
    let resolver!: (value: typeof sesionSimulada) => void
    const pendiente = new Promise<typeof sesionSimulada>((resolve) => {
      resolver = resolve
    })
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(pendiente as never)

    const usuario = userEvent.setup()
    renderConProviders(<Login />)
    const { identificador, password, enviar } = formulario()
    await usuario.type(identificador, 'nicol@sena.edu.co')
    await usuario.type(password, 'clave-de-prueba')
    await usuario.click(enviar)

    expect(await screen.findByRole('button', { name: 'Ingresando…' })).toBeDisabled()
    expect(navegar).not.toHaveBeenCalled()

    resolver(sesionSimulada)
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
    expect(navegar).toHaveBeenCalledWith('/dashboard')
  })

  it('bloquea el envío ante demasiados intentos y muestra una alerta accesible', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      bloqueado: true,
      intentos: 3,
      segundosParaDesbloqueo: 120,
      intentosRestantes: 0,
    } satisfies EstadoLogin)

    const usuario = userEvent.setup()
    renderConProviders(<Login />)
    const { identificador, password, enviar } = formulario()
    await usuario.type(identificador, 'nicol@sena.edu.co')
    await usuario.type(password, 'clave-incorrecta')
    await usuario.click(enviar)

    expect(await screen.findByRole('alert')).toHaveTextContent(/demasiados intentos fallidos/i)
    expect(screen.getByRole('button', { name: 'Cuenta bloqueada temporalmente' })).toBeDisabled()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('informa los intentos restantes cuando Supabase rechaza las credenciales', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    } as never)
    vi.mocked(apiGet)
      .mockResolvedValueOnce({
        bloqueado: false,
        intentos: 0,
        intentosRestantes: 3,
        segundosParaDesbloqueo: null,
      } satisfies EstadoLogin)
      .mockResolvedValueOnce({
        bloqueado: false,
        intentos: 1,
        intentosRestantes: 2,
        segundosParaDesbloqueo: null,
      } satisfies EstadoLogin)

    const usuario = userEvent.setup()
    renderConProviders(<Login />)
    const { identificador, password, enviar } = formulario()
    await usuario.type(identificador, 'nicol@sena.edu.co')
    await usuario.type(password, 'clave-incorrecta')
    await usuario.click(enviar)

    expect(await screen.findByRole('alert')).toHaveTextContent('Te quedan 2 intentos.')
    expect(apiPost).toHaveBeenCalledWith('/auditoria/intento-fallido-login', {
      identificador: 'nicol@sena.edu.co',
    })
    expect(navegar).not.toHaveBeenCalled()
  })
})
