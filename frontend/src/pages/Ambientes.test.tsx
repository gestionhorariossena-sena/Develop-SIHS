import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { Ambientes } from './Ambientes'

// AppShell llama a apiGet('/usuarios/me') al montar — se mockea para que el
// test no dependa de red ni de una sesión real de Supabase. El error queda
// silenciado por el propio AppShell (ver el .catch en su useEffect).
vi.mock('../services/api', () => ({
  apiGet: vi.fn().mockRejectedValue(new Error('no mockeado en este test')),
}))

describe('Ambientes', () => {
  it('lista los encabezados y todos los ambientes de ejemplo', () => {
    renderConProviders(<Ambientes />)

    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('Ambiente')).toBeInTheDocument()
    expect(within(tabla).getByText('Sede')).toBeInTheDocument()
    expect(within(tabla).getByText('Coordinación')).toBeInTheDocument()
    expect(within(tabla).getByText('Estado')).toBeInTheDocument()

    // 8 ambientes de ejemplo + 1 fila de encabezado.
    expect(screen.getAllByRole('row')).toHaveLength(9)
  })

  it('muestra el estado de cada ambiente con su badge correspondiente', () => {
    renderConProviders(<Ambientes />)

    const filaOcupada = screen.getByText('607_Torre 1_Unigermana').closest('tr') as HTMLElement
    expect(within(filaOcupada).getByText('Ocupado ahora')).toBeInTheDocument()

    const filaDisponible = screen.getByText('601_Torre 1_Unigermana').closest('tr') as HTMLElement
    expect(within(filaDisponible).getByText('Disponible')).toBeInTheDocument()
  })

  it('muestra sede y coordinación de un ambiente puntual', () => {
    renderConProviders(<Ambientes />)

    const fila = screen.getByText('303').closest('tr') as HTMLElement
    expect(within(fila).getByText('Sede principal')).toBeInTheDocument()
    expect(within(fila).getByText('Logística')).toBeInTheDocument()
  })
})
