import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CargaAprendices } from '../../../src/pages/CargaAprendices'
import { renderConProviders } from '../../helpers/renderConProviders'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPostFormMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPostForm: (...args: unknown[]) => apiPostFormMock(...args),
  ApiError: class ApiError extends Error { status = 422 },
}))

const fichero = () => new File(['excel'], 'aprendices.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

describe('CargaAprendices', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPostFormMock.mockReset()
    apiGetMock.mockImplementation((ruta: string) => ruta === '/usuarios/me' ? Promise.resolve({ idUsuario: 'admin', nombre: 'Administrador', roles: [{ idRol: 1, nombre: 'Administrador' }] }) : Promise.resolve([]))
  })

  it('muestra vista previa, vincula aprendiz con ficha y confirma una cuenta', async () => {
    apiPostFormMock.mockResolvedValue({
      total: 1, validas: 1,
      filas: [{ fila: 2, valido: true, error: null, datos: {
        nombre: 'Aprendiz Demo 01', correo: 'aprendiz@example.com',
        documento: '91000001', codigoFicha: '3407178', programaFormacion: null,
      } }],
    })
    apiPostMock.mockResolvedValue({
      correo: 'aprendiz@example.com', estado: 'creado',
      detalle: 'Aprendiz vinculado a su ficha; invitación enviada.',
    })
    const usuario = userEvent.setup()
    renderConProviders(<CargaAprendices />)
    await usuario.upload(screen.getByLabelText('Archivo Excel de aprendices'), fichero())
    await usuario.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    const panel = await screen.findByRole('region', { name: 'Importar aprendices' })
    expect(within(panel).getByText('3407178')).toBeInTheDocument()
    expect(apiPostMock).not.toHaveBeenCalled()
    await usuario.click(within(panel).getByRole('button', { name: 'Confirmar importación de 1 aprendiz' }))
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/aprendices/alta/',
      expect.objectContaining({ codigoFicha: '3407178' }), 45000))
    expect(await screen.findByText(/Carga finalizada/)).toBeInTheDocument()
  })

  it('bloquea confirmación cuando una ficha es inválida', async () => {
    apiPostFormMock.mockResolvedValue({
      total: 1, validas: 0,
      filas: [{ fila: 2, valido: false, error: 'La ficha no existe.', datos: {
        nombre: 'Aprendiz Demo', correo: 'aprendiz@example.com',
        documento: '91000001', codigoFicha: 'INVALIDA', programaFormacion: null,
      } }],
    })
    const usuario = userEvent.setup()
    renderConProviders(<CargaAprendices />)
    await usuario.upload(screen.getByLabelText('Archivo Excel de aprendices'), fichero())
    await usuario.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    expect(await screen.findByText('La ficha no existe.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importación de 1 aprendiz' })).toBeDisabled()
    expect(apiPostMock).not.toHaveBeenCalled()
  })
})
