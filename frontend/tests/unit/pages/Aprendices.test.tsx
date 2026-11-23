import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Aprendices } from '../../../src/pages/Aprendices'
import { renderConProviders } from '../../helpers/renderConProviders'

const apiGetMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error { status = 500 },
}))

const datos = [
  { idUsuario: 'u1', nombre: 'Aprendiz Demo 01', correo: 'aprendiz1@example.com', documento: '91000001',
    estado: 'activo', codigoFicha: '3407178', programa: 'ADSO', rolEnFicha: null, debeCambiarClave: true },
  { idUsuario: 'u2', nombre: 'Aprendiz Demo 02', correo: 'aprendiz2@example.com', documento: '91000002',
    estado: 'activo', codigoFicha: '3407179', programa: 'ADSO', rolEnFicha: 'vocero', debeCambiarClave: false },
]

describe('Aprendices', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((ruta: string) =>
      ruta === '/aprendices/alta/' ? Promise.resolve(datos) : ruta === '/usuarios/me' ? Promise.resolve({ idUsuario: 'admin', nombre: 'Administrador', roles: [{ idRol: 1, nombre: 'Administrador' }] }) : Promise.resolve([]),
    )
  })

  it('muestra aprendices, fichas, estado de acceso y enlace de importación', async () => {
    renderConProviders(<Aprendices />)
    const directorio = await screen.findByRole('region', { name: 'Listado de aprendices' })
    expect(within(directorio).getByText('Aprendiz Demo 01')).toBeInTheDocument()
    expect(within(directorio).getByText('Aprendiz Demo 02')).toBeInTheDocument()
    expect(within(directorio).getByText('Cambio de clave pendiente')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Carga masiva' })).toHaveAttribute('href', '/aprendices/carga-masiva')
  })

  it('filtra por ficha sin perder el listado original', async () => {
    renderConProviders(<Aprendices />)
    const user = userEvent.setup()
    await screen.findByText('Aprendiz Demo 01')
    await user.selectOptions(screen.getByLabelText('Ficha'), '3407179')
    const directorio = screen.getByRole('region', { name: 'Listado de aprendices' })
    expect(within(directorio).queryByText('Aprendiz Demo 01')).not.toBeInTheDocument()
    expect(within(directorio).getByText('Aprendiz Demo 02')).toBeInTheDocument()
  })
})
