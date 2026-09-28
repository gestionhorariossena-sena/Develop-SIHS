import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../services/api'
import { renderConProviders } from '../test/renderConProviders'
import { PublicacionesProgramadas } from './PublicacionesProgramadas'
import type { Horario, Trimestre } from '../types/api'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    detail: unknown
    constructor(status: number, message: string, detail?: unknown) { super(message); this.status = status; this.detail = detail }
  },
}))

const TRIMESTRE: Trimestre = { idTrimestre: 3, nombre: '2026-3', fechaInicio: '2026-07-01', fechaFin: '2026-09-30', estado: 'activo' }
const HORARIO: Horario = {
  idHorario: 27, horaInicio: '08:00:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 3,
  idAmbiente: 2, idInstructor: 'instructor-1', idFicha: 4, idResultado: 6, dias: [1],
  fechaCreacion: '2026-09-01T00:00:00Z', fechaModificacion: '2026-09-01T00:00:00Z', activo: true,
  publicado: false, instructorNombre: 'Instructor piloto', fichaCodigo: 'F-100', ambienteNombre: 'Ambiente 2',
  resultadoCodigo: 'RA-6', resultadoDescripcion: 'Resultado',
}

let publicaciones: Array<Record<string, unknown>>

function prepararApi(workerActivo = true) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/publicaciones-programadas/') return Promise.resolve(publicaciones)
    if (path === '/publicaciones-programadas/disponibilidad') return Promise.resolve({ habilitado: workerActivo, ultimaSenal: '2026-09-28T15:00:00Z', segundosDesdeSenal: 1, motivo: workerActivo ? null : 'Worker detenido.' })
    if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
    if (path === '/horarios/') return Promise.resolve([HORARIO])
    if (path === '/usuarios/me') return Promise.resolve({ idUsuario: 'coordinador', nombre: 'Coordinación', email: 'coordinacion@example.test', estado: 'activo', fechaRegistro: '2026-01-01', roles: [{ idRol: 2, nombre: 'Coordinador' }], especialidades: [], debeCambiarClave: false })
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('PublicacionesProgramadas', () => {
  beforeEach(() => {
    publicaciones = []
    vi.clearAllMocks()
  })

  it('no habilita programar si la disponibilidad real del worker está apagada, pero mantiene borradores e historial accesibles', async () => {
    prepararApi(false)
    renderConProviders(<PublicacionesProgramadas />)
    expect(await screen.findByText('Publicación programada no disponible')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guardar borrador' })).toHaveAttribute('href', '/horarios/nuevo')
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('href', '/horarios/historial')
    await userEvent.selectOptions(screen.getByLabelText('Período académico'), '3')
    expect(screen.getByLabelText(/Ficha F-100/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }))
    expect(screen.getByRole('group', { name: 'Calendario para fecha de publicación' })).toBeVisible()
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-15' } })
    expect(screen.getByLabelText('Hora')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Confirmar y programar' })).toBeDisabled()
    expect(apiPostMock).not.toHaveBeenCalled()
  })

  it('el calendario propio permite navegar y escoger un día sin depender del selector nativo', async () => {
    prepararApi(false)
    const user = userEvent.setup()
    renderConProviders(<PublicacionesProgramadas />)
    await screen.findByText('Publicación programada no disponible')
    await user.click(screen.getByRole('button', { name: 'Abrir calendario' }))
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled()
    const mesVisible = screen.getByRole('group', { name: 'Calendario para fecha de publicación' })
    expect(mesVisible).toBeVisible()
    const primerDia = screen.getAllByRole('button', { name: /^Elegir 1 de / })[0]
    await user.click(primerDia)
    expect(screen.getByLabelText('Fecha')).toHaveValue(expect.stringMatching(/^\\d{4}-\\d{2}-01$/))
    expect(screen.getByLabelText('Hora')).toHaveValue('09:00')
    expect(screen.getByRole('button', { name: 'Confirmar y programar' })).toBeDisabled()
  })

  it('previsualiza el período, horarios y hora de Bogotá antes de confirmar la programación', async () => {
    prepararApi(true)
    apiPostMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderConProviders(<PublicacionesProgramadas />)
    await screen.findByText('Worker disponible')
    await user.selectOptions(screen.getByLabelText('Período académico'), '3')
    await user.click(screen.getByLabelText(/Ficha F-100/))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:30' } })
    expect(screen.getByLabelText('Vista previa de publicación')).toHaveTextContent('2026-3')
    expect(screen.getByLabelText('Vista previa de publicación')).toHaveTextContent('2026-10-15 10:30 (America/Bogota)')
    expect(screen.getByLabelText('Vista previa de publicación')).toHaveTextContent('Ficha F-100')
    await user.click(screen.getByRole('button', { name: 'Confirmar y programar' }))
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/publicaciones-programadas/', {
      idTrimestre: 3, idHorarios: [27], fechaHoraLocal: '2026-10-15T10:30:00',
    }))
  })

  it('muestra el error de validación que devuelve la API sin fingir una notificación', async () => {
    prepararApi(true)
    apiPostMock.mockRejectedValue(new ApiError(422, 'Un horario ya tiene una publicación pendiente.'))
    const user = userEvent.setup()
    renderConProviders(<PublicacionesProgramadas />)
    await screen.findByText('Worker disponible')
    await user.selectOptions(screen.getByLabelText('Período académico'), '3')
    await user.click(screen.getByLabelText(/Ficha F-100/))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:30' } })
    await user.click(screen.getByRole('button', { name: 'Confirmar y programar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Un horario ya tiene una publicación pendiente.')
    expect(screen.getByText(/esta pantalla no crea notificaciones locales/i)).toBeInTheDocument()
  })

  it('usa el endpoint de cancelación y muestra los estados exactos que entrega el backend', async () => {
    publicaciones = [
      { idPublicacion: 11, idTrimestre: 3, fechaEjecucion: '2026-10-15T15:30:00Z', estado: 'pendiente', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: null, resultado: null, revision: 1, idHorarios: [27] },
      { idPublicacion: 12, idTrimestre: 3, fechaEjecucion: '2026-10-16T15:30:00Z', estado: 'revision_requerida', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: null, resultado: 'Revisar cambios', revision: 2, idHorarios: [27] },
      { idPublicacion: 13, idTrimestre: 3, fechaEjecucion: '2026-10-17T15:30:00Z', estado: 'publicada', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: '2026-10-17T15:30:00Z', resultado: null, revision: 1, idHorarios: [27] },
      { idPublicacion: 14, idTrimestre: 3, fechaEjecucion: '2026-10-18T15:30:00Z', estado: 'fallida', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: null, resultado: 'Conflicto', revision: 1, idHorarios: [27] },
      { idPublicacion: 15, idTrimestre: 3, fechaEjecucion: '2026-10-19T15:30:00Z', estado: 'cancelada', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: null, resultado: 'Cancelada', revision: 1, idHorarios: [27] },
      { idPublicacion: 16, idTrimestre: 3, fechaEjecucion: '2026-10-20T15:30:00Z', estado: 'ejecutando', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: null, resultado: null, revision: 1, idHorarios: [27] },
    ]
    prepararApi(true)
    apiPostMock.mockResolvedValue({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderConProviders(<PublicacionesProgramadas />)
    for (const estado of ['pendiente', 'requiere revisión', 'publicada', 'fallida', 'cancelada', 'ejecutando']) {
      expect(await screen.findByText(estado)).toBeInTheDocument()
    }
    await user.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
    expect(apiPostMock).toHaveBeenCalledWith('/publicaciones-programadas/11/cancelar')
    expect(screen.getByText(/edición invalidó la aprobación/i)).toBeInTheDocument()
  })

  it('reprograma con PUT y nueva fecha seleccionada', async () => {
    publicaciones = [{ idPublicacion: 21, idTrimestre: 3, fechaEjecucion: '2026-10-15T15:30:00Z', estado: 'pendiente', fechaCreacion: '2026-09-28T15:00:00Z', fechaEjecucionReal: null, resultado: null, revision: 1, idHorarios: [27] }]
    prepararApi(true)
    apiPutMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderConProviders(<PublicacionesProgramadas />)
    await user.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '11:45' } })
    await user.click(screen.getByRole('button', { name: 'Aprobar nueva revisión' }))
    await waitFor(() => expect(apiPutMock).toHaveBeenCalledWith('/publicaciones-programadas/21', {
      idTrimestre: 3, idHorarios: [27], fechaHoraLocal: '2026-10-20T11:45:00',
    }))
  })
})
