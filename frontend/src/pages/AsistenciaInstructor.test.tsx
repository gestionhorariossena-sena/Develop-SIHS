import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { AsistenciaInstructor } from './AsistenciaInstructor'
import type { Horario, SesionAsistencia, Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'i-1',
  nombre: 'Carlos Díaz',
  email: 'carlos@mail.com',
  estado: 'activo',
  debeCambiarClave: false,
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 3, nombre: 'Instructor' }],
  especialidades: [],
}

// Lunes, para que caiga en el día del horario (dias: [1]).
const HORARIO: Horario = {
  idHorario: 100, horaInicio: '11:00:00', horaFin: '13:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'i-1', idFicha: 1, idResultado: 9, dias: [1],
  fechaCreacion: '2026-09-01T10:00:00Z', fechaModificacion: '2026-09-01T10:00:00Z',
  activo: true, publicado: true, instructorNombre: 'Carlos Díaz', fichaCodigo: '3171618',
  ambienteNombre: 'Laboratorio 302', resultadoCodigo: null,
  resultadoDescripcion: 'Arquitectura de software',
}

function sesion(overrides: Partial<SesionAsistencia> = {}): SesionAsistencia {
  return {
    idHorario: 100,
    fechaSesion: '2026-09-21',
    fichaCodigo: '3171618',
    resultadoDescripcion: 'Arquitectura de software',
    ambienteNombre: 'Laboratorio 302',
    horaInicio: '11:00:00',
    horaFin: '13:00:00',
    aprendices: [
      {
        idUsuario: 'a-1', nombre: 'Sara Rodríguez', numeroDocumento: '1023456789',
        rolEnFicha: null, estado: null, horaMarcacion: null, referenciaExcusa: null,
      },
      {
        idUsuario: 'a-2', nombre: 'Camilo Vargas', numeroDocumento: '1014234567',
        rolEnFicha: 'vocero', estado: null, horaMarcacion: null, referenciaExcusa: null,
      },
    ],
    registradaEn: null,
    registradaPor: null,
    ...overrides,
  }
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

function mockear(datosSesion: SesionAsistencia | Error = sesion()) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
    if (path === '/usuarios/me') return Promise.resolve(INSTRUCTOR)
    if (path === '/notificaciones/') return Promise.resolve([])
    if (path.startsWith('/asistencias/sesion')) {
      return datosSesion instanceof Error ? Promise.reject(datosSesion) : Promise.resolve(datosSesion)
    }
    return Promise.resolve([])
  })
}

describe('AsistenciaInstructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra la nómina de la ficha con su documento', async () => {
    mockear()
    renderConProviders(<AsistenciaInstructor />)

    expect(await screen.findByText('Sara Rodríguez')).toBeInTheDocument()
    expect(screen.getByText(/1023456789/)).toBeInTheDocument()
    // rolEnFicha sí existe en el backend, así que se muestra.
    expect(screen.getByText(/vocero/)).toBeInTheDocument()
  })

  it('marcar y guardar manda la lista completa de la sesión', async () => {
    mockear()
    apiPostMock.mockResolvedValue({ guardadas: 2, corregidas: 0, eraPrimeraVez: true })
    const usuario = userEvent.setup()
    renderConProviders(<AsistenciaInstructor />)

    const filaSara = (await screen.findByText('Sara Rodríguez')).closest('li')!
    await usuario.click(within(filaSara).getByRole('button', { name: 'Presente' }))

    const filaCamilo = screen.getByText('Camilo Vargas').closest('li')!
    await usuario.click(within(filaCamilo).getByRole('button', { name: 'Ausente' }))

    await usuario.click(screen.getByRole('button', { name: 'Guardar asistencia' }))

    expect(apiPostMock).toHaveBeenCalledWith('/asistencias/sesion', {
      idHorario: 100,
      fechaSesion: expect.any(String),
      marcas: [
        { idUsuarioAprendiz: 'a-1', estado: 'presente', referenciaExcusa: null },
        { idUsuarioAprendiz: 'a-2', estado: 'ausente', referenciaExcusa: null },
      ],
    })
  })

  it('marcar excusa pide la referencia y la manda', async () => {
    mockear()
    apiPostMock.mockResolvedValue({ guardadas: 1, corregidas: 0, eraPrimeraVez: true })
    const usuario = userEvent.setup()
    renderConProviders(<AsistenciaInstructor />)

    const fila = (await screen.findByText('Sara Rodríguez')).closest('li')!
    await usuario.click(within(fila).getByRole('button', { name: 'Excusa' }))

    const campo = screen.getByLabelText('Número de radicado o referencia:')
    await usuario.type(campo, 'RAD-2026-0922-EPS-04')
    await usuario.click(screen.getByRole('button', { name: 'Guardar asistencia' }))

    expect(apiPostMock).toHaveBeenCalledWith(
      '/asistencias/sesion',
      expect.objectContaining({
        marcas: [{ idUsuarioAprendiz: 'a-1', estado: 'excusa', referenciaExcusa: 'RAD-2026-0922-EPS-04' }],
      }),
    )
  })

  it('"marcar todos como presentes" deja lista la sesión de un golpe', async () => {
    mockear()
    const usuario = userEvent.setup()
    renderConProviders(<AsistenciaInstructor />)

    await usuario.click(await screen.findByRole('button', { name: 'Marcar todos como presentes' }))

    expect(screen.getByText('Todos marcados')).toBeInTheDocument()
    expect(screen.getByText('Presentes: 2')).toBeInTheDocument()
  })

  // Lo ya registrado entra como estado inicial: pasar lista otra vez es
  // corregir, no empezar de cero.
  it('una sesión ya registrada se abre con sus marcas y lo dice', async () => {
    mockear(
      sesion({
        registradaEn: '2026-09-21T11:15:00Z',
        registradaPor: 'Carlos Díaz',
        aprendices: [
          {
            idUsuario: 'a-1', nombre: 'Sara Rodríguez', numeroDocumento: '1023456789',
            rolEnFicha: null, estado: 'presente', horaMarcacion: '2026-09-21T11:05:00Z',
            referenciaExcusa: null,
          },
        ],
      }),
    )
    renderConProviders(<AsistenciaInstructor />)

    expect(await screen.findByText(/Sesión con asistencia registrada/)).toBeInTheDocument()
    const fila = screen.getByText('Sara Rodríguez').closest('li')!
    expect(within(fila).getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'true')
  })

  // La nómina sale de ficha_usuario, que hoy está incompleta: la pantalla
  // lo explica en vez de aparentar un curso vacío.
  it('si la ficha no tiene aprendices vinculados, explica por qué', async () => {
    mockear(sesion({ aprendices: [] }))
    renderConProviders(<AsistenciaInstructor />)

    expect(await screen.findByText('Esta ficha todavía no tiene aprendices vinculados')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar asistencia' })).not.toBeInTheDocument()
  })
})
