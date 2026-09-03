import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { VistaAmbientes } from './VistaAmbientes'
import type { Ambiente, Horario } from '../types/api'

const AMBIENTE: Ambiente = { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Sala 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 }
const OTRO_AMBIENTE: Ambiente = { idAmbiente: 2, numeroAmbiente: 102, nombreAmbiente: 'Sala 102', tipoAmbiente: 'especial', estadoAmbiente: 'mantenimiento', idSede: 1 }

const HORARIOS: Horario[] = [
  {
    idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
    idAmbiente: 1, idInstructor: 'u1', idFicha: 10, idResultado: 100, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
    instructorNombre: 'Erick Granados', fichaCodigo: '3068356', ambienteNombre: 'Sala 101',
    resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
  },
]

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase(todosLosHorarios: Horario[] = HORARIOS) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/ambientes') return Promise.resolve([AMBIENTE, OTRO_AMBIENTE])
    if (path === '/ambientes/1/horarios') return Promise.resolve(HORARIOS)
    if (path === '/horarios/') return Promise.resolve(todosLosHorarios)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('VistaAmbientes', () => {
  it('lista todos los ambientes', async () => {
    mockeaBase()
    renderConProviders(<VistaAmbientes />)

    expect(await screen.findByText('Sala 101')).toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
  })

  it('el buscador filtra la lista por nombre o número', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<VistaAmbientes />)
    await screen.findByText('Sala 101')

    await usuario.type(screen.getByLabelText('Buscar ambiente'), '102')

    expect(screen.queryByText('Sala 101')).not.toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
  })

  it('antes de elegir un ambiente, pide que se elija uno', async () => {
    mockeaBase()
    renderConProviders(<VistaAmbientes />)
    await screen.findByText('Sala 101')

    expect(screen.getByText('Elige un ambiente de la lista para ver su horario.')).toBeInTheDocument()
  })

  it('clic en un ambiente muestra su horario y un link "Ver info" al detalle', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<VistaAmbientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))

    await waitFor(() => expect(screen.getByText('CPL18')).toBeInTheDocument())
    const link = screen.getByRole('link', { name: 'Ver info →' })
    expect(link).toHaveAttribute('href', '/ambientes?id=1')
  })

  it('ambiente sin horario asignado muestra el mensaje correspondiente', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/ambientes/1/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<VistaAmbientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))

    expect(await screen.findByText('Sin horario asignado en el trimestre actual.')).toBeInTheDocument()
  })

  it('con ?id= en la URL, selecciona ese ambiente directo (deep link desde el drawer de Ambientes.tsx)', async () => {
    mockeaBase()
    renderConProviders(<VistaAmbientes />, ['/vista-ambientes?id=1'])

    await waitFor(() => expect(screen.getByText('CPL18')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Ver info →' })).toHaveAttribute('href', '/ambientes?id=1')
  })

  it('filtra la lista de ambientes por ficha y por instructor', async () => {
    const todosLosHorarios: Horario[] = [
      ...HORARIOS,
      {
        idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
        idAmbiente: 2, idInstructor: 'u2', idFicha: 20, idResultado: 200, dias: [2], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
        instructorNombre: 'Fredy Ardila', fichaCodigo: '9999999', ambienteNombre: 'Sala 102',
        resultadoCodigo: 'RA-1', resultadoDescripcion: null,
      },
    ]
    mockeaBase(todosLosHorarios)
    const usuario = userEvent.setup()
    renderConProviders(<VistaAmbientes />)
    await screen.findByText('Sala 101')
    expect(screen.getByText('Sala 102')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Ficha'), '3068356')

    expect(screen.getByText('Sala 101')).toBeInTheDocument()
    expect(screen.queryByText('Sala 102')).not.toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Ficha'), 'Todas')
    await usuario.selectOptions(screen.getByLabelText('Instructor'), 'Fredy Ardila')

    expect(screen.queryByText('Sala 101')).not.toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
  })
})
