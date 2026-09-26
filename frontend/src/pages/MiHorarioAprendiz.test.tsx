import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { MiHorarioAprendiz } from './MiHorarioAprendiz'
import type { AnotacionHorario, Ficha, Horario } from '../types/api'

const { ApiErrorMock, apiGetMock, apiPostMock, apiPutMock, apiDeleteMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { ApiErrorMock, apiGetMock: vi.fn(), apiPostMock: vi.fn(), apiPutMock: vi.fn(), apiDeleteMock: vi.fn() }
})

vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
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
    fechaCreacion: '2026-01-01T00:00:00Z',
    fechaModificacion: '2026-01-01T00:00:00Z',
    activo: true,
    publicado: true,
    instructorNombre: 'Carlos Morales',
    fichaCodigo: '2874521',
    ambienteNombre: 'Laboratorio 302',
    resultadoCodigo: 'RA-1',
    resultadoDescripcion: 'Bases de Datos NoSQL',
    ...overrides,
  }
}

function crearAnotacion(overrides: Partial<AnotacionHorario> = {}): AnotacionHorario {
  return {
    idAnotacion: 1,
    idUsuario: 'aprendiz-1',
    idHorario: 100,
    nota: 'Traer calculadora',
    etiqueta: 'Examen',
    recordatorioActivo: false,
    fechaCreacion: '2026-01-01T08:00:00Z',
    ...overrides,
  }
}

/** AppShell también llama a apiGet('/usuarios/me') al montar. */
function mockearRespuestas({
  ficha = FICHA,
  fichaError,
  horarios = [],
  anotaciones = [],
}: {
  ficha?: Ficha
  fichaError?: InstanceType<typeof ApiErrorMock>
  horarios?: Horario[]
  anotaciones?: AnotacionHorario[]
}) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.reject(new ApiErrorMock(401, 'no mockeado'))
    if (path === '/ficha-usuario/mi-ficha') {
      return fichaError ? Promise.reject(fichaError) : Promise.resolve(ficha)
    }
    if (path === '/ficha-usuario/mi-horario') return Promise.resolve(horarios)
    if (path === '/anotaciones-horario/mias') return Promise.resolve(anotaciones)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('MiHorarioAprendiz', () => {
  beforeEach(() => {
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
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

  // H-1: antes este estado solo informaba ("vincúlala desde tu perfil"),
  // y en el perfil tampoco había nada. Ahora se resuelve desde acá.
  it('sin ficha vinculada ofrece el formulario para vincularla', async () => {
    mockearRespuestas({ fichaError: new ApiErrorMock(404, 'No tienes una ficha vinculada') })
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText('Vincula tu ficha para ver tu horario')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de ficha')).toBeInTheDocument()
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

  describe('Organizador personal (anotaciones)', () => {
    it('pinta el punto de color de la anotación real en la celda de la grilla', async () => {
      mockearRespuestas({ horarios: [crearHorario()], anotaciones: [crearAnotacion({ etiqueta: 'Examen' })] })
      renderConProviders(<MiHorarioAprendiz />)

      expect(await screen.findByRole('button', { name: /con anotación Examen/ })).toBeInTheDocument()
      expect(screen.getByText('1 nota')).toBeInTheDocument()
    })

    it('sin anotaciones, la celda no es un botón (solo lectura) y el organizador lo indica', async () => {
      mockearRespuestas({ horarios: [crearHorario()] })
      renderConProviders(<MiHorarioAprendiz />)
      await screen.findByText('Ficha 2874521')

      expect(screen.queryByRole('button', { name: /con anotación/ })).not.toBeInTheDocument()
      expect(
        screen.getByText('Haz clic en cualquier clase de tu grilla para agregar una nota, recordatorio o etiqueta (Examen, Entrega, Importante).'),
      ).toBeInTheDocument()
    })

    it('crea una anotación nueva al hacer clic en una clase sin nota', async () => {
      mockearRespuestas({ horarios: [crearHorario()] })
      apiPostMock.mockResolvedValue(crearAnotacion({ nota: 'Repasar joins', etiqueta: 'Entrega' }))
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderConProviders(<MiHorarioAprendiz />)
      await screen.findByText('Ficha 2874521')

      await usuario.click(screen.getByTitle('RA-1 — Bases de Datos NoSQL · Carlos Morales · Laboratorio 302'))

      expect(await screen.findByRole('dialog', { name: 'Organizador personal de la clase' })).toBeInTheDocument()

      await usuario.type(screen.getByLabelText('Nota'), 'Repasar joins')
      await usuario.click(screen.getByRole('button', { name: 'Entrega' }))
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(apiPostMock).toHaveBeenCalledWith('/anotaciones-horario/', {
        idHorario: 100,
        nota: 'Repasar joins',
        etiqueta: 'Entrega',
        recordatorioActivo: false,
      })

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(screen.getByText('Repasar joins')).toBeInTheDocument()
    })

    it('edita una anotación existente (PUT) y permite eliminarla (DELETE)', async () => {
      const anotacionExistente = crearAnotacion({ idAnotacion: 7, nota: 'Traer calculadora', etiqueta: 'Examen' })
      mockearRespuestas({ horarios: [crearHorario()], anotaciones: [anotacionExistente] })
      apiPutMock.mockResolvedValue({ ...anotacionExistente, nota: 'Traer calculadora científica' })
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderConProviders(<MiHorarioAprendiz />)
      await screen.findByText('Ficha 2874521')

      await usuario.click(screen.getByRole('button', { name: /con anotación Examen/ }))

      const campoNota = await screen.findByLabelText('Nota')
      expect(campoNota).toHaveValue('Traer calculadora')

      await usuario.clear(campoNota)
      await usuario.type(campoNota, 'Traer calculadora científica')
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(apiPutMock).toHaveBeenCalledWith('/anotaciones-horario/7', {
        idHorario: 100,
        nota: 'Traer calculadora científica',
        etiqueta: 'Examen',
        recordatorioActivo: false,
      })

      await waitFor(() => {
        expect(screen.getByText('Traer calculadora científica')).toBeInTheDocument()
      })

      apiDeleteMock.mockResolvedValue({ mensaje: 'Anotación eliminada' })
      await usuario.click(screen.getByRole('button', { name: /con anotación Examen/ }))
      await usuario.click(await screen.findByRole('button', { name: 'Eliminar' }))

      expect(apiDeleteMock).toHaveBeenCalledWith('/anotaciones-horario/7')
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(
        screen.getByText('Haz clic en cualquier clase de tu grilla para agregar una nota, recordatorio o etiqueta (Examen, Entrega, Importante).'),
      ).toBeInTheDocument()
    })

    it('muestra el error del backend si falla el guardado', async () => {
      mockearRespuestas({ horarios: [crearHorario()] })
      apiPostMock.mockRejectedValue(new ApiErrorMock(400, 'La nota no puede estar vacía'))
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderConProviders(<MiHorarioAprendiz />)
      await screen.findByText('Ficha 2874521')

      await usuario.click(screen.getByTitle('RA-1 — Bases de Datos NoSQL · Carlos Morales · Laboratorio 302'))
      await usuario.type(await screen.findByLabelText('Nota'), 'x')
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      expect(await screen.findByText('La nota no puede estar vacía')).toBeInTheDocument()
    })
  })
})
