import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { DashboardAprendiz } from './DashboardAprendiz'
import type { Ficha, Horario, MiAsistencia, Usuario } from '../types/api'

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

const PERFIL: Usuario = {
  idUsuario: 'u1',
  nombre: 'Sara Rodríguez',
  email: 'sara@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 1, nombre: 'Aprendiz' }],
  especialidades: [],
  debeCambiarClave: false,
}

const FICHA: Ficha = {
  idFicha: 1,
  codigoFicha: '2874521',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  faseActual: 2,
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
  jornadas: ['Mañana'],
}

const HOY_ID = (() => {
  const dia = new Date().getDay()
  return dia === 0 ? 7 : dia
})()

const HORARIO: Horario = {
  idHorario: 1,
  horaInicio: '08:00:00',
  horaFin: '10:00:00',
  idJornada: 1,
  idTrimestre: 1,
  idAmbiente: 1,
  idInstructor: 'i1',
  idFicha: 1,
  idResultado: 1,
  dias: [HOY_ID],
  fechaCreacion: '2026-01-01T00:00:00Z',
  fechaModificacion: '2026-01-01T00:00:00Z',
  activo: true,
  publicado: true,
  instructorNombre: 'Carlos Díaz',
  fichaCodigo: '2874521',
  ambienteNombre: 'Ambiente 302',
  resultadoCodigo: 'RA-01',
  resultadoDescripcion: 'Análisis de requerimientos',
}

const ASISTENCIA: MiAsistencia = {
  resumen: {
    registradas: 10,
    presente: 9,
    tardanza: 0,
    excusa: 0,
    ausente: 1,
    porcentaje: 90,
  },
  sesiones: [],
}

function mockearRespuestas({ ficha, fichaError }: { ficha?: Ficha; fichaError?: InstanceType<typeof ApiErrorMock> }) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.resolve(PERFIL)
    if (path === '/ficha-usuario/mi-ficha') {
      return fichaError ? Promise.reject(fichaError) : Promise.resolve(ficha)
    }
    if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
    if (path === '/asistencias/mias') return Promise.resolve(ASISTENCIA)
    if (path === '/avisos/') return Promise.resolve([])
    return Promise.reject(new Error(`no mockeado: ${path}`))
  })
}

describe('DashboardAprendiz', () => {
  it('usa el nuevo encabezado y muestra la ficha vinculada', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    expect(await screen.findByText('Hola, Aprendiz Sara Rodríguez')).toBeInTheDocument()
    expect(await screen.findByText('Ficha 2874521')).toBeInTheDocument()
    expect(screen.getAllByText('Análisis y Desarrollo de Software').length).toBeGreaterThan(0)
    expect(screen.getByText('Fase 2')).toBeInTheDocument()
  })

  it('muestra resumen real de asistencia y carga del día', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    expect(await screen.findByText('90%')).toBeInTheDocument()
    expect(screen.getByText('10 asistencias registradas')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('horas presenciales')).toBeInTheDocument()
  })

  it('muestra el cronograma de hoy con datos reales del horario', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    expect(await screen.findByText('Mi cronograma de hoy')).toBeInTheDocument()
    expect(screen.getByText('RA-01')).toBeInTheDocument()
    expect(screen.getByText('Carlos Díaz')).toBeInTheDocument()
    expect(screen.getAllByText('Ambiente 302').length).toBeGreaterThan(0)
  })

  it('no bloquea el dashboard si el aprendiz no tiene ficha vinculada', async () => {
    mockearRespuestas({ fichaError: new ApiErrorMock(404, 'No tienes una ficha vinculada') })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Aprendiz Sara Rodríguez')
    await waitFor(() => expect(screen.getByText('Sin ficha vinculada')).toBeInTheDocument())
  })

  it('los accesos rápidos apuntan a las rutas reales del Aprendiz', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Aprendiz Sara Rodríguez')
    const contenido = within(screen.getByRole('main'))

    expect(contenido.getAllByRole('link', { name: /Mi horario/ }).some((link) => link.getAttribute('href') === '/mi-horario-aprendiz')).toBe(true)
    expect(contenido.getByRole('link', { name: 'Mensajes' })).toHaveAttribute('href', '/mensajes')
    expect(contenido.getByRole('link', { name: 'Ver avisos' })).toHaveAttribute('href', '/avisos')
    expect(contenido.getByRole('link', { name: 'Mi asistencia' })).toHaveAttribute('href', '/mi-asistencia')
  })
})
