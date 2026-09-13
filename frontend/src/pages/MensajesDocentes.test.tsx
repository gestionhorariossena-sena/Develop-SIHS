import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { MensajesDocentes } from './MensajesDocentes'
import type { Conversacion, Horario, Mensaje, Usuario } from '../types/api'

const APRENDIZ: Usuario = {
  idUsuario: 'aprendiz-1',
  nombre: 'Sara Rodríguez',
  email: 'sara@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 3, nombre: 'Aprendiz' }],
  especialidades: [],
}

const HORARIO_MORALES: Horario = {
  idHorario: 1, horaInicio: '10:00:00', horaFin: '12:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'instructor-1', idFicha: 1, idResultado: 1, dias: [1],
  fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Carlos Morales', fichaCodigo: '2670142', ambienteNombre: 'Lab 302',
  resultadoCodigo: 'CPL1', resultadoDescripcion: 'Bases de Datos NoSQL',
}

const HORARIO_PRIETO: Horario = {
  ...HORARIO_MORALES,
  idHorario: 2, idInstructor: 'instructor-2', instructorNombre: 'Diana Prieto',
  ambienteNombre: 'Lab 201', resultadoDescripcion: 'APIs RESTful',
}

const CONVERSACION_MORALES: Conversacion = {
  idConversacion: 10, idAprendiz: 'aprendiz-1', idInstructor: 'instructor-1', fechaCreacion: '2026-01-01T00:00:00Z',
}

const MENSAJE_NO_LEIDO: Mensaje = {
  idMensaje: 100, idConversacion: 10, idRemitente: 'instructor-1', contenido: 'Recuerden traer el script listo',
  adjuntoUrl: null, leido: false, fechaEnvio: '2026-03-27T10:42:00Z',
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

function mockearApis({
  horarios = [HORARIO_MORALES, HORARIO_PRIETO],
  conversaciones = [] as Conversacion[],
  mensajesPorConversacion = {} as Record<number, Mensaje[]>,
}) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.resolve(APRENDIZ)
    if (path === '/ficha-usuario/mi-horario') return Promise.resolve(horarios)
    if (path === '/mensajeria/conversaciones') return Promise.resolve(conversaciones)

    const match = path.match(/\/mensajeria\/conversaciones\/(\d+)\/mensajes/)
    if (match) return Promise.resolve(mensajesPorConversacion[Number(match[1])] ?? [])

    return Promise.reject(new Error(`no mockeado: ${path}`))
  })
}

describe('MensajesDocentes', () => {
  it('agrupa los instructores desde /ficha-usuario/mi-horario sin pedir un directorio aparte', async () => {
    mockearApis({})
    renderConProviders(<MensajesDocentes />)

    expect(apiGetMock).toHaveBeenCalledWith('/ficha-usuario/mi-horario')
    expect(await screen.findByText('Carlos Morales')).toBeInTheDocument()
    expect(screen.getByText('Diana Prieto')).toBeInTheDocument()
    expect(screen.getByText('Bases de Datos NoSQL')).toBeInTheDocument()
  })

  it('muestra el badge de mensajes sin leer de una conversación existente', async () => {
    mockearApis({
      conversaciones: [CONVERSACION_MORALES],
      mensajesPorConversacion: { 10: [MENSAJE_NO_LEIDO] },
    })
    renderConProviders(<MensajesDocentes />)

    await screen.findByText('Carlos Morales')
    expect(await screen.findByText('1')).toBeInTheDocument()
    expect(await screen.findByText('1 mensaje nuevo sin leer')).toBeInTheDocument()
  })

  it('al abrir una conversación con mensajes sin leer, marca cada uno como leído', async () => {
    mockearApis({
      conversaciones: [CONVERSACION_MORALES],
      mensajesPorConversacion: { 10: [MENSAJE_NO_LEIDO] },
    })
    apiPatchMock.mockResolvedValue({ ...MENSAJE_NO_LEIDO, leido: true })
    const usuario = userEvent.setup()
    renderConProviders(<MensajesDocentes />)

    await usuario.click(await screen.findByText('Carlos Morales'))

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/mensajeria/mensajes/100/leido'))
  })

  it('sin conversación previa, enviar el primer mensaje crea la conversación y luego el mensaje', async () => {
    mockearApis({})
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/mensajeria/conversaciones') {
        return Promise.resolve({ idConversacion: 55, idAprendiz: 'aprendiz-1', idInstructor: 'instructor-1', fechaCreacion: '2026-01-01T00:00:00Z' })
      }
      if (path === '/mensajeria/conversaciones/55/mensajes') {
        return Promise.resolve({
          idMensaje: 200, idConversacion: 55, idRemitente: 'aprendiz-1', contenido: 'Hola profe',
          adjuntoUrl: null, leido: false, fechaEnvio: '2026-03-27T10:42:00Z',
        })
      }
      return Promise.reject(new Error(`no mockeado: ${path}`))
    })
    const usuario = userEvent.setup()
    renderConProviders(<MensajesDocentes />)

    await usuario.click(await screen.findByText('Carlos Morales'))
    expect(await screen.findByText(/Aún no has enviado mensajes/)).toBeInTheDocument()

    await usuario.type(screen.getByPlaceholderText('Escribe tu consulta para Carlos Morales...'), 'Hola profe')
    await usuario.click(screen.getByRole('button', { name: /Enviar/ }))

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones', { idInstructor: 'instructor-1' }),
    )
    expect(apiPostMock).toHaveBeenCalledWith('/mensajeria/conversaciones/55/mensajes', {
      contenido: 'Hola profe',
      adjuntoUrl: undefined,
    })
    expect((await screen.findAllByText('Hola profe')).length).toBeGreaterThan(0)
  })

  it('la pestaña Canal Ficha está deshabilitada (fuera de alcance v1)', async () => {
    mockearApis({})
    renderConProviders(<MensajesDocentes />)

    await screen.findByText('Carlos Morales')
    expect(screen.getByRole('button', { name: 'Canal Ficha' })).toBeDisabled()
  })
})
