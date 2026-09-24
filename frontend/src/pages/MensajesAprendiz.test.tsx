import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { MensajesAprendiz } from './MensajesAprendiz'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

const APRENDIZ: Usuario = {
  idUsuario: 'a-1',
  nombre: 'Sara Rodríguez',
  email: 'sara@mail.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 4, nombre: 'Aprendiz' }],
  especialidades: [],
}

const HORARIO: Horario = {
  idHorario: 169, horaInicio: '11:00:00', horaFin: '13:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'i-1', idFicha: 21, idResultado: 1, dias: [4],
  fechaCreacion: '2026-09-14T11:00:00Z', fechaModificacion: '2026-09-14T11:00:00Z',
  activo: true, publicado: true, instructorNombre: 'Carlos Morales', fichaCodigo: '3171618',
  ambienteNombre: 'Laboratorio 302', resultadoCodigo: null,
  resultadoDescripcion: 'Arquitectura de software',
}

const CONVERSACION: Conversacion = {
  idConversacion: 5,
  idAprendiz: 'a-1',
  idInstructor: 'i-1',
  fechaCreacion: '2026-09-20T10:00:00Z',
  aprendizNombre: 'Sara Rodríguez',
  instructorNombre: 'Carlos Morales',
}

const MENSAJE_DEL_INSTRUCTOR: Mensaje = {
  idMensaje: 1,
  idConversacion: 5,
  idRemitente: 'i-1',
  contenido: 'Revisa el capítulo 4 antes de la sesión.',
  adjuntoUrl: null,
  leido: false,
  fechaEnvio: new Date().toISOString(),
}

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPatchMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

function mockear({
  conversaciones = [] as Conversacion[],
  horarios = [HORARIO],
  mensajes = [] as Mensaje[],
} = {}) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/mensajeria/conversaciones') return Promise.resolve(conversaciones)
    if (path === '/ficha-usuario/mi-horario') return Promise.resolve(horarios)
    if (path === '/usuarios/me') return Promise.resolve(APRENDIZ)
    if (path.endsWith('/mensajes')) return Promise.resolve(mensajes)
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('MensajesAprendiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Con quién puede hablar sale de su horario: es la misma regla que el
  // backend valida al crear el hilo, y no hay catálogo que el aprendiz
  // pueda leer.
  it('lista a los instructores que le dictan, con lo que le dictan', async () => {
    mockear()
    renderConProviders(<MensajesAprendiz />)

    expect(await screen.findByText('Carlos Morales')).toBeInTheDocument()
    expect(screen.getByText('Arquitectura de software')).toBeInTheDocument()
  })

  it('el primer mensaje crea la conversación y después la reutiliza', async () => {
    const enviado: Mensaje = {
      idMensaje: 9, idConversacion: 5, idRemitente: 'a-1',
      contenido: '¿Podemos revisar el taller?', adjuntoUrl: null, leido: false,
      fechaEnvio: new Date().toISOString(),
    }
    // El servidor ya lo tiene en cuanto se envía: si el hilo se recarga
    // después, tiene que seguir viéndose (esa recarga llegó a pisarlo).
    const yaEnServidor: Mensaje[] = []
    mockear({ mensajes: yaEnServidor })
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/mensajeria/conversaciones') return Promise.resolve([])
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
      if (path === '/usuarios/me') return Promise.resolve(APRENDIZ)
      if (path.endsWith('/mensajes')) return Promise.resolve([...yaEnServidor])
      return Promise.resolve([])
    })
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/mensajeria/conversaciones') return Promise.resolve(CONVERSACION)
      yaEnServidor.push(enviado)
      return Promise.resolve(enviado)
    })

    const usuario = userEvent.setup()
    renderConProviders(<MensajesAprendiz />)

    await usuario.click(await screen.findByText('Carlos Morales'))
    await usuario.type(screen.getByLabelText('Escribe tu consulta'), '¿Podemos revisar el taller?')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones', { idInstructor: 'i-1' })
    expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones/5/mensajes', {
      contenido: '¿Podemos revisar el taller?',
    })
    expect(await screen.findByText('¿Podemos revisar el taller?')).toBeInTheDocument()
  })

  it('con una conversación ya abierta no vuelve a crearla', async () => {
    mockear({ conversaciones: [CONVERSACION], mensajes: [] })
    apiPostMock.mockResolvedValue({
      idMensaje: 10, idConversacion: 5, idRemitente: 'a-1', contenido: 'Gracias',
      adjuntoUrl: null, leido: false, fechaEnvio: new Date().toISOString(),
    })

    const usuario = userEvent.setup()
    renderConProviders(<MensajesAprendiz />)

    await usuario.click(await screen.findByText('Carlos Morales'))
    await usuario.type(screen.getByLabelText('Escribe tu consulta'), 'Gracias')
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(apiPostMock).not.toHaveBeenCalledWith('/mensajeria/conversaciones', expect.anything())
    expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones/5/mensajes', { contenido: 'Gracias' })
  })

  it('al abrir el hilo marca como leído lo que le escribieron', async () => {
    mockear({ conversaciones: [CONVERSACION], mensajes: [MENSAJE_DEL_INSTRUCTOR] })
    apiPatchMock.mockResolvedValue({ ...MENSAJE_DEL_INSTRUCTOR, leido: true })

    const usuario = userEvent.setup()
    renderConProviders(<MensajesAprendiz />)

    await usuario.click(await screen.findByText('Carlos Morales'))

    expect(await screen.findByText('Revisa el capítulo 4 antes de la sesión.')).toBeInTheDocument()
    expect(apiPatchMock).toHaveBeenCalledWith('/mensajeria/mensajes/1/leido')
  })

  it('sin horario publicado no ofrece a nadie a quien escribirle', async () => {
    mockear({ horarios: [] })
    renderConProviders(<MensajesAprendiz />)

    expect(await screen.findByText('Todavía no tienes instructores a quién escribirle')).toBeInTheDocument()
  })
})
