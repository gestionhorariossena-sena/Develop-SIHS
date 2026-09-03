import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { CalendarioGeneral } from './CalendarioGeneral'
import type { DiaSemana, Ficha, Horario, Trimestre } from '../types/api'

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }]

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

const TRIMESTRE: Trimestre = { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' }

// 2026-01-05 es lunes — el horario tiene dias:[1] (Lunes) y cae dentro del
// trimestre de arriba, así que debe aparecer justo ese día en el calendario.
const HORARIO: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1],
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'RA-9', resultadoDescripcion: null,
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase(horarios: Horario[] = [HORARIO]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/horarios/') return Promise.resolve(horarios)
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    if (path === '/fichas/') return Promise.resolve([FICHA])
    if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

async function irA5DeEnero2026(usuario: ReturnType<typeof userEvent.setup>) {
  await userEvent.selectOptions(screen.getByLabelText('Año'), '2026')
  await userEvent.selectOptions(screen.getByLabelText('Mes'), 'Enero')
  await usuario.selectOptions(screen.getByLabelText('Día'), '5')
}

describe('CalendarioGeneral', () => {
  it('muestra el mes actual, la leyenda de jornadas y el link al historial', async () => {
    mockeaBase()
    renderConProviders(<CalendarioGeneral />)

    const hoy = new Date()
    expect(await screen.findByText(`${NOMBRES_MES[hoy.getMonth()]} ${hoy.getFullYear()}`)).toBeInTheDocument()
    expect(screen.getByText('Jornada Mañana')).toBeInTheDocument()
    expect(screen.getByText('Jornada Tarde')).toBeInTheDocument()
    expect(screen.getByText('Jornada Noche')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: 'Ver historial de horarios' })
    expect(link).toHaveAttribute('href', '/horarios/historial')
  })

  it('la pestaña "Semana" aparece deshabilitada (aún no implementada)', async () => {
    mockeaBase()
    renderConProviders(<CalendarioGeneral />)
    await screen.findByText('Jornada Mañana')

    expect(screen.getByText('Semana')).toHaveAttribute('title', 'Vista semanal — aún no implementada')
  })

  it('las flechas de mes anterior/siguiente cambian el mes mostrado', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<CalendarioGeneral />)
    await screen.findByText('Jornada Mañana')

    const hoy = new Date()
    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)

    await usuario.click(screen.getByRole('button', { name: 'Mes anterior' }))

    expect(screen.getByText(`${NOMBRES_MES[anterior.getMonth()]} ${anterior.getFullYear()}`)).toBeInTheDocument()
  })

  it('usando los selectores Día/Mes/Año, navega a una fecha y muestra sus clases programadas', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<CalendarioGeneral />)
    await screen.findByText('Jornada Mañana')

    await irA5DeEnero2026(usuario)

    expect(screen.getByText('Enero 2026')).toBeInTheDocument()
    const panel = await screen.findByRole('dialog', { name: '5 de enero de 2026' })
    expect(within(panel).getByText('Análisis y Desarrollo de Software')).toBeInTheDocument()
    expect(within(panel).getByText(/Jornada Mañana/)).toBeInTheDocument()
    expect(within(panel).getByText('Erick Granados')).toBeInTheDocument()
    expect(within(panel).getByText('Ambiente 101')).toBeInTheDocument()

    const linkFicha = within(panel).getByRole('link', { name: 'Ver ficha →' })
    expect(linkFicha).toHaveAttribute('href', '/fichas?id=1')
  })

  it('clic directo en el día del calendario abre el mismo detalle', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<CalendarioGeneral />)
    await screen.findByText('Jornada Mañana')
    await irA5DeEnero2026(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: '5 de enero de 2026' }))

    expect(await screen.findByRole('dialog', { name: '5 de enero de 2026' })).toBeInTheDocument()
  })

  it('un día sin clases muestra el mensaje correspondiente', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<CalendarioGeneral />)
    await screen.findByText('Jornada Mañana')

    // 2026-01-04 es domingo — ningún horario cae ahí (DIAS del fixture solo tiene Lunes).
    await userEvent.selectOptions(screen.getByLabelText('Año'), '2026')
    await userEvent.selectOptions(screen.getByLabelText('Mes'), 'Enero')
    await usuario.selectOptions(screen.getByLabelText('Día'), '4')

    const panel = await screen.findByRole('dialog', { name: '4 de enero de 2026' })
    expect(within(panel).getByText('Sin clases programadas este día.')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/horarios/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<CalendarioGeneral />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el calendario.')).toBeInTheDocument()
    })
  })
})
