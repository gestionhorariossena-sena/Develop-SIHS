import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Programas } from './Programas'
import type { Ficha, Programa } from '../types/api'

const PROGRAMA_ADSO: Programa = { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 }
const PROGRAMA_COCI: Programa = { idPrograma: 2, codigoPrograma: 'COCI', nombrePrograma: 'Técnico en Cocina', nivelFormacion: 'Técnico', activo: false, idCoordinacion: 2 }
// Programa sin ninguna ficha creada todavía — el bug que se corrige acá:
// antes se derivaba la lista de /fichas/, así que este nunca aparecía.
const PROGRAMA_SIN_FICHAS: Programa = { idPrograma: 3, codigoPrograma: 'NUEVO', nombrePrograma: 'Programa recién creado', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 }

const PROGRAMAS: Programa[] = [PROGRAMA_ADSO, PROGRAMA_COCI, PROGRAMA_SIN_FICHAS]

const FICHA_ADSO: Ficha = {
  idFicha: 1, codigoFicha: '3228973 B', idPrograma: 1, idTrimestre: 1, idSede: null, sede: null,
  programa: PROGRAMA_ADSO,
  trimestre: { idTrimestre: 1, nombre: 'Trimestre 3', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  aprendicesTotales: 30, jornadas: ['Mañana'],
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase(programas: Programa[] = PROGRAMAS, fichas: Ficha[] = [FICHA_ADSO]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/programas/') return Promise.resolve(programas)
    if (path === '/fichas/') return Promise.resolve(fichas)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Programas', () => {
  it('carga los programas desde GET /programas/ — incluye los que todavía no tienen fichas', async () => {
    mockeaBase()
    renderConProviders(<Programas />)

    expect(await screen.findByText('ADSO')).toBeInTheDocument()
    expect(screen.getByText('COCI')).toBeInTheDocument()
    // Este es justamente el bug que se corrige: antes de usar GET
    // /programas/, un programa sin fichas asociadas nunca aparecía.
    expect(screen.getByText('NUEVO')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/programas/')
    expect(screen.getByText('3 de 3 programas')).toBeInTheDocument()
  })

  it('el buscador filtra por código o nombre', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Programas />)
    await screen.findByText('ADSO')

    await usuario.type(screen.getByLabelText('Buscar'), 'Cocina')

    expect(screen.queryByText('ADSO')).not.toBeInTheDocument()
    expect(screen.getByText('COCI')).toBeInTheDocument()
  })

  it('filtra por nivel y por estado', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Programas />)
    await screen.findByText('ADSO')

    await usuario.selectOptions(screen.getByLabelText('Nivel'), 'Técnico')
    expect(screen.queryByText('ADSO')).not.toBeInTheDocument()
    expect(screen.getByText('COCI')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Nivel'), 'Todos')

    await usuario.selectOptions(screen.getByLabelText('Estado'), 'Inactivo')
    expect(screen.queryByText('ADSO')).not.toBeInTheDocument()
    expect(screen.getByText('COCI')).toBeInTheDocument()
  })

  it('clic en una fila abre el drawer con las fichas asociadas', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Programas />)
    await screen.findByText('ADSO')

    await usuario.click(screen.getByText('ADSO'))

    const panel = screen.getByRole('dialog', { name: 'Análisis y Desarrollo de Software' })
    expect(within(panel).getByText('3228973 B')).toBeInTheDocument()
    expect(within(panel).getByText('Trimestre: Trimestre 3')).toBeInTheDocument()
  })

  it('un programa sin fichas asociadas muestra el mensaje correspondiente en el drawer', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Programas />)
    await screen.findByText('NUEVO')

    await usuario.click(screen.getByText('NUEVO'))

    const panel = screen.getByRole('dialog', { name: 'Programa recién creado' })
    expect(within(panel).getByText('Este programa todavía no tiene fichas asociadas.')).toBeInTheDocument()
  })

  it('con ?id= en la URL, abre el drawer de ese programa directo', async () => {
    mockeaBase()
    renderConProviders(<Programas />, ['/programas?id=2'])

    expect(await screen.findByRole('dialog', { name: 'Técnico en Cocina' })).toBeInTheDocument()
  })

  it('con más de 10 programas, pagina y "Siguiente" avanza a la página 2', async () => {
    const muchos: Programa[] = Array.from({ length: 12 }, (_, i) => ({
      ...PROGRAMA_ADSO,
      idPrograma: i + 1,
      codigoPrograma: `PROG-${String(i + 1).padStart(2, '0')}`,
    }))
    mockeaBase(muchos, [])
    const usuario = userEvent.setup()
    renderConProviders(<Programas />)
    await screen.findByText('PROG-01')

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.queryByText('PROG-11')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByText('PROG-11')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/programas/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Programas />)

    expect(await screen.findByText('No se pudo cargar el listado de programas.')).toBeInTheDocument()
  })
})
