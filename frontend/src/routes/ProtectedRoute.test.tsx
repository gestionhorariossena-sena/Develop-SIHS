import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from '../context/auth-context'
import type { AuthContextValue } from '../context/auth-context'
import { ProtectedRoute } from './ProtectedRoute'
import type { Usuario } from '../types/api'

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

const SESION_FALSA = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

function crearPerfil(overrides: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 'u1',
    nombre: 'Ana',
    email: 'ana@example.com',
    estado: 'activo',
    fechaRegistro: '2026-01-01',
    roles: [],
    especialidades: [],
    debeCambiarClave: false,
    ...overrides,
  }
}

function renderConRuta(pathname: string, contextValue: AuthContextValue, roles?: string[]) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuthContext.Provider value={contextValue}>
        <Routes>
          <Route path="/login" element={<p>Pantalla login</p>} />
          {/* /dashboard es el destino real del redirect por rol
           * (ProtectedRoute.tsx: `<Navigate to="/dashboard" />`) -- texto
           * plano, sin volver a envolver en <ProtectedRoute>, para poder
           * distinguirlo de "Contenido protegido" en los tests de rol. */}
          <Route path="/dashboard" element={<p>Dashboard</p>} />
          <Route
            path="/pagina-protegida"
            element={
              <ProtectedRoute>
                <p>Contenido protegido</p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cambiar-clave-obligatorio"
            element={
              <ProtectedRoute>
                <p>Pantalla cambiar clave</p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/protegida"
            element={
              <ProtectedRoute roles={roles}>
                <p>Contenido de ruta con rol</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
  })

  it('sin sesión redirige a /login', async () => {
    renderConRuta('/pagina-protegida', { session: null, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Pantalla login')).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it('con sesión y debeCambiarClave=false deja pasar al contenido protegido', async () => {
    apiGetMock.mockResolvedValue(crearPerfil({ debeCambiarClave: false }))
    renderConRuta('/pagina-protegida', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument()
  })

  it('con sesión y debeCambiarClave=true redirige a la pantalla de cambio de contraseña obligatorio', async () => {
    apiGetMock.mockResolvedValue(crearPerfil({ debeCambiarClave: true }))
    renderConRuta('/pagina-protegida', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Pantalla cambiar clave')).toBeInTheDocument()
  })

  it('no genera un bucle de redirección si ya está en la pantalla de cambio de contraseña', async () => {
    apiGetMock.mockResolvedValue(crearPerfil({ debeCambiarClave: true }))
    renderConRuta('/cambiar-clave-obligatorio', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Pantalla cambiar clave')).toBeInTheDocument()
  })

  it('si falla la carga del perfil, no bloquea la navegación (falla abierto)', async () => {
    apiGetMock.mockRejectedValue(new Error('falló'))
    renderConRuta('/pagina-protegida', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument()
  })

  it('redirige a /login cuando no hay sesión aunque se pidan roles', async () => {
    renderConRuta('/protegida', { session: null, loading: false, signOut: async () => {} }, ['Aprendiz'])

    expect(await screen.findByText('Pantalla login')).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it('permite el contenido cuando el usuario tiene el rol requerido', async () => {
    apiGetMock.mockResolvedValue(
      crearPerfil({ roles: [{ idRol: 1, nombre: 'Aprendiz' }] }),
    )

    renderConRuta('/protegida', { session: SESION_FALSA, loading: false, signOut: async () => {} }, ['Aprendiz'])

    expect(await screen.findByText('Contenido de ruta con rol')).toBeInTheDocument()
  })

  it('redirige a /dashboard cuando el usuario no tiene el rol requerido', async () => {
    apiGetMock.mockResolvedValue(
      crearPerfil({ roles: [{ idRol: 2, nombre: 'Instructor' }] }),
    )

    renderConRuta('/protegida', { session: SESION_FALSA, loading: false, signOut: async () => {} }, ['Aprendiz'])

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Contenido de ruta con rol')).not.toBeInTheDocument()
  })

  it('permite cualquier usuario autenticado cuando no se especifican roles', async () => {
    apiGetMock.mockResolvedValue(crearPerfil())

    renderConRuta('/protegida', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Contenido de ruta con rol')).toBeInTheDocument()
  })
})
