import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AppShell } from './AppShell'
import { AuthContext } from '../context/auth-context'
import type { AuthContextValue } from '../context/auth-context'
import { ThemeProvider } from '../context/ThemeContext'

const getPerfilMock = vi.fn()
vi.mock('../services/perfil', () => ({
  getPerfil: (...args: unknown[]) => getPerfilMock(...args),
}))

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

function renderAppShell(signOut = vi.fn()) {
  const valor: AuthContextValue = {
    session: { user: { id: 'usuario-de-prueba' } } as AuthContextValue['session'],
    loading: false,
    signOut,
  }
  render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthContext.Provider value={valor}>
          <AppShell titulo="Vista de prueba">
            <p>contenido</p>
          </AppShell>
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  )
  return signOut
}

describe('AppShell — cerrar sesión', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue([])
    getPerfilMock.mockReset()
    // Coordinador a propósito: es uno de los roles que abre más grupos
    // de menú, justo el caso en que la nav desbordaba la barra.
    getPerfilMock.mockResolvedValue({
      idUsuario: 'usuario-de-prueba',
      nombre: 'Coordinadora de Prueba',
      email: 'coord@demo.sihs',
      roles: [{ idRol: 2, nombre: 'Coordinador' }],
    })
  })

  it('ofrece el botón de cerrar sesión con su nombre accesible', async () => {
    renderAppShell()

    // Es un botón de icono: el texto vive en aria-label/title, así que
    // quien use lector de pantalla lo sigue encontrando por su nombre.
    const boton = await screen.findByRole('button', { name: 'Cerrar sesión' })
    expect(boton).toBeInTheDocument()
  })

  it('cierra la sesión al pulsarlo', async () => {
    const signOut = renderAppShell()

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('deja que la barra de navegación se encoja para no empujar las acciones fuera', async () => {
    // Test de clases y no de layout porque jsdom no calcula ancho real.
    // Se fija igual porque ESTA clase es el bug: sin `min-w-0` un item
    // flex no baja de su ancho de contenido (min-width: auto), así que
    // con muchos grupos de menú la nav empujaba el bloque de acciones
    // —y con él "Cerrar sesión"— fuera del borde derecho.
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthContext.Provider
            value={{
              session: { user: { id: 'u1' } } as AuthContextValue['session'],
              loading: false,
              signOut: vi.fn(),
            }}
          >
            <AppShell titulo="Vista de prueba">
              <p>contenido</p>
            </AppShell>
          </AuthContext.Provider>
        </ThemeProvider>
      </MemoryRouter>,
    )

    const nav = container.querySelector('header nav')
    expect(nav).toHaveClass('min-w-0')

    const boton = await screen.findByRole('button', { name: 'Cerrar sesión' })
    expect(boton.className).toContain('shrink-0')
  })
})
