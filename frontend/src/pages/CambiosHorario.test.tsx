import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { CambiosHorario } from './CambiosHorario'
import type { Horario, SolicitudCambioHorario, Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'i-1',
  nombre: 'Carlos López',
  email: 'carlos@mail.com',
  estado: 'activo',
  debeCambiarClave: false,
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 3, nombre: 'Instructor' }],
  especialidades: [],
}

const HORARIO: Horario = {
  idHorario: 169, horaInicio: '11:00:00', horaFin: '13:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'i-1', idFicha: 21, idResultado: 1, dias: [4],
  fechaCreacion: '2026-09-14T11:00:00Z', fechaModificacion: '2026-09-14T11:00:00Z',
  activo: true, publicado: true, instructorNombre: 'Carlos López', fichaCodigo: '3171618',
  ambienteNombre: 'Laboratorio de Redes', resultadoCodigo: null, resultadoDescripcion: 'Redes',
}

const PENDIENTE: SolicitudCambioHorario = {
  idSolicitud: 1,
  idInstructor: 'i-1',
  idHorarioOrigen: 169,
  tipo: 'cambio-ambiente',
  motivo: 'El videobeam no enciende y la sesión es práctica.',
  estado: 'pendiente',
  fechaSolicitud: '2026-09-24T10:00:00Z',
  fechaResolucion: null,
  idAdminResolvio: null,
}

const apiGetMock = vi.fn()
const apiPatchMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

const COORDINADOR: Usuario = {
  ...INSTRUCTOR,
  idUsuario: 'c-1',
  nombre: 'Ana Martínez',
  email: 'ana@mail.com',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
}

function mockearCatalogos(solicitudes: SolicitudCambioHorario[]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/solicitudes-cambio-horario/') return Promise.resolve(solicitudes)
    // Antes de la lista: AppShell lo pide para armar el navbar.
    if (path === '/usuarios/me') return Promise.resolve(COORDINADOR)
    if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
    if (path === '/horarios/') return Promise.resolve([HORARIO])
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('CambiosHorario', () => {
  it('muestra lo que reportó el instructor con su franja real', async () => {
    mockearCatalogos([PENDIENTE])
    renderConProviders(<CambiosHorario />)

    expect(await screen.findByText('El videobeam no enciende y la sesión es práctica.')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
    expect(screen.getByText('Cambio de ambiente')).toBeInTheDocument()
    expect(screen.getByText(/Ficha 3171618 · 11:00 a 13:00 · Laboratorio de Redes/)).toBeInTheDocument()
  })

  it('aprobar llama a PATCH /resolver y avisa que se le notificó al instructor', async () => {
    mockearCatalogos([PENDIENTE])
    apiPatchMock.mockResolvedValue({ ...PENDIENTE, estado: 'aprobada' })
    const usuario = userEvent.setup()
    renderConProviders(<CambiosHorario />)

    await screen.findByText('Carlos López')
    await usuario.click(screen.getByRole('button', { name: 'Aprobar' }))

    expect(apiPatchMock).toHaveBeenCalledWith('/solicitudes-cambio-horario/1/resolver', { estado: 'aprobada' })
    expect(await screen.findByRole('status')).toHaveTextContent('Se le notificó')
  })

  it('rechazar manda el estado rechazada', async () => {
    mockearCatalogos([PENDIENTE])
    apiPatchMock.mockResolvedValue({ ...PENDIENTE, estado: 'rechazada' })
    const usuario = userEvent.setup()
    renderConProviders(<CambiosHorario />)

    await screen.findByText('Carlos López')
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }))

    expect(apiPatchMock).toHaveBeenCalledWith('/solicitudes-cambio-horario/1/resolver', { estado: 'rechazada' })
  })

  it('sin pendientes explica qué va a aparecer acá, en vez de una lista vacía', async () => {
    mockearCatalogos([])
    renderConProviders(<CambiosHorario />)

    expect(await screen.findByText(/No hay novedades sin resolver/)).toBeInTheDocument()
  })

  it('las resueltas no ofrecen botones de acción', async () => {
    const aprobada: SolicitudCambioHorario = {
      ...PENDIENTE, idSolicitud: 2, estado: 'aprobada', fechaResolucion: '2026-09-24T12:00:00Z',
    }
    mockearCatalogos([aprobada])
    const usuario = userEvent.setup()
    renderConProviders(<CambiosHorario />)

    await usuario.click(await screen.findByRole('button', { name: /Aprobadas/ }))

    const fila = (await screen.findByText(aprobada.motivo)).closest('li')!
    expect(within(fila).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(within(fila).queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
  })
})
