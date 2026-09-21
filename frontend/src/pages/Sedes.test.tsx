import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Sedes } from './Sedes'

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

const sedes = [
  { idSede: 1, nombreSede: 'Sede principal', direccion: 'Calle 1 # 2-3', tipoSede: 'principal' },
  { idSede: 2, nombreSede: 'Sede norte', direccion: 'Carrera 5', tipoSede: 'secundaria' },
  { idSede: 3, nombreSede: 'Sede alterna', direccion: 'Zona Franca', tipoSede: 'alterna' },
]

const ambientes = [
  { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Aula 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 },
  { idAmbiente: 2, numeroAmbiente: 201, nombreAmbiente: 'Aula 201', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 },
  { idAmbiente: 3, numeroAmbiente: 11, nombreAmbiente: 'Taller', tipoAmbiente: 'especial', estadoAmbiente: 'mantenimiento', idSede: 2 },
]

beforeEach(() => {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') {
      return Promise.resolve({
        idUsuario: 'u1',
        nombre: 'Ana',
        email: 'ana@test.com',
        estado: 'activo',
        fechaRegistro: '2026-01-01',
        roles: [{ idRol: 1, nombre: 'Administrador' }],
        especialidades: [],
      })
    }
    if (path === '/sedes/') return Promise.resolve(sedes)
    if (path === '/ambientes/') return Promise.resolve(ambientes)
    return Promise.reject(new Error(`ruta no mockeada: ${path}`))
  })
  apiPostMock.mockResolvedValue({ idSede: 4, nombreSede: 'Sede nueva', direccion: 'Nueva dirección', tipoSede: 'principal' })
  apiPutMock.mockResolvedValue({ ...sedes[0], nombreSede: 'Sede principal actualizada' })
  apiDeleteMock.mockResolvedValue(undefined)
})

describe('Sedes', () => {
  it('carga la lista de sedes y cuenta ambientes por sede', async () => {
    renderConProviders(<Sedes />)

    expect(await screen.findByText('Sede principal')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-3')).toBeInTheDocument()
    expect(screen.getByText('2 ambientes')).toBeInTheDocument()
  })

  it('filtra por tipo y permite crear una sede', async () => {
    const usuario = userEvent.setup()
    renderConProviders(<Sedes />)

    await screen.findByText('Sede principal')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'secundaria')

    expect(screen.queryByText('Sede principal')).not.toBeInTheDocument()
    expect(screen.getByText('Sede norte')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Nueva sede' }))
    await usuario.type(screen.getByLabelText('Nombre de la sede'), 'Sede nueva')
    await usuario.type(screen.getByLabelText('Dirección'), 'Nueva dirección')
    await usuario.click(screen.getByRole('button', { name: 'Guardar sede' }))

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/sedes/', {
        nombreSede: 'Sede nueva',
        direccion: 'Nueva dirección',
        tipoSede: 'principal',
      })
    })
  })
})
