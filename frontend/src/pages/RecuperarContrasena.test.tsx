import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecuperarContrasena } from './RecuperarContrasena'
import { supabase } from '../services/supabaseClient'
import { ThemeProvider } from '../context/ThemeContext'

// SCRUM: recuperación de contraseña con código OTP en vez de link mágico —
// se mockea supabase.auth directo (esta página no pasa por apiGet/backend).
vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

function renderPagina() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <RecuperarContrasena />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('RecuperarContrasena', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReset()
  })

  it('pide el código por correo y muestra el mensaje de código enviado (no de link)', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as never)

    renderPagina()
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText('Correo institucional'), 'nombre.apellido@sena.edu.co')
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('nombre.apellido@sena.edu.co')
    expect(screen.getByText(/te llegará un código de verificación/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ya tengo mi código' })).toBeInTheDocument()
  })

  it('muestra el error de Supabase si resetPasswordForEmail falla', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: { message: 'Demasiadas solicitudes, intenta más tarde.' },
    } as never)

    renderPagina()
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText('Correo institucional'), 'nombre.apellido@sena.edu.co')
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiadas solicitudes, intenta más tarde.')
    expect(screen.queryByText(/te llegará un código de verificación/)).not.toBeInTheDocument()
  })
})
