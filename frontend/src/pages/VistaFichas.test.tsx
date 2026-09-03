import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { VistaFichas } from './VistaFichas'
import type { Ficha, Horario } from '../types/api'

const FICHA: Ficha = {
  idFicha: 1,
  codigoFicha: '3228973 B',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  sede: null,
  programa: {
    idPrograma: 1,
    codigoPrograma: 'ADSO',
    nombrePrograma: 'Análisis y Desarrollo de Software',
    nivelFormacion: 'Tecnólogo',
    activo: true,
    idCoordinacion: 1,
  },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre 3', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  aprendicesTotales: 30,
  jornadas: ['Mañana'],
}

const OTRA_FICHA: Ficha = {
  ...FICHA,
  idFicha: 2,
  codigoFicha: '2758431',
  programa: { ...FICHA.programa, idPrograma: 2, codigoPrograma: 'COCI', nombrePrograma: 'Técnico en Cocina' },
}

const HORARIOS: Horario[] = [
  {
    idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
    idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 100, dias: [1],
    instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 306',
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
    if (path === '/fichas/') return Promise.resolve([FICHA, OTRA_FICHA])
    if (path === '/fichas/1/horarios') return Promise.resolve(HORARIOS)
    if (path === '/horarios/') return Promise.resolve(todosLosHorarios)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('VistaFichas', () => {
  it('lista todas las fichas', async () => {
    mockeaBase()
    renderConProviders(<VistaFichas />)

    expect(await screen.findByText('3228973 B')).toBeInTheDocument()
    expect(screen.getByText('2758431')).toBeInTheDocument()
  })

  it('el buscador filtra la lista por código o programa', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<VistaFichas />)
    await screen.findByText('3228973 B')

    await usuario.type(screen.getByLabelText('Buscar ficha'), 'Cocina')

    expect(screen.queryByText('3228973 B')).not.toBeInTheDocument()
    expect(screen.getByText('2758431')).toBeInTheDocument()
  })

  it('antes de elegir una ficha, pide que se elija una', async () => {
    mockeaBase()
    renderConProviders(<VistaFichas />)
    await screen.findByText('3228973 B')

    expect(screen.getByText('Elige una ficha de la lista para ver su horario.')).toBeInTheDocument()
  })

  it('clic en una ficha muestra su horario y un link "Ver info" al detalle', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<VistaFichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    await waitFor(() => expect(screen.getByText('CPL18')).toBeInTheDocument())
    const link = screen.getByRole('link', { name: 'Ver info →' })
    expect(link).toHaveAttribute('href', '/fichas?id=1')
  })

  it('ficha sin horario asignado muestra el mensaje correspondiente', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/fichas/1/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<VistaFichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    expect(await screen.findByText('Sin horario asignado en el trimestre actual.')).toBeInTheDocument()
  })

  it('con ?id= en la URL, selecciona esa ficha directo (deep link desde el drawer de Fichas.tsx)', async () => {
    mockeaBase()
    renderConProviders(<VistaFichas />, ['/vista-fichas?id=1'])

    await waitFor(() => expect(screen.getByText('CPL18')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Ver info →' })).toHaveAttribute('href', '/fichas?id=1')
  })

  it('filtra la lista de fichas por instructor', async () => {
    const todosLosHorarios: Horario[] = [
      ...HORARIOS,
      {
        idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
        idAmbiente: 2, idInstructor: 'u2', idFicha: 2, idResultado: 200, dias: [2],
        instructorNombre: 'Fredy Ardila', fichaCodigo: '2758431', ambienteNombre: 'Ambiente 999',
        resultadoCodigo: 'RA-1', resultadoDescripcion: null,
      },
    ]
    mockeaBase(todosLosHorarios)
    const usuario = userEvent.setup()
    renderConProviders(<VistaFichas />)
    await screen.findByText('3228973 B')
    expect(screen.getByText('2758431')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Instructor'), 'Erick Granados')

    expect(screen.getByText('3228973 B')).toBeInTheDocument()
    expect(screen.queryByText('2758431')).not.toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Instructor'), 'Fredy Ardila')

    expect(screen.queryByText('3228973 B')).not.toBeInTheDocument()
    expect(screen.getByText('2758431')).toBeInTheDocument()
  })
})
