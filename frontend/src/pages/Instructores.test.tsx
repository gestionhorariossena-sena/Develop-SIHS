import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { Instructores } from './Instructores'

vi.mock('../services/api', () => ({
  apiGet: vi.fn().mockRejectedValue(new Error('no mockeado en este test')),
}))

describe('Instructores', () => {
  it('lista los encabezados y todos los instructores de ejemplo', () => {
    renderConProviders(<Instructores />)

    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('Instructor')).toBeInTheDocument()
    expect(within(tabla).getByText('Sigla')).toBeInTheDocument()
    expect(within(tabla).getByText('Especialidad')).toBeInTheDocument()
    expect(within(tabla).getByText('Jornada habitual')).toBeInTheDocument()
    expect(within(tabla).getByText('Tipo')).toBeInTheDocument()

    // 7 instructores de ejemplo + 1 fila de encabezado.
    expect(screen.getAllByRole('row')).toHaveLength(8)
  })

  it('muestra la sigla y el tipo de contrato de un instructor de planta', () => {
    renderConProviders(<Instructores />)

    const fila = screen.getByText('Erick Granados').closest('tr') as HTMLElement
    expect(within(fila).getByText('EG')).toBeInTheDocument()
    expect(within(fila).getByText('Planta')).toBeInTheDocument()
  })

  it('representa una vacante sin instructor asignado', () => {
    renderConProviders(<Instructores />)

    const fila = screen.getByText('Vacante Logística #7').closest('tr') as HTMLElement
    expect(within(fila).getByText('—')).toBeInTheDocument()
    expect(within(fila).getByText('Vacante')).toBeInTheDocument()
  })
})
