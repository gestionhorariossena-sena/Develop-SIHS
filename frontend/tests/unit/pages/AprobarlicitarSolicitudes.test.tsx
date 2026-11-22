import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { AprobarlicitarSolicitudes } from '../../../src/pages/AprobarlicitarSolicitudes'
import type { Rol, Usuario } from '../../../src/types/api'

const SIN_ROL: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [],
  especialidades: [],
  debeCambiarClave: false,
}

const ROLES: Rol[] = [
  { idRol: 1, nombre: 'Instructor' },
  { idRol: 2, nombre: 'Coordinador' },
]

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

function mockeaSolicitudes() {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/') return Promise.resolve([SIN_ROL])
    if (path === '/roles/') return Promise.resolve(ROLES)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

async function aprobarConRol(nombreRol: string) {
  const usuario = userEvent.setup()
  renderConProviders(<AprobarlicitarSolicitudes />)

  await usuario.click(await screen.findByRole('button', { name: 'Aprobar registro y asignar rol' }))
  await usuario.click(screen.getByRole('button', { name: nombreRol }))
  await usuario.click(screen.getByRole('button', { name: 'Asignar' }))

  return usuario
}

describe('AprobarlicitarSolicitudes', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('aprueba el rol Instructor sin exigir ni generar códigos adicionales', async () => {
    mockeaSolicitudes()
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/usuario-rol/asignar') return Promise.resolve({})
      return Promise.reject(new Error('no mockeado en este test'))
    })

    await aprobarConRol('Instructor')

    expect(apiPostMock).toHaveBeenCalledWith('/usuario-rol/asignar', { idUsuario: 'u1', idRol: 1 })
    expect(apiPostMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/ahora tiene el rol Instructor\./)).toBeInTheDocument()
  })

  it('puede aprobar otro rol sin depender de códigos de instructor', async () => {
    mockeaSolicitudes()
    apiPostMock.mockResolvedValue({})

    await aprobarConRol('Coordinador')

    expect(apiPostMock).toHaveBeenCalledWith('/usuario-rol/asignar', { idUsuario: 'u1', idRol: 2 })
    expect(apiPostMock).toHaveBeenCalledTimes(1)
  })

})
