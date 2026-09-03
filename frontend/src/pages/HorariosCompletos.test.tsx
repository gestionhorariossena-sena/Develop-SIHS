import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { HorariosCompletos } from './HorariosCompletos'
import type { Ambiente, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

const FICHA: Ficha = {
  idFicha: 1,
  codigoFicha: '3228973 B',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  sede: null,
  programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  aprendicesTotales: 30,
  jornadas: ['Mañana'],
}

const INSTRUCTOR: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  tipoContrato: 'Planta',
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [],
}

const AMBIENTE: Ambiente = { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Ambiente 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 }
const SEDE: Sede = { idSede: 1, nombreSede: 'Sede principal', direccion: null, tipoSede: 'principal' }
const TRIMESTRE: Trimestre = { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' }
const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }, { idDia: 2, nombreDia: 'Martes' }]

const HORARIO: Horario = {
  idHorario: 7, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1],
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const OTRO_HORARIO: Horario = {
  idHorario: 8, horaInicio: '12:00:00', horaFin: '15:00:00', idJornada: 2, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [2],
  instructorNombre: 'Fredy Ardila', fichaCodigo: '9999999', ambienteNombre: 'Taller Industrial',
  resultadoCodigo: 'RA-2', resultadoDescripcion: null,
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase(horarios: Horario[] = [HORARIO]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/horarios/') return Promise.resolve(horarios)
    if (path === '/fichas/') return Promise.resolve([FICHA])
    if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
    if (path === '/ambientes') return Promise.resolve([AMBIENTE])
    if (path === '/sedes') return Promise.resolve([SEDE])
    if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('HorariosCompletos', () => {
  it('carga los horarios desde el backend y los muestra en la tabla', async () => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />)

    expect(await screen.findByText('3228973 B')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/horarios/')
    expect(screen.getByText('1 de 1 horarios')).toBeInTheDocument()
  })

  it('el buscador filtra por ficha, programa, instructor o ambiente', async () => {
    mockeaBase([HORARIO, OTRO_HORARIO])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.type(screen.getByLabelText('Buscar'), 'Taller')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
  })

  it('filtra por jornada y por trimestre', async () => {
    mockeaBase([HORARIO, OTRO_HORARIO])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('Erick Granados')
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Jornada'), 'Tarde')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Jornada'), 'Todas')
    await usuario.selectOptions(screen.getByLabelText('Trimestre'), 'Trimestre 1')

    expect(screen.getByText('Erick Granados')).toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
  })

  it('clic en una fila abre el drawer con ficha, instructor, ambiente, tema y horario semanal, con links a cada vista completa', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    const panel = screen.getByRole('dialog', { name: 'Horario #7' })
    expect(within(panel).getByText(/Análisis y Desarrollo de Software/)).toBeInTheDocument()
    expect(within(panel).getByText(/Planta/)).toBeInTheDocument()
    expect(within(panel).getByText(/Sede principal/)).toBeInTheDocument()
    expect(within(panel).getByText('CPL18 — Gestión de inventarios')).toBeInTheDocument()
    expect(await within(panel).findByText('Horario semanal')).toBeInTheDocument()

    expect(within(panel).getByRole('link', { name: 'Ver ficha →' })).toHaveAttribute('href', '/fichas?id=1')
    expect(within(panel).getByRole('link', { name: 'Ver instructor →' })).toHaveAttribute('href', '/instructores?id=u1')
    expect(within(panel).getByRole('link', { name: 'Ver ambiente →' })).toHaveAttribute('href', '/ambientes?id=1')
  })

  it('con ?id= en la URL, abre el drawer de ese horario directo (deep link desde Calendario general)', async () => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?id=7'])

    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/horarios/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<HorariosCompletos />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el listado de horarios.')).toBeInTheDocument()
    })
  })
})
