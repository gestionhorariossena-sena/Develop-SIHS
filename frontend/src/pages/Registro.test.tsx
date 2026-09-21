import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Registro } from './Registro'
import { apiPost, ApiError } from '../services/api'
import { supabase } from '../services/supabaseClient'
import { ThemeProvider } from '../context/ThemeContext'

vi.mock('../services/api', () => ({
  apiPost: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}))

function renderPagina() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Registro />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Registro', () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset()
    vi.mocked(supabase.auth.signUp).mockReset()
  })

  it('el selector de rol ya no ofrece "Coordinador" — solo Instructor y Aprendiz', () => {
    renderPagina()

    expect(screen.getByRole('radio', { name: /Instructor/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Aprendiz/ })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Coordinador/ })).not.toBeInTheDocument()
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
