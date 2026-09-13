import { describe, expect, it, vi } from 'vitest'
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

function crearPerfil(debeCambiarClave: boolean): Usuario {
  return {
    idUsuario: 'u1',
    nombre: 'Ana',
    email: 'ana@example.com',
    estado: 'activo',
    fechaRegistro: '2026-01-01',
    roles: [],
    especialidades: [],
    debeCambiarClave,
  }
}

function renderConRuta(pathname: string, contextValue: AuthContextValue) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AuthContext.Provider value={contextValue}>
        <Routes>
          <Route path="/login" element={<p>Pantalla login</p>} />
          <Route
            path="/dashboard"
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
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('sin sesión redirige a /login', async () => {
    renderConRuta('/dashboard', { session: null, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Pantalla login')).toBeInTheDocument()
  })

  it('con sesión y debeCambiarClave=false deja pasar al contenido protegido', async () => {
    apiGetMock.mockResolvedValue(crearPerfil(false))
    renderConRuta('/dashboard', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument()
  })

  it('con sesión y debeCambiarClave=true redirige a la pantalla de cambio de contraseña obligatorio', async () => {
    apiGetMock.mockResolvedValue(crearPerfil(true))
    renderConRuta('/dashboard', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Pantalla cambiar clave')).toBeInTheDocument()
  })

  it('no genera un bucle de redirección si ya está en la pantalla de cambio de contraseña', async () => {
    apiGetMock.mockResolvedValue(crearPerfil(true))
    renderConRuta('/cambiar-clave-obligatorio', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Pantalla cambiar clave')).toBeInTheDocument()
  })

  it('si falla la carga del perfil, no bloquea la navegación (falla abierto)', async () => {
    apiGetMock.mockRejectedValue(new Error('falló'))
    renderConRuta('/dashboard', { session: SESION_FALSA, loading: false, signOut: async () => {} })

    expect(await screen.findByText('Contenido protegido')).toBeInTheDocument()
  })
})
