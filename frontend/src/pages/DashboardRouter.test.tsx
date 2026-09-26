import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardRouter } from './DashboardRouter'
import type { Usuario } from '../types/api'

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
}))

vi.mock('./Dashboard', () => ({ Dashboard: () => <p>Dashboard de gestión</p> }))
vi.mock('./DashboardAprendiz', () => ({ DashboardAprendiz: () => <p>Dashboard del Aprendiz</p> }))

function crearPerfil(rol: string): Usuario {
  return {
    idUsuario: 'u1',
    nombre: 'Ana',
    email: 'ana@example.com',
    estado: 'activo',
    fechaRegistro: '2026-01-01',
    roles: [{ idRol: 1, nombre: rol }],
    especialidades: [],
    debeCambiarClave: false,
  }
}

describe('DashboardRouter', () => {
  it('muestra DashboardAprendiz cuando el usuario tiene rol Aprendiz', async () => {
    apiGetMock.mockResolvedValue(crearPerfil('Aprendiz'))
    render(<DashboardRouter />)

    expect(await screen.findByText('Dashboard del Aprendiz')).toBeInTheDocument()
  })

  it('muestra Dashboard (gestión) para cualquier otro rol', async () => {
    apiGetMock.mockResolvedValue(crearPerfil('Coordinador'))
    render(<DashboardRouter />)

    expect(await screen.findByText('Dashboard de gestión')).toBeInTheDocument()
  })

  it('si falla el fetch de perfil, cae en Dashboard (gestión) -- falla abierto', async () => {
    apiGetMock.mockRejectedValue(new Error('falló'))
    render(<DashboardRouter />)

    expect(await screen.findByText('Dashboard de gestión')).toBeInTheDocument()
  })
})
