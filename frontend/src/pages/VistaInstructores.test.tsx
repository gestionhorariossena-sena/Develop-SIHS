import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { VistaInstructores } from './VistaInstructores'
import type { Horario, Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  tipoContrato: 'Planta',
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [{ idEspecialidad: 1, nombre: 'Análisis · Verificación', descripcion: null, activo: true }],
}

const OTRO_INSTRUCTOR: Usuario = {
  ...INSTRUCTOR,
  idUsuario: 'u2',
  nombre: 'Fredy Ardila',
  especialidades: [{ idEspecialidad: 2, nombre: 'Bases de datos', descripcion: null, activo: true }],
}

const COORDINADOR: Usuario = {
  idUsuario: 'u3',
  nombre: 'Ana Martínez',
  email: 'ana@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
  especialidades: [],
}

const HORARIOS: Horario[] = [
  {
    idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
    idAmbiente: 1, idInstructor: 'u1', idFicha: 10, idResultado: 100, dias: [1],
    instructorNombre: 'Erick Granados', fichaCodigo: '3068356', ambienteNombre: 'Ambiente 306',
    resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
  },
]

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase() {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR, OTRO_INSTRUCTOR, COORDINADOR])
    if (path === '/usuarios/u1/horarios') return Promise.resolve(HORARIOS)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('VistaInstructores', () => {
  it('lista solo instructores, sin coordinadores', async () => {
    mockeaBase()
    renderConProviders(<VistaInstructores />)

    expect(await screen.findByText('Erick Granados')).toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
    expect(screen.queryByText('Ana Martínez')).not.toBeInTheDocument()
  })

  it('el buscador filtra la lista por nombre o especialidad', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<VistaInstructores />)
    await screen.findByText('Erick Granados')

    await usuario.type(screen.getByLabelText('Buscar instructor'), 'Fredy')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
  })

  it('antes de elegir un instructor, pide que se elija uno', async () => {
    mockeaBase()
    renderConProviders(<VistaInstructores />)
    await screen.findByText('Erick Granados')

    expect(screen.getByText('Elige un instructor de la lista para ver su horario.')).toBeInTheDocument()
  })

  it('clic en un instructor muestra su horario y un link "Ver info" al detalle', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<VistaInstructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    await waitFor(() => expect(screen.getByText('CPL18')).toBeInTheDocument())
    const link = screen.getByRole('link', { name: 'Ver info →' })
    expect(link).toHaveAttribute('href', '/instructores?id=u1')
  })

  it('instructor sin horario asignado muestra el mensaje correspondiente', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/usuarios/u1/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<VistaInstructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    expect(await screen.findByText('Sin horario asignado en el trimestre actual.')).toBeInTheDocument()
  })

  it('con ?id= en la URL, selecciona ese instructor directo (deep link desde el drawer de Instructores.tsx)', async () => {
    mockeaBase()
    renderConProviders(<VistaInstructores />, ['/vista-instructores?id=u1'])

    await waitFor(() => expect(screen.getByText('CPL18')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Ver info →' })).toHaveAttribute('href', '/instructores?id=u1')
  })
})
