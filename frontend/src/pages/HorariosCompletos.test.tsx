import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { HorariosCompletos } from './HorariosCompletos'
import type { Ambiente, CargaSemanal, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

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
const CARGA_SEMANAL: CargaSemanal = { idUsuario: 'u1', tipoContrato: 'Planta', horasAsignadas: 10, horasMaximas: 40 }

const HORARIO: Horario = {
  idHorario: 7, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true,
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const OTRO_HORARIO: Horario = {
  idHorario: 8, horaInicio: '12:00:00', horaFin: '15:00:00', idJornada: 2, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u2', idFicha: 1, idResultado: 1, dias: [2], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true,
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
    if (path === '/usuarios/u1/carga-semanal') return Promise.resolve(CARGA_SEMANAL)
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

  it('clic en una fila expande debajo una caja con ficha, instructor (+ carga semanal), ambiente, tema y el grid del horario', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])

    expect(await screen.findByText('Horario #7')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Desarrollo de Software (ADSO)')).toBeInTheDocument()
    expect(screen.getByText('erick@example.com')).toBeInTheDocument()
    expect(screen.getByText('Contrato: Planta')).toBeInTheDocument()
    expect(screen.getByText('Número: 101')).toBeInTheDocument()
    expect(screen.getByText('Sede: Sede principal')).toBeInTheDocument()
    // "CPL18" aparece dos veces: en el grid (tema del bloque asignado) y en
    // la tarjeta "Tema" del detalle.
    expect(screen.getAllByText('CPL18').length).toBeGreaterThan(0)
    expect(screen.getByText('Gestión de inventarios')).toBeInTheDocument()
    expect(screen.getByText('Horario semanal — igual que en el creador de horarios')).toBeInTheDocument()

    expect(await screen.findByText('10h / 40h')).toBeInTheDocument()

    // No debe abrirse ningún panel/drawer lateral — todo pasa dentro de la tabla.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cada tarjeta tiene links "Más info" y "Ver horario por..." hacia su vista completa y su vista agregada', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])
    await screen.findByText('Horario #7')

    const masInfo = screen.getAllByRole('link', { name: 'Más info →' })
    expect(masInfo[0]).toHaveAttribute('href', '/fichas?id=1')
    expect(masInfo[1]).toHaveAttribute('href', '/instructores?id=u1')
    expect(masInfo[2]).toHaveAttribute('href', '/ambientes?id=1')

    expect(screen.getByRole('link', { name: 'Ver horario por ficha →' })).toHaveAttribute('href', '/vista-fichas?id=1')
    expect(screen.getByRole('link', { name: 'Ver horario por instructor →' })).toHaveAttribute('href', '/vista-instructores?id=u1')
    expect(screen.getByRole('link', { name: 'Ver horario por ambiente →' })).toHaveAttribute('href', '/vista-ambientes?id=1')

    expect(screen.getByRole('link', { name: 'Detalles de creación / Modificar →' })).toHaveAttribute('href', '/horarios/historial?id=7')
  })

  it('clic de nuevo en la misma fila colapsa la caja expandida', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])
    expect(await screen.findByText('Horario #7')).toBeInTheDocument()

    await usuario.click(screen.getAllByText('3228973 B')[0])
    expect(screen.queryByText('Horario #7')).not.toBeInTheDocument()
  })

  it('con ?id= en la URL, expande esa fila directo (deep link desde Calendario general)', async () => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?id=7'])

    expect(await screen.findByText('Horario #7')).toBeInTheDocument()
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
