import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { DashboardAprendiz } from './DashboardAprendiz'
import type { Ficha, Usuario } from '../types/api'

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

function mockearRespuestas({ ficha, fichaError }: { ficha?: Ficha; fichaError?: InstanceType<typeof ApiErrorMock> }) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.resolve(PERFIL)
    if (path === '/ficha-usuario/mi-ficha') {
      return fichaError ? Promise.reject(fichaError) : Promise.resolve(ficha)
    }
    return Promise.reject(new Error(`no mockeado: ${path}`))
  })
}

describe('DashboardAprendiz', () => {
  it('saluda por el nombre de pila y muestra la ficha vinculada', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    expect(await screen.findByText('Hola, Sara')).toBeInTheDocument()
    expect(await screen.findByText('Ficha 2874521')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Desarrollo de Software')).toBeInTheDocument()
  })

  it('no muestra la tarjeta de ficha si el aprendiz no tiene una vinculada', async () => {
    mockearRespuestas({ fichaError: new ApiErrorMock(404, 'No tienes una ficha vinculada') })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Sara')
    await waitFor(() => expect(screen.queryByText(/^Ficha /)).not.toBeInTheDocument())
  })

  it('enlaza a las 4 pantallas del Aprendiz', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Sara')

    // Se acota al <main> porque el sidebar (AppShell) también linkea a
    // estas mismas rutas dentro del grupo "MI TRABAJO".
    const contenido = within(screen.getByRole('main'))
    expect(contenido.getByRole('link', { name: /Mi Horario/ })).toHaveAttribute('href', '/mi-horario')
    expect(contenido.getByRole('link', { name: /Mensajes Docentes/ })).toHaveAttribute('href', '/mensajes-docentes')
    expect(contenido.getByRole('link', { name: /Avisos & Eventos/ })).toHaveAttribute('href', '/avisos')
    expect(contenido.getByRole('link', { name: /Notificaciones/ })).toHaveAttribute('href', '/notificaciones')
  })
})
