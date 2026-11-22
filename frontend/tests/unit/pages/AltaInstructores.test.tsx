import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AltaInstructores } from '../../../src/pages/AltaInstructores'
import { renderConProviders } from '../../helpers/renderConProviders'

const apiPostMock = vi.fn()
const apiPostFormMock = vi.fn()
const apiGetMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
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
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((ruta: string) => {
      if (ruta === '/usuarios/me') return Promise.resolve({ idUsuario: 'admin', nombre: 'Administrador', roles: [{ nombre: 'Administrador' }] })
      if (ruta === '/notificaciones/') return Promise.resolve([])
      return Promise.resolve([])
    })
  })

  it('abre directamente la pestaña de carga masiva desde el directorio', () => {
    renderConProviders(<AltaInstructores />, ['/instructores/registrar?modo=excel'])
    expect(screen.getByRole('tab', { name: 'Carga masiva' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Archivo Excel de instructores')).toBeInTheDocument()
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

  it('procesa Excel validado en solicitudes individuales y reporta resultados', async () => {
    apiPostFormMock.mockResolvedValue({
      confirmado: false, total: 2, validas: 2,
      filas: [
        { fila: 2, valido: true, datos: { nombre: 'Laura', correo: 'laura@sena.edu.co', documento: '123456' }, error: null },
        { fila: 3, valido: true, datos: { nombre: 'Pedro', correo: 'pedro@sena.edu.co', documento: '654321' }, error: null },
      ],
    })
    apiPostMock
      .mockResolvedValueOnce({ correo: 'laura@sena.edu.co', estado: 'creado', detalle: 'Invitación enviada.' })
      .mockResolvedValueOnce({ correo: 'pedro@sena.edu.co', estado: 'omitido', detalle: 'Ya existe una cuenta.' })
    const usuario = userEvent.setup()
    renderConProviders(<AltaInstructores />)
    await usuario.click(screen.getByRole('tab', { name: 'Carga masiva' }))
    await usuario.upload(screen.getByLabelText('Archivo Excel de instructores'), new File(['contenido'], 'coordinacion.xlsx'))
    await usuario.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    await usuario.click(await screen.findByRole('button', { name: 'Confirmar e invitar' }))
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(2))
    expect(apiPostMock).toHaveBeenNthCalledWith(1, '/instructores/alta/', expect.objectContaining({ correo: 'laura@sena.edu.co' }), 45000)
    expect(apiPostMock).toHaveBeenNthCalledWith(2, '/instructores/alta/', expect.objectContaining({ correo: 'pedro@sena.edu.co' }), 45000)
    expect(await screen.findByText('Importación procesada. Revisa el resultado de cada instructor.')).toBeInTheDocument()
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
    await usuario.click(screen.getByRole('tab', { name: 'Carga masiva' }))
    const hoja = new File(['contenido'], 'coordinacion.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await usuario.upload(screen.getByLabelText('Archivo Excel de instructores'), hoja)
    await usuario.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    const seccion = await screen.findByRole('region', { name: 'Carga masiva de instructores' })
    expect(within(seccion).getByText('Vista previa · 1 de 2 filas válidas')).toBeInTheDocument()
    expect(within(seccion).getByRole('button', { name: 'Confirmar e invitar' })).toBeDisabled()
    expect(apiPostFormMock).toHaveBeenCalledTimes(1)
  })
})
