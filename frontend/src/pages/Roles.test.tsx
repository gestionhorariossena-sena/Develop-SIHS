import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Roles } from './Roles'
import type { Rol, Usuario } from '../types/api'

const ROLES: Rol[] = [
  { idRol: 1, nombre: 'Administrador' },
  { idRol: 2, nombre: 'Coordinador' },
]

const PERFIL: Usuario = {
  idUsuario: 'admin-1',
  nombre: 'Ana Admin',
  email: 'ana@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01T00:00:00Z',
  roles: [{ idRol: 1, nombre: 'Administrador' }],
  especialidades: [],
}

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()

vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  ApiError: class ApiError extends Error {},
}))

describe('Roles', () => {
  it('carga el catálogo y crea un rol', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/roles/') return Promise.resolve(ROLES)
      if (path === '/usuarios/me') return Promise.resolve(PERFIL)
      return Promise.reject(new Error('ruta no mockeada'))
    })
    apiPostMock.mockResolvedValue({ idRol: 3, nombre: 'Instructor' })
    const usuario = userEvent.setup()

    renderConProviders(<Roles />)

    expect(await screen.findByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('2 de 2 roles')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Nuevo rol'), 'Instructor')
    await usuario.click(screen.getByRole('button', { name: 'Crear rol' }))

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/roles/', { nombre: 'Instructor' }))
    expect(screen.getByText('Rol creado correctamente.')).toBeInTheDocument()
  })

  it('pide confirmación antes de borrar un rol', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/roles/') return Promise.resolve(ROLES)
      if (path === '/usuarios/me') return Promise.resolve(PERFIL)
      return Promise.reject(new Error('ruta no mockeada'))
    })
    const usuario = userEvent.setup()

    renderConProviders(<Roles />)
    await screen.findByText('Administrador')
    await usuario.click(screen.getAllByRole('button', { name: 'Borrar' })[0])

    expect(screen.getByRole('dialog', { name: 'Confirmar eliminación' })).toBeInTheDocument()
    expect(screen.getByText(/Vas a eliminar el rol/)).toBeInTheDocument()
    expect(apiDeleteMock).not.toHaveBeenCalled()
  })
})
