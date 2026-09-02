import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuevoHorario } from './NuevoHorario'
import { renderConProviders } from '../test/renderConProviders'
import { gridVacio } from './horario/useHorarioState'

const mocks = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    detail: unknown

    constructor(status: number, message: string, detail?: unknown) {
      super(message)
      this.status = status
      this.detail = detail
    }
  }

  return { apiGet: vi.fn(), apiPost: vi.fn(), ApiError: ApiErrorMock }
})

vi.mock('../services/api', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  ApiError: mocks.ApiError,
}))

vi.mock('../components/horario/HorarioEditor', () => ({
  HorarioEditor: ({ onCambiarEstado }: { onCambiarEstado: (estado: unknown) => void }) => {
    const grid = gridVacio()
    grid[0][0] = 'bloque-1'
    onCambiarEstado({
      bloques: [{
        id: 'bloque-1',
        tematica: 'Programación',
        instructor: 'Ana Ríos',
        ficha: '3228973',
        ambiente: 'Ambiente 101',
        idResultado: 9,
        idInstructor: '11111111-1111-1111-1111-111111111111',
        idFicha: 1,
        idTrimestre: 1,
        idAmbiente: 1,
      }],
      grid,
    })
    return <div>Editor de horario</div>
  },
}))

function configurarCatalogos() {
  mocks.apiGet.mockImplementation((ruta: string) => {
    if (ruta === '/usuarios/me') {
      return Promise.resolve({
        idUsuario: '22222222-2222-2222-2222-222222222222',
        nombre: 'Coordinadora',
        email: 'coordinadora@example.com',
        roles: [{ idRol: 1, nombre: 'Coordinador' }],
      })
    }
    if (ruta === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
    if (ruta === '/dias-semana/') return Promise.resolve([{ idDia: 1, nombreDia: 'Lunes' }])
    return Promise.resolve([])
  })
}

describe('NuevoHorario', () => {
  it('al pulsar Programar de todas formas reintenta el guardado con forzar=true', async () => {
    configurarCatalogos()
    mocks.apiPost
      .mockRejectedValueOnce(new mocks.ApiError(409, 'Conflicto', { mensajes: ['Cruce de ambiente'] }))
      .mockResolvedValueOnce({})
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />)

    await usuario.click(await screen.findByRole('button', { name: 'Guardar horario' }))
    await screen.findByRole('button', { name: 'Programar de todas formas' })

    await usuario.click(screen.getByRole('button', { name: 'Programar de todas formas' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledTimes(2)
    })
    expect(mocks.apiPost).toHaveBeenNthCalledWith(
      2,
      '/horarios/',
      expect.objectContaining({
        idAmbiente: 1,
        idFicha: 1,
        idInstructor: '11111111-1111-1111-1111-111111111111',
        forzar: true,
      }),
    )
  })
})