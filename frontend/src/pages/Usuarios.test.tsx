import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { Usuarios } from './Usuarios'
import type { Rol, Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [],
}

const ROLES: Rol[] = [{ idRol: 1, nombre: 'Instructor' }, { idRol: 2, nombre: 'Coordinador' }]

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

describe('Usuarios', () => {
  it('ya no ofrece generar el código de instructor a mano — eso quedó automático al aprobar el rol', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/roles/') return Promise.resolve(ROLES)
      return Promise.reject(new Error('no mockeado en este test'))
    })

    renderConProviders(<Usuarios />)

    expect(await screen.findByText('Erick Granados')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar código' })).not.toBeInTheDocument()
    expect(screen.queryByText('Generar código único de instructor')).not.toBeInTheDocument()
  })
})
