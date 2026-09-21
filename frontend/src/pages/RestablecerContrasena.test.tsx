import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RestablecerContrasena } from './RestablecerContrasena'
import { supabase } from '../services/supabaseClient'
import { ThemeProvider } from '../context/ThemeContext'

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

function renderPagina(emailInicial?: string) {
  return render(
    <MemoryRouter
      initialEntries={[emailInicial ? { pathname: '/restablecer-contrasena', state: { email: emailInicial } } : '/restablecer-contrasena']}
    >
      <ThemeProvider>
        <RestablecerContrasena />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

async function completarPasoCodigo(usuario: ReturnType<typeof userEvent.setup>, email = 'nombre.apellido@sena.edu.co') {
  const campoEmail = screen.getByLabelText('Correo institucional') as HTMLInputElement
  if (!campoEmail.value) {
    await usuario.type(campoEmail, email)
  }
  await usuario.type(screen.getByLabelText('Código de verificación'), '123456')
  await usuario.click(screen.getByRole('button', { name: 'Verificar código' }))
}

describe('RestablecerContrasena', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.verifyOtp).mockReset()
    vi.mocked(supabase.auth.updateUser).mockReset()
  })

  it('precarga el correo recibido desde RecuperarContrasena y valida el código con verifyOtp type=recovery', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null } as never)

    renderPagina('nombre.apellido@sena.edu.co')
    const usuario = userEvent.setup()

    expect(screen.getByLabelText('Correo institucional')).toHaveValue('nombre.apellido@sena.edu.co')

    await completarPasoCodigo(usuario)

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'nombre.apellido@sena.edu.co',
      token: '123456',
      type: 'recovery',
    })
    expect(await screen.findByText('Crea tu nueva contraseña')).toBeInTheDocument()
  })

  it('muestra error y no avanza de paso si el código es inválido o venció', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    } as never)

    renderPagina()
    const usuario = userEvent.setup()

    await completarPasoCodigo(usuario)

    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido o vencido')
    expect(screen.queryByText('Crea tu nueva contraseña')).not.toBeInTheDocument()
  })

  it('no llama a updateUser si las contraseñas no coinciden', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null } as never)

    renderPagina()
    const usuario = userEvent.setup()
    await completarPasoCodigo(usuario)
    await screen.findByText('Crea tu nueva contraseña')

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'clave123')
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'clave456')
    await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('completa el flujo: código válido + contraseña nueva llama a updateUser', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null } as never)
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: {}, error: null } as never)

    renderPagina()
    const usuario = userEvent.setup()
    await completarPasoCodigo(usuario)
    await screen.findByText('Crea tu nueva contraseña')

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'clave123')
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'clave123')
    await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'clave123' })
  })
})
