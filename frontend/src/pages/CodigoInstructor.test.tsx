import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { CodigoInstructor } from './CodigoInstructor'
import type { Usuario } from '../types/api'

const INSTRUCTOR_CON_CODIGO: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  codigoInstructor: 'INS-AB12CD',
  idTrimestre: 3,
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [],
}

const INSTRUCTOR_SIN_CODIGO: Usuario = {
  idUsuario: 'u2',
  nombre: 'Laura Pérez',
  email: 'laura@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  codigoInstructor: null,
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [],
}

const COORDINADOR: Usuario = {
  idUsuario: 'u3',
  nombre: 'Ana Martínez',
  email: 'ana@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
  especialidades: [],
}

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

function mockeaUsuarios(usuarios: Usuario[]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/') return Promise.resolve(usuarios)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('CodigoInstructor', () => {
  it('lista solo instructores, mostrando su código o "Sin código aún"', async () => {
    mockeaUsuarios([INSTRUCTOR_CON_CODIGO, INSTRUCTOR_SIN_CODIGO, COORDINADOR])
    renderConProviders(<CodigoInstructor />)

    expect(await screen.findByText('Erick Granados')).toBeInTheDocument()
    expect(screen.getByText('INS-AB12CD')).toBeInTheDocument()

    expect(screen.getByText('Laura Pérez')).toBeInTheDocument()
    const filaLaura = screen.getByText('Laura Pérez').closest('tr') as HTMLElement
    expect(within(filaLaura).getByText('Sin código aún')).toBeInTheDocument()

    expect(screen.queryByText('Ana Martínez')).not.toBeInTheDocument()
  })

  it('muestra el mensaje de acceso denegado si el backend responde 403', async () => {
    const { ApiError } = await import('../services/api')
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/') return Promise.reject(new ApiError(403, 'Prohibido'))
      return Promise.reject(new Error('no mockeado en este test'))
    })

    renderConProviders(<CodigoInstructor />)

    expect(await screen.findByText('Solo un Administrador puede ver los códigos de instructor.')).toBeInTheDocument()
  })

  it('un instructor sin código tiene un botón "Generar" que lo crea (respaldo si falló la generación automática)', async () => {
    mockeaUsuarios([INSTRUCTOR_SIN_CODIGO])
    apiPostMock.mockResolvedValue({ codigo: 'INS-XYZ99', idUsuario: 'u2' })
    const usuario = userEvent.setup()

    renderConProviders(<CodigoInstructor />)
    const fila = (await screen.findByText('Laura Pérez')).closest('tr') as HTMLElement
    expect(within(fila).getByText('Sin código aún')).toBeInTheDocument()

    await usuario.click(within(fila).getByRole('button', { name: 'Generar' }))

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/usuarios/instructor/codigo/generar', { idUsuario: 'u2' }))
    expect(await within(fila).findByText('INS-XYZ99')).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Copiar' })).toBeInTheDocument()
  })

  it('si falla la generación, muestra el error y no rompe la fila', async () => {
    const { ApiError } = await import('../services/api')
    mockeaUsuarios([INSTRUCTOR_SIN_CODIGO])
    apiPostMock.mockRejectedValue(new ApiError(409, 'No se pudo generar un código único.'))
    const usuario = userEvent.setup()

    renderConProviders(<CodigoInstructor />)
    const fila = (await screen.findByText('Laura Pérez')).closest('tr') as HTMLElement
    await usuario.click(within(fila).getByRole('button', { name: 'Generar' }))

    expect(await screen.findByText('No se pudo generar un código único.')).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Generar' })).toBeInTheDocument()
  })
})
