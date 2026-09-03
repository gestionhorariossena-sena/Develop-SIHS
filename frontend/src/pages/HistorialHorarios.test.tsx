import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { HistorialHorarios } from './HistorialHorarios'
import type { DiaSemana, Horario, HorarioGuardado } from '../types/api'

const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }]

const CLASE_VIEJA: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1],
  fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true,
  instructorNombre: 'Erick Granados', fichaCodigo: 'FICHA-VIEJA', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'RA-1', resultadoDescripcion: null,
}

const CLASE_RECIENTE: Horario = {
  idHorario: 2, horaInicio: '12:00:00', horaFin: '15:00:00', idJornada: 2, idTrimestre: 1,
  idAmbiente: 2, idInstructor: 'u2', idFicha: 2, idResultado: 2, dias: [1],
  fechaCreacion: '2026-02-01T00:00:00Z', fechaModificacion: '2026-02-01T00:00:00Z', activo: true,
  instructorNombre: 'Fredy Ardila', fichaCodigo: 'FICHA-RECIENTE', ambienteNombre: 'Ambiente 202',
  resultadoCodigo: 'RA-2', resultadoDescripcion: null,
}

const SNAPSHOT_CON_VINCULO: HorarioGuardado = {
  idHorarioGuardado: 10,
  idUsuario: 'u1',
  creadorNombre: 'Erick Granados',
  ficha: 'FICHA-SNAPSHOT',
  aprendices: '30',
  horasTrimestre: '40',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-03-31',
  bloques: [{ id: 'blob-1', tematica: 'Tema congelado', instructor: 'Nombre viejo', ficha: 'FICHA-VIEJA', ambiente: 'Ambiente viejo' }],
  grid: [['blob-1', null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null], [null, null, null, null, null, null]],
  idsHorarios: [1],
  fechaCreacion: '2026-01-01T00:00:00Z',
}

const SNAPSHOT_SIN_VINCULO: HorarioGuardado = {
  ...SNAPSHOT_CON_VINCULO,
  idHorarioGuardado: 11,
  idsHorarios: undefined,
}

const apiGetMock = vi.fn()
const apiPatchMock = vi.fn()
const apiDeleteMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase(horariosReales: Horario[] = [CLASE_VIEJA, CLASE_RECIENTE], snapshots: HorarioGuardado[] = [SNAPSHOT_CON_VINCULO]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/horarios-guardados/') return Promise.resolve(snapshots)
    if (path === '/horarios/') return Promise.resolve(horariosReales)
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('HistorialHorarios', () => {
  it('lista las clases reales con la más recientemente modificada primero', async () => {
    mockeaBase()
    renderConProviders(<HistorialHorarios />)

    await screen.findByText('FICHA-VIEJA')
    const filas = screen.getAllByRole('row').filter((fila) => within(fila).queryByText(/FICHA-/))
    expect(within(filas[0]).getByText('FICHA-RECIENTE')).toBeInTheDocument()
    expect(within(filas[1]).getByText('FICHA-VIEJA')).toBeInTheDocument()
  })

  it('el botón "Modificar" está deshabilitado con su motivo en el title', async () => {
    mockeaBase()
    renderConProviders(<HistorialHorarios />)
    await screen.findByText('FICHA-VIEJA')

    const botones = screen.getAllByRole('button', { name: 'Modificar' })
    expect(botones[0]).toBeDisabled()
    expect(botones[0]).toHaveAttribute('title', expect.stringContaining('todavía no implementado'))
  })

  it('desactivar una clase la marca "Inactivo" y el botón pasa a "Activar"', async () => {
    mockeaBase()
    apiPatchMock.mockResolvedValue({ ...CLASE_VIEJA, activo: false })
    const usuario = userEvent.setup()
    renderConProviders(<HistorialHorarios />)
    await screen.findByText('FICHA-VIEJA')

    const fila = screen.getByText('FICHA-VIEJA').closest('tr') as HTMLElement
    await usuario.click(within(fila).getByRole('button', { name: /Desactivar clase/ }))

    expect(apiPatchMock).toHaveBeenCalledWith('/horarios/1/estado', { activo: false })
    expect(await screen.findByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Activar clase de FICHA-VIEJA/ })).toBeInTheDocument()
  })

  it('un error al cambiar el estado se muestra en la página', async () => {
    mockeaBase()
    apiPatchMock.mockRejectedValue(new Error('falló'))
    const usuario = userEvent.setup()
    renderConProviders(<HistorialHorarios />)
    await screen.findByText('FICHA-VIEJA')

    const fila = screen.getByText('FICHA-VIEJA').closest('tr') as HTMLElement
    await usuario.click(within(fila).getByRole('button', { name: /Desactivar clase/ }))

    expect(await screen.findByText('No se pudo cambiar el estado de la clase.')).toBeInTheDocument()
  })

  it('"Ver horario" de un snapshot con idsHorarios muestra las clases reales vigentes, no el blob congelado', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HistorialHorarios />)
    await screen.findByText('FICHA-VIEJA')

    await usuario.click(screen.getByRole('button', { name: 'Ver horario' }))

    // El blob congelado tenía "Nombre viejo" como instructor — si se
    // sigue mostrando eso en vez de "Erick Granados" (el dato real
    // vigente), la vista no está usando idsHorarios.
    expect(screen.getAllByText('Erick Granados').length).toBeGreaterThan(0)
    expect(screen.queryByText('Nombre viejo')).not.toBeInTheDocument()
    expect(screen.queryByText(/se guardó antes de vincularse/)).not.toBeInTheDocument()
  })

  it('un snapshot sin idsHorarios (viejo) cae al blob congelado con el aviso correspondiente', async () => {
    mockeaBase([CLASE_VIEJA, CLASE_RECIENTE], [SNAPSHOT_SIN_VINCULO])
    const usuario = userEvent.setup()
    renderConProviders(<HistorialHorarios />)
    await screen.findByText('FICHA-VIEJA')

    await usuario.click(screen.getByRole('button', { name: 'Ver horario' }))

    expect(await screen.findByText(/se guardó antes de vincularse/)).toBeInTheDocument()
    expect(screen.getByText('Nombre viejo')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga de clases reales falla', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios-guardados/') return Promise.resolve([])
      if (path === '/horarios/') return Promise.reject(new Error('falló'))
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<HistorialHorarios />)

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar las clases guardadas.')).toBeInTheDocument()
    })
  })
})
