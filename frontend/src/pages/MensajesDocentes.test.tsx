import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { MensajesDocentes } from './MensajesDocentes'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

const { ApiErrorMock, apiGetMock, apiPostMock, apiPatchMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { ApiErrorMock, apiGetMock: vi.fn(), apiPostMock: vi.fn(), apiPatchMock: vi.fn() }
})

vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  ApiError: ApiErrorMock,
}))

const MI_PERFIL: Usuario = {
  idUsuario: 'aprendiz-1',
  nombre: 'Sara Rodríguez',
  email: 'sara@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 1, nombre: 'Aprendiz' }],
  especialidades: [],
  debeCambiarClave: false,
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

function crearConversacion(overrides: Partial<Conversacion> = {}): Conversacion {
  return {
    idConversacion: 1,
    idAprendiz: 'aprendiz-1',
    idInstructor: 'instructor-1',
    fechaCreacion: '2026-01-01T08:00:00Z',
    ...overrides,
  }
}

function crearMensaje(overrides: Partial<Mensaje> = {}): Mensaje {
  return {
    idMensaje: 1,
    idConversacion: 1,
    idRemitente: 'instructor-1',
    contenido: 'Hola, ¿cómo vas con el proyecto?',
    adjuntoUrl: null,
    leido: false,
    fechaEnvio: '2026-01-05T09:00:00Z',
    ...overrides,
  }
}

function mockearRespuestas({
  horarios = [crearHorario()],
  horariosError,
  conversaciones = [],
  mensajesPorConversacion = {},
}: {
  horarios?: Horario[]
  horariosError?: InstanceType<typeof ApiErrorMock>
  conversaciones?: Conversacion[]
  mensajesPorConversacion?: Record<number, Mensaje[]>
}) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.resolve(MI_PERFIL)
    if (path === '/mensajeria/conversaciones') return Promise.resolve(conversaciones)
    if (path === '/ficha-usuario/mi-horario') {
      return horariosError ? Promise.reject(horariosError) : Promise.resolve(horarios)
    }
    const match = /\/mensajeria\/conversaciones\/(\d+)\/mensajes/.exec(path)
    if (match) return Promise.resolve(mensajesPorConversacion[Number(match[1])] ?? [])
    return Promise.reject(new Error(`no mockeado: ${path}`))
  })
}

describe('MensajesDocentes', () => {
  beforeEach(() => {
    apiPostMock.mockReset()
    apiPatchMock.mockReset()
    apiPatchMock.mockResolvedValue({})
  })

  it('muestra un mensaje si el aprendiz no tiene ficha vinculada', async () => {
    mockearRespuestas({ horariosError: new ApiErrorMock(404, 'No tienes una ficha vinculada') })
    renderConProviders(<MensajesDocentes />)

    expect(await screen.findByText(/todavía no tienes una ficha vinculada/i)).toBeInTheDocument()
  })

  it('lista los instructores de la ficha como contactos', async () => {
    mockearRespuestas({})
    renderConProviders(<MensajesDocentes />)

    expect(await screen.findByText('Carlos Morales')).toBeInTheDocument()
    expect(screen.getByText('Sin conversación aún')).toBeInTheDocument()
  })

  it('al elegir un contacto sin conversación previa, la crea y carga sus mensajes', async () => {
    mockearRespuestas({ mensajesPorConversacion: { 1: [] } })
    apiPostMock.mockResolvedValue(crearConversacion())
    const usuario = userEvent.setup()
    renderConProviders(<MensajesDocentes />)

    await usuario.click(await screen.findByText('Carlos Morales'))

    expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones', { idInstructor: 'instructor-1' })
    expect(await screen.findByText('Todavía no hay mensajes — escribe el primero.')).toBeInTheDocument()
  })

  it('al elegir un contacto con conversación existente, no crea una nueva y marca como leídos los mensajes del instructor', async () => {
    mockearRespuestas({
      conversaciones: [crearConversacion()],
      mensajesPorConversacion: { 1: [crearMensaje({ idMensaje: 5, leido: false })] },
    })
    const usuario = userEvent.setup()
    renderConProviders(<MensajesDocentes />)

    await usuario.click(await screen.findByText('Carlos Morales'))

    expect(await screen.findByText('Hola, ¿cómo vas con el proyecto?')).toBeInTheDocument()
    expect(apiPostMock).not.toHaveBeenCalled()
    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/mensajeria/mensajes/5/leido'))
  })

  it('envía un mensaje nuevo y lo agrega al hilo', async () => {
    mockearRespuestas({
      conversaciones: [crearConversacion()],
      mensajesPorConversacion: { 1: [] },
    })
    apiPostMock.mockResolvedValue(
      crearMensaje({ idMensaje: 9, idRemitente: 'aprendiz-1', contenido: '¡Todo bien, profe!', leido: false }),
    )
    const usuario = userEvent.setup()
    renderConProviders(<MensajesDocentes />)

    await usuario.click(await screen.findByText('Carlos Morales'))
    await screen.findByText('Todavía no hay mensajes — escribe el primero.')

    await usuario.type(screen.getByPlaceholderText(/Escribe tu consulta para Carlos Morales/), '¡Todo bien, profe!')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones/1/mensajes', { contenido: '¡Todo bien, profe!' })
    expect(await screen.findByText('¡Todo bien, profe!')).toBeInTheDocument()
  })

  it('el buscador filtra contactos por nombre o materia', async () => {
    mockearRespuestas({
      horarios: [
        crearHorario(),
        crearHorario({
          idHorario: 200,
          idInstructor: 'instructor-2',
          instructorNombre: 'Diana Prieto',
          resultadoCodigo: 'RA-2',
          resultadoDescripcion: 'APIs REST',
        }),
      ],
    })
    const usuario = userEvent.setup()
    renderConProviders(<MensajesDocentes />)

    await screen.findByText('Carlos Morales')
    expect(screen.getByText('Diana Prieto')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Buscar instructor o materia'), 'Diana')

    expect(screen.queryByText('Carlos Morales')).not.toBeInTheDocument()
    expect(screen.getByText('Diana Prieto')).toBeInTheDocument()
  })

  it('el tab "Canal Ficha" está deshabilitado (vitrina, sin canal grupal en el backend)', async () => {
    mockearRespuestas({})
    renderConProviders(<MensajesDocentes />)

    await screen.findByText('Carlos Morales')
    expect(screen.getByRole('button', { name: 'Canal Ficha' })).toBeDisabled()
  })
})
