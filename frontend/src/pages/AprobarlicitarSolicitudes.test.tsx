import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { AprobarlicitarSolicitudes } from './AprobarlicitarSolicitudes'
import type { Rol, Usuario } from '../types/api'

const SIN_ROL: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [],
  especialidades: [],
}

const ROLES: Rol[] = [
  { idRol: 1, nombre: 'Instructor' },
  { idRol: 2, nombre: 'Coordinador' },
]

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
vi.mock('../services/api', () => ({
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

  await usuario.click(await screen.findByRole('button', { name: 'Asignar rol' }))
  await usuario.click(screen.getByRole('button', { name: nombreRol }))
  await usuario.click(screen.getByRole('button', { name: 'Asignar' }))

  return usuario
}

describe('AprobarlicitarSolicitudes', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('al aprobar el rol Instructor, genera su código automáticamente y lo muestra', async () => {
    mockeaSolicitudes()
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/usuario-rol/asignar') return Promise.resolve({})
      if (path === '/usuarios/instructor/codigo/generar') {
        return Promise.resolve({ codigo: 'INS-AB12CD', idUsuario: 'u1' })
      }
      return Promise.reject(new Error('no mockeado en este test'))
    })

    await aprobarConRol('Instructor')

    expect(apiPostMock).toHaveBeenCalledWith('/usuario-rol/asignar', { idUsuario: 'u1', idRol: 1 })
    expect(apiPostMock).toHaveBeenCalledWith('/usuarios/instructor/codigo/generar', { idUsuario: 'u1' })
    expect(await screen.findByText(/Código de instructor: INS-AB12CD\./)).toBeInTheDocument()
  })

  it('al aprobar un rol distinto de Instructor, no llama a generar código', async () => {
    mockeaSolicitudes()
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/usuario-rol/asignar') return Promise.resolve({})
      return Promise.reject(new Error('no mockeado en este test'))
    })

    await aprobarConRol('Coordinador')

    expect(await screen.findByText(/ahora tiene el rol Coordinador\./)).toBeInTheDocument()
    expect(apiPostMock).not.toHaveBeenCalledWith('/usuarios/instructor/codigo/generar', expect.anything())
  })

  it('si falla la generación del código, el rol igual queda asignado y avisa dónde generarlo', async () => {
    mockeaSolicitudes()
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/usuario-rol/asignar') return Promise.resolve({})
      if (path === '/usuarios/instructor/codigo/generar') return Promise.reject(new Error('falló'))
      return Promise.reject(new Error('no mockeado en este test'))
    })

    await aprobarConRol('Instructor')

    expect(await screen.findByText(/ahora tiene el rol Instructor\./)).toBeInTheDocument()
    expect(screen.getByText(/No se pudo generar su código de instructor/)).toBeInTheDocument()
  })
})
