import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { CambiarClaveObligatorio } from './CambiarClaveObligatorio'

const updateUserMock = vi.fn()
vi.mock('../services/supabaseClient', () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUserMock(...args) } },
}))

const { ApiErrorMock, apiPatchMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { ApiErrorMock, apiPatchMock: vi.fn() }
})
vi.mock('../services/api', () => ({
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  ApiError: ApiErrorMock,
}))

function renderPagina() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/cambiar-clave-obligatorio']}>
        <Routes>
          <Route path="/cambiar-clave-obligatorio" element={<CambiarClaveObligatorio />} />
          <Route path="/dashboard" element={<p>Pantalla dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('CambiarClaveObligatorio', () => {
  beforeEach(() => {
    updateUserMock.mockReset()
    apiPatchMock.mockReset()
  })

  it('muestra un error si las contraseñas no coinciden, sin llamar a Supabase', async () => {
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'abcdef')
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'distinta')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(updateUserMock).not.toHaveBeenCalled()
  })

  it('caso feliz: cambia la contraseña, confirma en el backend y navega a /dashboard', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    apiPatchMock.mockResolvedValue({})
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'nuevaClave123')
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'nuevaClave123')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('Pantalla dashboard')).toBeInTheDocument()
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'nuevaClave123' })
    expect(apiPatchMock).toHaveBeenCalledWith('/usuarios/me/confirmar-cambio-clave')
  })

  it('si Supabase rechaza la contraseña nueva, muestra el error y no llama al backend', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: { message: 'La contraseña es muy corta' } })
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'abcdef')
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'abcdef')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('La contraseña es muy corta')).toBeInTheDocument()
    expect(apiPatchMock).not.toHaveBeenCalled()
  })

  it('si falla la confirmación en el backend después de cambiar la contraseña, muestra aviso y no navega', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    apiPatchMock.mockRejectedValue(new ApiErrorMock(500, 'error de servidor'))
    const usuario = userEvent.setup()
    renderPagina()

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'nuevaClave123')
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'nuevaClave123')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('error de servidor')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla dashboard')).not.toBeInTheDocument()
  })
})
