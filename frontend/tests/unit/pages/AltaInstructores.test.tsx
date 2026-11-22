import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AltaInstructores } from '../../../src/pages/AltaInstructores'
import { renderConProviders } from '../../helpers/renderConProviders'

const apiPostMock = vi.fn()
const apiPostFormMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPostForm: (...args: unknown[]) => apiPostFormMock(...args),
  ApiError: class ApiError extends Error {
    status = 400
    constructor(message: string) { super(message) }
  },
}))

describe('AltaInstructores', () => {
  beforeEach(() => {
    apiPostMock.mockReset()
    apiPostFormMock.mockReset()
  })

  it('registra un instructor individual sin revelar credenciales temporales', async () => {
    apiPostMock.mockResolvedValue({
      correo: 'juan@sena.edu.co', estado: 'creado',
      detalle: 'Invitación enviada al correo institucional.',
    })
    const usuario = userEvent.setup()
    renderConProviders(<AltaInstructores />)
    await usuario.type(screen.getByLabelText('Nombre completo'), 'Juan Pérez')
    await usuario.type(screen.getByLabelText('Correo institucional'), 'juan@sena.edu.co')
    await usuario.type(screen.getByLabelText('Número de documento'), '103355777')
    await usuario.click(screen.getByRole('button', { name: 'Crear y enviar acceso' }))
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/instructores/alta/', expect.objectContaining({
      nombre: 'Juan Pérez', correo: 'juan@sena.edu.co', documento: '103355777',
    }), 45000))
    expect(await screen.findByText('Cuenta creada. Se enviaron las credenciales temporales al instructor.')).toBeInTheDocument()
    expect(screen.queryByText(/Contraseña temporal:/i)).not.toBeInTheDocument()
  })

  it('previsualiza Excel y exige que todas las filas sean válidas para confirmar', async () => {
    apiPostFormMock.mockResolvedValue({
      confirmado: false, total: 2, validas: 1,
      filas: [
        { fila: 2, valido: true, datos: { nombre: 'Laura', correo: 'laura@sena.edu.co' }, error: null },
        { fila: 3, valido: false, datos: { nombre: 'Pedro', correo: '' }, error: 'Correo requerido' },
      ],
    })
    const usuario = userEvent.setup()
    renderConProviders(<AltaInstructores />)
    await usuario.click(screen.getByRole('tab', { name: 'Desde Excel' }))
    const hoja = new File(['contenido'], 'coordinacion.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await usuario.upload(screen.getByLabelText('Archivo Excel de instructores'), hoja)
    await usuario.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    const seccion = await screen.findByRole('region', { name: 'Importación de instructores' })
    expect(within(seccion).getByText('Vista previa · 1 de 2 filas válidas')).toBeInTheDocument()
    expect(within(seccion).getByRole('button', { name: 'Confirmar e invitar' })).toBeDisabled()
    expect(apiPostFormMock).toHaveBeenCalledTimes(1)
  })
})
