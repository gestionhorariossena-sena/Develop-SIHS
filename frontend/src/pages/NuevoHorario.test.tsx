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

  return { apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn(), ApiError: ApiErrorMock }
})

vi.mock('../services/api', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiDelete: mocks.apiDelete,
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
      .mockRejectedValueOnce(new mocks.ApiError(409, 'Conflicto', {
        ok: false,
        puedeGuardar: false,
        mensaje: 'La programación presenta conflictos.',
        conflictos: [{
          tipo: 'cruce_ambiente',
          mensaje: 'El ambiente ya está ocupado en ese horario.',
          idHorarioExistente: 100,
          idAmbiente: 1,
        }],
        resumen: { totalCruces: 1, tipos: ['cruce_ambiente'] },
      }))
      .mockResolvedValueOnce({})
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />)

    await usuario.click(await screen.findByRole('button', { name: 'Guardar horario' }))
    await screen.findByRole('button', { name: 'Programar de todas formas' })

    await usuario.click(screen.getByRole('button', { name: 'Programar de todas formas' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        '/horarios/',
        expect.objectContaining({ forzar: true }),
      )
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

  it('en modo edición (?editar=), precarga ficha/aprendices/fechas y el título cambia a "Modificar horario"', async () => {
    configurarCatalogos()
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/horarios-guardados/10') {
        return Promise.resolve({
          idHorarioGuardado: 10,
          idUsuario: '22222222-2222-2222-2222-222222222222',
          creadorNombre: 'Coordinadora',
          ficha: 'FICHA-EDIT',
          aprendices: '25',
          horasTrimestre: '30',
          fechaInicio: '2026-01-15',
          fechaFin: '2026-04-15',
          bloques: [],
          grid: gridVacio(),
          idsHorarios: [55, 56],
          fechaCreacion: '2026-01-01T00:00:00Z',
        })
      }
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

    renderConProviders(<NuevoHorario />, ['/horarios/nuevo?editar=10'])

    expect(await screen.findByText('Modificar horario')).toBeInTheDocument()
    expect(screen.getByLabelText('Ficha (referencia del formulario)')).toHaveValue('FICHA-EDIT')
    expect(screen.getByLabelText('Aprendices en formación a la fecha')).toHaveValue('25')
    expect(screen.getByLabelText('Horas asignadas trimestre')).toHaveValue('30')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('al guardar en modo edición, borra las clases y el snapshot originales antes de crear los nuevos', async () => {
    configurarCatalogos()
    const orden: string[] = []
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/horarios-guardados/10') {
        return Promise.resolve({
          idHorarioGuardado: 10,
          idUsuario: '22222222-2222-2222-2222-222222222222',
          creadorNombre: 'Coordinadora',
          ficha: 'FICHA-EDIT',
          aprendices: '25',
          horasTrimestre: '30',
          fechaInicio: '2026-01-15',
          fechaFin: '2026-04-15',
          bloques: [],
          grid: gridVacio(),
          idsHorarios: [55, 56],
          fechaCreacion: '2026-01-01T00:00:00Z',
        })
      }
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
    mocks.apiDelete.mockImplementation((ruta: string) => {
      orden.push(`DELETE ${ruta}`)
      return Promise.resolve(undefined)
    })
    mocks.apiPost.mockImplementation((ruta: string) => {
      orden.push(`POST ${ruta}`)
      if (ruta === '/horarios/validar') return Promise.resolve({ ok: true, puedeGuardar: true, mensaje: '', conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      if (ruta === '/horarios/') return Promise.resolve({ idHorario: 999 })
      return Promise.resolve({})
    })
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />, ['/horarios/nuevo?editar=10'])
    await usuario.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/horarios/', expect.objectContaining({ idFicha: 1 }))
    })

    expect(mocks.apiDelete).toHaveBeenCalledWith('/horarios/55')
    expect(mocks.apiDelete).toHaveBeenCalledWith('/horarios/56')
    expect(mocks.apiDelete).toHaveBeenCalledWith('/horarios-guardados/10')

    // Las clases y el snapshot viejos se borran ANTES de crear los
    // nuevos — si no, el POST /horarios/ podría chocar consigo mismo
    // (mismo día/hora/ficha/instructor/ambiente que lo que se está
    // reemplazando).
    const primerPost = orden.findIndex((linea) => linea.startsWith('POST'))
    const ultimoDelete = orden.reduce((ultimo, linea, indice) => (linea.startsWith('DELETE') ? indice : ultimo), -1)
    expect(ultimoDelete).toBeLessThan(primerPost)
  })

  it('si falla la carga del horario a modificar, muestra el error', async () => {
    configurarCatalogos()
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/horarios-guardados/10') return Promise.reject(new mocks.ApiError(404, 'Horario guardado no encontrado'))
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

    renderConProviders(<NuevoHorario />, ['/horarios/nuevo?editar=10'])

    expect(await screen.findByText('Horario guardado no encontrado')).toBeInTheDocument()
  })
})