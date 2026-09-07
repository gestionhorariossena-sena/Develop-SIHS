import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { apiGet } from '../services/api'
import { useAuth } from '../hooks/useAuth'

vi.mock('../services/api', () => ({
  apiGet: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const apiGetMock = vi.mocked(apiGet)
const useAuthMock = vi.mocked(useAuth)

const usuarioAprendiz = {
  idUsuario: '1',
  nombre: 'Ana',
  email: 'ana@example.com',
  estado: 'activo' as const,
  fechaRegistro: '2026-09-07',
  roles: [
    {
      idRol: 1,
      nombre: 'Aprendiz',
    },
  ],
  especialidades: [],
}

const usuarioInstructor = {
  idUsuario: '2',
  nombre: 'Carlos',
  email: 'carlos@example.com',
  estado: 'activo' as const,
  fechaRegistro: '2026-09-07',
  roles: [
    {
      idRol: 2,
      nombre: 'Instructor',
    },
  ],
  especialidades: [],
}

function renderProtectedRoute(roles?: string[]) {
  return render(
    <MemoryRouter initialEntries={['/protegida']}>
      <Routes>
        <Route
          path="/protegida"
          element={
            <ProtectedRoute roles={roles}>
              <div>Contenido protegido</div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/login"
          element={<div>Página de login</div>}
        />

        <Route
          path="/dashboard"
          element={<div>Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      session: {} as ReturnType<typeof useAuth>['session'],
      loading: false,
      signOut: vi.fn(),
    })
  })

  it('redirige a /login cuando no hay sesión', () => {
    useAuthMock.mockReturnValue({
      session: null,
      loading: false,
      signOut: vi.fn(),
    } as ReturnType<typeof useAuth>)

    renderProtectedRoute(['Aprendiz'])

    expect(screen.getByText('Página de login')).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it('permite el contenido cuando el usuario tiene el rol requerido', async () => {
    apiGetMock.mockResolvedValue(usuarioAprendiz)

    renderProtectedRoute(['Aprendiz'])

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/usuarios/me')
    })

    expect(
      await screen.findByText('Contenido protegido'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Dashboard'),
    ).not.toBeInTheDocument()
  })

  it('redirige a /dashboard cuando el usuario no tiene el rol requerido', async () => {
    apiGetMock.mockResolvedValue(usuarioInstructor)

    renderProtectedRoute(['Aprendiz'])

    expect(
      await screen.findByText('Dashboard'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Contenido protegido'),
    ).not.toBeInTheDocument()
  })

  it('permite cualquier usuario autenticado cuando no se especifican roles', () => {
    renderProtectedRoute()

    expect(
      screen.getByText('Contenido protegido'),
    ).toBeInTheDocument()

    expect(apiGetMock).not.toHaveBeenCalled()
  })
})