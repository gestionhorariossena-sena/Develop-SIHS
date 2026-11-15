import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthError } from '@supabase/supabase-js'
import { Registro } from '../../../src/pages/Registro'
import { apiPost, ApiError } from '../../../src/services/api'
import { supabase } from '../../../src/services/supabaseClient'
import { ThemeProvider } from '../../../src/context/ThemeContext'

vi.mock('../../../src/services/api', () => ({
  apiPost: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('../../../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}))

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/registro']}>
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<p>Formulario de inicio de sesión</p>} />
          <Route path="*" element={<Registro />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

async function completarFormularioAprendiz(
  usuario: ReturnType<typeof userEvent.setup>,
  confirmarPassword = 'ClaveSegura123',
) {
  await usuario.click(screen.getByRole('radio', { name: /Aprendiz/ }))
  await usuario.click(screen.getByRole('button', { name: 'Continuar como aprendiz' }))
  await usuario.type(screen.getByLabelText('Nombres'), 'Laura Camila')
  await usuario.type(screen.getByLabelText('Apellidos'), 'Restrepo Duarte')
  await usuario.type(screen.getByLabelText('Número de documento'), '123456789')
  await usuario.type(screen.getByLabelText('Correo institucional'), 'laura@sena.edu.co')
  await usuario.type(screen.getByLabelText('Teléfono'), '3001234567')
  await usuario.type(screen.getByLabelText('Contraseña'), 'ClaveSegura123')
  await usuario.type(screen.getByLabelText('Confirmar contraseña'), confirmarPassword)
  await usuario.type(screen.getByLabelText('Código de ficha'), '1234567')
  await usuario.type(screen.getByLabelText('Programa de formación'), 'Análisis y desarrollo de software')
  await usuario.click(screen.getByRole('checkbox'))
}

describe('Registro', () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset()
    vi.mocked(supabase.auth.signUp).mockReset()
  })

  it('envía los datos del aprendiz a Supabase y navega al inicio de sesión', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })
    const usuario = userEvent.setup()
    renderPagina()

    await completarFormularioAprendiz(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Registrarme' }))

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'laura@sena.edu.co',
      password: 'ClaveSegura123',
      options: {
        data: {
          nombre: 'Laura Camila Restrepo Duarte',
          nombres: 'Laura Camila',
          apellidos: 'Restrepo Duarte',
          tipo_documento: 'CC',
          numero_documento: '123456789',
          telefono: '3001234567',
          rol_solicitado: 'Aprendiz',
          codigo_ficha: '1234567',
          programa_formacion: 'Análisis y desarrollo de software',
        },
      },
    })
    expect(apiPost).not.toHaveBeenCalled()
    expect(await screen.findByText('Formulario de inicio de sesión')).toBeInTheDocument()
  })

  it('muestra validación y no crea la cuenta si las contraseñas no coinciden', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })
    const usuario = userEvent.setup()
    renderPagina()

    await completarFormularioAprendiz(usuario, 'OtraClave123')
    await usuario.click(screen.getByRole('button', { name: 'Registrarme' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Las contraseñas no coinciden. Revisa la confirmación.',
    )
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('muestra el error de Supabase si no se puede crear la cuenta', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthError('No se pudo crear la cuenta.'),
    })
    const usuario = userEvent.setup()
    renderPagina()

    await completarFormularioAprendiz(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Registrarme' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo crear la cuenta.')
    expect(screen.queryByText('Formulario de inicio de sesión')).not.toBeInTheDocument()
  })

  it('deshabilita el envío mientras Supabase procesa el registro', async () => {
    let resolver!: (value: Awaited<ReturnType<typeof supabase.auth.signUp>>) => void
    vi.mocked(supabase.auth.signUp).mockImplementation(
      () => new Promise((resolve) => { resolver = resolve }),
    )
    const usuario = userEvent.setup()
    renderPagina()

    await completarFormularioAprendiz(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Registrarme' }))

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()

    resolver({ data: { user: null, session: null }, error: null })
    expect(await screen.findByText('Formulario de inicio de sesión')).toBeInTheDocument()
  })

  it('el selector de rol ya no ofrece "Coordinador" — solo Instructor y Aprendiz', () => {
    renderPagina()

    expect(screen.getByRole('radio', { name: /Instructor/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Aprendiz/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Coordinador/ })).not.toBeInTheDocument()
  })

  it('muestra solo los campos del rol elegido y permite volver a cambiarlo', async () => {
    const usuario = userEvent.setup()
    renderPagina()

    expect(screen.queryByLabelText('Nombres')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('radio', { name: /Aprendiz/ }))
    await usuario.click(screen.getByRole('button', { name: 'Continuar como aprendiz' }))
    expect(screen.getByLabelText('Código de ficha')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código de instructor')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cambiar rol' }))
    expect(screen.getByRole('radio', { name: /Aprendiz/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('"¿Eres coordinador? Solicita acceso" abre el formulario corto y, al enviarlo, llama a POST /solicitudes-acceso/ y muestra confirmación', async () => {
    vi.mocked(apiPost).mockResolvedValue({})
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.click(screen.getByRole('button', { name: 'Solicita acceso' }))

    const dialogo = screen.getByRole('dialog', { name: /Solicita acceso como Coordinador/ })

    await usuario.type(within(dialogo).getByLabelText('Nombre completo'), 'Maritza Benítez')
    await usuario.type(within(dialogo).getByLabelText('Correo institucional'), 'mbenitez@sena.edu.co')
    await usuario.type(within(dialogo).getByLabelText('Número de documento'), '52849120')
    await usuario.type(within(dialogo).getByLabelText('Motivo y justificación'), 'Asumí funciones de coordinación académica.')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }))

    expect(apiPost).toHaveBeenCalledWith('/solicitudes-acceso/', {
      nombre: 'Maritza Benítez',
      email: 'mbenitez@sena.edu.co',
      numeroDocumento: '52849120',
      motivo: 'Asumí funciones de coordinación académica.',
    })
    expect(await screen.findByText(/[Uu]n Administrador la revisará/)).toBeInTheDocument()
    // No crea cuenta de Supabase Auth en este paso.
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('muestra el error del backend si la solicitud de acceso falla', async () => {
    vi.mocked(apiPost).mockRejectedValue(new ApiError(422, 'El correo ya tiene una solicitud pendiente.'))
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.click(screen.getByRole('button', { name: 'Solicita acceso' }))
    const dialogo = screen.getByRole('dialog', { name: /Solicita acceso como Coordinador/ })
    await usuario.type(within(dialogo).getByLabelText('Nombre completo'), 'Maritza Benítez')
    await usuario.type(within(dialogo).getByLabelText('Correo institucional'), 'mbenitez@sena.edu.co')
    await usuario.type(within(dialogo).getByLabelText('Número de documento'), '52849120')
    await usuario.type(within(dialogo).getByLabelText('Motivo y justificación'), 'Asumí funciones de coordinación académica.')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El correo ya tiene una solicitud pendiente.')
    expect(screen.queryByText(/[Uu]n Administrador la revisará/)).not.toBeInTheDocument()
  })

  it('"Cancelar" cierra el formulario de solicitud sin enviar nada', async () => {
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.click(screen.getByRole('button', { name: 'Solicita acceso' }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog', { name: /Solicita acceso como Coordinador/ })).not.toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })
})
