import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { HistorialHorarios } from '../../../src/pages/HistorialHorarios'
import type { DiaSemana, Horario, HorarioGuardado } from '../../../src/types/api'

const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }]
const BLOQUE: Horario = { idHorario: 2, horaInicio: '08:00:00', horaFin: '10:00:00', idJornada: 1, idTrimestre: 1, idAmbiente: 2, idInstructor: 'u2', idFicha: 2, idResultado: 2, dias: [1], fechaCreacion: '2026-02-01T00:00:00Z', fechaModificacion: '2026-02-01T00:00:00Z', activo: true, publicado: false, instructorNombre: 'Fredy Ardila', fichaCodigo: 'FICHA-SUELTA', ambienteNombre: 'Ambiente 202', resultadoCodigo: 'RA-2', resultadoDescripcion: 'Resultado demo' }
const SNAPSHOT: HorarioGuardado = { idHorarioGuardado: 10, idUsuario: 'u1', creadorNombre: 'Erick Granados', programaNombre: 'Análisis y Desarrollo de Software', ficha: 'FICHA-SNAPSHOT', aprendices: '30', horasTrimestre: '40', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', bloques: [{ id: 'blob-1', tematica: 'Tema congelado', instructor: 'Nombre viejo', ficha: 'FICHA-SNAPSHOT', ambiente: 'Ambiente viejo' }], grid: [['blob-1', null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null]], idsHorarios: undefined, fechaCreacion: '2026-01-01T00:00:00Z' }

const apiGetMock = vi.fn()
vi.mock('../../../src/services/api', () => ({ apiGet: (...args: unknown[]) => apiGetMock(...args), ApiError: class ApiError extends Error {} }))

function mockeaBase(horarios: Horario[] = [BLOQUE], snapshots: HorarioGuardado[] = [SNAPSHOT]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/horarios-guardados/') return Promise.resolve(snapshots)
    if (path === '/horarios/') return Promise.resolve(horarios)
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    if (path === '/trimestres/') return Promise.resolve([{ idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' }])
    return Promise.reject(new Error('no mockeado'))
  })
}

describe('HistorialHorarios', () => {
  it('presenta el registro separado de las acciones de gestión', async () => {
    mockeaBase()
    renderConProviders(<HistorialHorarios />)
    expect(await screen.findByRole('heading', { name: 'Registro y versiones' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Registro por ficha y período' })).toBeInTheDocument()
    expect(screen.getByText('FICHA-SUELTA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Publicar|Despublicar|Borrar|Modificar/ })).not.toBeInTheDocument()
  })

  it('muestra la cuadrícula registrada y lleva cada bloque a Gestión de horarios', async () => {
    mockeaBase([BLOQUE], [])
    const usuario = userEvent.setup()
    renderConProviders(<HistorialHorarios />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver registro de FICHA-SUELTA' }))
    const registro = screen.getByRole('region', { name: 'Registro de FICHA-SUELTA' })
    expect(within(registro).getAllByText('Resultado demo').length).toBeGreaterThan(0)
    expect(within(registro).getByRole('link', { name: 'Gestionar bloque' })).toHaveAttribute('href', '/horarios/completos?idHorario=2')
    expect(within(registro).queryByRole('button', { name: /Publicar|Borrar|Modificar/ })).not.toBeInTheDocument()
  })

  it('conserva las versiones antiguas como una consulta de solo lectura', async () => {
    mockeaBase([], [SNAPSHOT])
    const usuario = userEvent.setup()
    renderConProviders(<HistorialHorarios />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver registro de FICHA-SNAPSHOT' }))
    expect(await screen.findByText(/se guardó antes de vincularse/)).toBeInTheDocument()
    expect(screen.getByText('Nombre viejo')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Modificar' })).not.toBeInTheDocument()
  })
})
