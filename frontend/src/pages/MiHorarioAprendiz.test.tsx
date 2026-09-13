import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { MiHorarioAprendiz } from './MiHorarioAprendiz'
import type { Ficha, Horario } from '../types/api'

const { ApiErrorMock, apiGetMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { ApiErrorMock, apiGetMock: vi.fn() }
})

vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: ApiErrorMock,
}))

const FICHA: Ficha = {
  idFicha: 1,
  codigoFicha: '2874521',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  programa: {
    idPrograma: 1,
    codigoPrograma: 'ADSO',
    nombrePrograma: 'Análisis y Desarrollo de Software',
    nivelFormacion: 'Tecnólogo',
    activo: true,
    idCoordinacion: 1,
  },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre IV', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  sede: null,
  aprendicesTotales: 30,
  jornadas: [],
}

function crearHorario(overrides: Partial<Horario> = {}): Horario {
  return {
    idHorario: 100,
    horaInicio: '06:15:00',
    horaFin: '09:00:00',
    idJornada: 1,
    idTrimestre: 1,
    idAmbiente: 1,
    idInstructor: 'instructor-1',
    idFicha: 1,
    idResultado: 1,
    dias: [1],
    instructorNombre: 'Carlos Morales',
    fichaCodigo: '2874521',
    ambienteNombre: 'Laboratorio 302',
    resultadoCodigo: 'RA-1',
    resultadoDescripcion: 'Bases de Datos NoSQL',
    ...overrides,
  }
}

/** AppShell también llama a apiGet('/usuarios/me') al montar. */
function mockearRespuestas({
  ficha = FICHA,
  fichaError,
  horarios = [],
}: {
  ficha?: Ficha
  fichaError?: InstanceType<typeof ApiErrorMock>
  horarios?: Horario[]
}) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.reject(new ApiErrorMock(401, 'no mockeado'))
    if (path === '/ficha-usuario/mi-ficha') {
      return fichaError ? Promise.reject(fichaError) : Promise.resolve(ficha)
    }
    if (path === '/ficha-usuario/mi-horario') return Promise.resolve(horarios)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('MiHorarioAprendiz', () => {
  beforeEach(() => {
    // shouldAdvanceTime: true -- el reloj simulado avanza junto con el
    // real, así que el polling interno de findBy/waitFor de Testing
    // Library sigue funcionando; solo se fija el punto de partida.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Lunes 2026-01-05 08:00 (getDay() === 1)
    vi.setSystemTime(new Date(2026, 0, 5, 8, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra un mensaje si el aprendiz no tiene ficha vinculada', async () => {
    mockearRespuestas({ fichaError: new ApiErrorMock(404, 'No tienes una ficha vinculada') })
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText(/todavía no tienes una ficha vinculada/i)).toBeInTheDocument()
  })

  it('carga la ficha y el horario reales y pinta el encabezado', async () => {
    mockearRespuestas({ horarios: [crearHorario()] })
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText('Ficha 2874521')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Desarrollo de Software')).toBeInTheDocument()
    expect(screen.getByText('Trimestre IV')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/ficha-usuario/mi-horario')
  })

  it('pinta la clase en la grilla con instructor y ambiente', async () => {
    mockearRespuestas({ horarios: [crearHorario()] })
    renderConProviders(<MiHorarioAprendiz />)

    await screen.findByText('Ficha 2874521')

    // La celda de la grilla (CeldaHorario en modo soloLectura) expone
    // tematica/instructor/ambiente en el `title` -- más específico que
    // buscar el texto suelto, que también aparece en "Próxima clase" y
    // "Mis instructores".
    expect(screen.getByTitle(/Carlos Morales · Laboratorio 302/)).toBeInTheDocument()
  })

  it('calcula el resumen semanal (horas, materias, docentes) sobre los datos reales', async () => {
    mockearRespuestas({
      horarios: [
        crearHorario({ idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', dias: [1, 3], resultadoCodigo: 'RA-1' }),
        crearHorario({
          idHorario: 2,
          horaInicio: '09:00:00',
          horaFin: '12:00:00',
          dias: [1],
          resultadoCodigo: 'RA-2',
          idInstructor: 'instructor-2',
          instructorNombre: 'Diana Prieto',
          ambienteNombre: 'Ambiente 204',
        }),
      ],
    })
    renderConProviders(<MiHorarioAprendiz />)

    await screen.findByText('Ficha 2874521')

    // (2.75h * 2 días) + (3h * 1 día) = 8.5h
    expect(screen.getByText('8.5h')).toBeInTheDocument()
    expect(screen.getByText('Materias activas').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Docentes asignados').nextElementSibling).toHaveTextContent('2')

    const tarjetaInstructores = screen.getByText('Mis instructores').parentElement as HTMLElement
    expect(within(tarjetaInstructores).getByText('Diana Prieto')).toBeInTheDocument()
  })

  it('muestra la próxima clase con cuenta regresiva calculada contra la hora actual', async () => {
    mockearRespuestas({
      horarios: [crearHorario({ horaInicio: '10:00:00', horaFin: '12:00:00', dias: [1] })],
    })
    renderConProviders(<MiHorarioAprendiz />)

    await screen.findByText('Ficha 2874521')

    expect(screen.getByText('Próxima clase')).toBeInTheDocument()
    expect(screen.getByText('2h 0m')).toBeInTheDocument()
  })

  it('marca como vitrina (deshabilitados) los botones que no tienen dato real todavía', async () => {
    mockearRespuestas({ horarios: [crearHorario()] })
    renderConProviders(<MiHorarioAprendiz />)

    await screen.findByText('Ficha 2874521')

    expect(screen.getByRole('button', { name: 'Descargar Horario PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Vista Agenda' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reportar novedad de asistencia' })).toBeDisabled()
  })

  it('muestra el error del backend si la carga falla por algo distinto a 404', async () => {
    mockearRespuestas({ fichaError: new ApiErrorMock(500, 'falló') })
    renderConProviders(<MiHorarioAprendiz />)

    await waitFor(() => {
      expect(screen.getByText('falló')).toBeInTheDocument()
    })
  })
})
