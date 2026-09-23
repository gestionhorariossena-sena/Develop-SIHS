import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { MiHorarioAprendiz } from './MiHorarioAprendiz'
import { ApiError } from '../services/api'
import type { Ficha, Horario } from '../types/api'

const FICHA: Ficha = {
  idFicha: 21, codigoFicha: '3171618', idPrograma: 1, idTrimestre: 1, idSede: 1,
  programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre 1 - 2026', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  sede: null,
  aprendicesTotales: 1,
  jornadas: ['Mañana'],
}

const HORARIO: Horario = {
  idHorario: 169, horaInicio: '11:00:00', horaFin: '13:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 21, idResultado: 1, dias: [4],
  fechaCreacion: '2026-09-14T11:00:00Z', fechaModificacion: '2026-09-14T11:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Instructor de Prueba', fichaCodigo: '3171618', ambienteNombre: 'Ambiente',
  resultadoCodigo: null, resultadoDescripcion: '01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO',
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

describe('MiHorarioAprendiz', () => {
  it('carga la ficha vinculada y muestra el bloque publicado en el grid', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText('Ficha 3171618')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Desarrollo de Software · Trimestre 1 - 2026')).toBeInTheDocument()
    expect(screen.getByText('01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO')).toBeInTheDocument()
  })

  it('sin ficha vinculada (404), pide hablar con el coordinador', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha' || path === '/ficha-usuario/mi-horario') {
        return Promise.reject(new ApiError(404, 'No tienes una ficha vinculada'))
      }
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText('Todavía no tienes una ficha vinculada. Habla con tu coordinador para que te la asigne.')).toBeInTheDocument()
  })

  it('bloques no publicados (todavía en borrador) no se muestran', async () => {
    const sinPublicar: Horario = { ...HORARIO, idHorario: 170, publicado: false }
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([sinPublicar])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<MiHorarioAprendiz />)

    await screen.findByText('Ficha 3171618')
    expect(screen.getByText('Tu ficha todavía no tiene horarios publicados.')).toBeInTheDocument()
  })
})
