import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecuperarContrasena } from '../../../src/pages/RecuperarContrasena'
import { supabase } from '../../../src/services/supabaseClient'
import { ThemeProvider } from '../../../src/context/ThemeContext'

// SCRUM: recuperación de contraseña con código OTP en vez de link mágico —
// se mockea supabase.auth directo (esta página no pasa por apiGet/backend).
vi.mock('../../../src/services/supabaseClient', () => ({
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

  // --- Escenarios nuevos de S3 (Edith) ---

  it('no llama a Supabase si el correo está vacío (validación nativa del campo)', async () => {
    // Arrange
    renderPagina()
    const usuario = userEvent.setup()

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    // Assert
    expect(screen.getByLabelText('Correo institucional')).toBeInvalid()
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('deshabilita el botón y muestra "Enviando…" mientras espera la respuesta', async () => {
    // Arrange
    let resolver: (value: { data: object; error: null }) => void
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      }) as never,
    )
    renderPagina()
    const usuario = userEvent.setup()

    // Act
    await usuario.type(screen.getByLabelText('Correo institucional'), 'nombre.apellido@sena.edu.co')
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))

    // Assert
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()

    // Cleanup: resolver la promesa para no dejar un act() pendiente
    resolver!({ data: {}, error: null })
    await screen.findByText(/te llegará un código de verificación/)
  })

  it('navega al paso del código con el correo enviado, al dar clic en "Ya tengo mi código"', async () => {
    // Arrange
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as never)

    function PantallaCodigo() {
      const location = useLocation()
      const email = (location.state as { email?: string } | null)?.email
      return <p>Paso del código para: {email ?? 'sin correo'}</p>
    }

    render(
      <MemoryRouter initialEntries={['/recuperar-contrasena']}>
        <ThemeProvider>
          <Routes>
            <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
            <Route path="/restablecer-contrasena" element={<PantallaCodigo />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    )
    const usuario = userEvent.setup()
    await usuario.type(screen.getByLabelText('Correo institucional'), 'nombre.apellido@sena.edu.co')
    await usuario.click(screen.getByRole('button', { name: 'Enviar instrucciones' }))
    await screen.findByText(/te llegará un código de verificación/)

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Ya tengo mi código' }))

    // Assert
    expect(await screen.findByText('Paso del código para: nombre.apellido@sena.edu.co')).toBeInTheDocument()
  })
})
