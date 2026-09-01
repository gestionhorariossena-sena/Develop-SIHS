import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Fichas } from './Fichas'

vi.mock('../services/api', () => ({
  apiGet: vi.fn().mockRejectedValue(new Error('no mockeado en este test')),
}))

describe('Fichas', () => {
  it('muestra las primeras 10 fichas de ejemplo en la página 1, sin expandir', () => {
    renderConProviders(<Fichas />)

    expect(screen.getByText('3228973 B')).toBeInTheDocument()
    expect(screen.getByText('2831190')).toBeInTheDocument()
    // Las últimas 2 de las 12 fichas quedan en la página 2, no en la 1.
    expect(screen.queryByText('2745560')).not.toBeInTheDocument()

    expect(screen.getByText('Página 1 de 2 · 12 fichas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
  })

  it('"Siguiente" avanza a la página 2 con las 2 fichas restantes', async () => {
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('2745560')).toBeInTheDocument()
    expect(screen.getByText('2718904')).toBeInTheDocument()
    expect(screen.queryByText('3228973 B')).not.toBeInTheDocument()

    expect(screen.getByText('Página 2 de 2 · 12 fichas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('clic en una tarjeta la expande y muestra trimestre/jornada/aprendices; otro clic la colapsa', async () => {
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)

    const tarjeta = screen.getByText('3228973 B').closest('button') as HTMLElement
    expect(screen.queryByText('Trim.')).not.toBeInTheDocument()

    await usuario.click(tarjeta)

    expect(screen.getByText('3°')).toBeInTheDocument()
    expect(screen.getByText('Trim.')).toBeInTheDocument()
    expect(screen.getByText('Mañana')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()

    await usuario.click(tarjeta)

    expect(screen.queryByText('Trim.')).not.toBeInTheDocument()
  })
})
