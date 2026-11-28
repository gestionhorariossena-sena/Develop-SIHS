import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CargaMasivaInstructores } from '../../../src/pages/CargaMasivaInstructores'

const { apiDeleteMock, apiGetMock, apiPostFormMock } = vi.hoisted(() => ({ apiDeleteMock: vi.fn(), apiGetMock: vi.fn(), apiPostFormMock: vi.fn() }))

vi.mock('../../../src/components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
vi.mock('../../../src/services/api', () => ({
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPostForm: (...args: unknown[]) => apiPostFormMock(...args),
  ApiError: class ApiError extends Error {},
}))

describe('CargaMasivaInstructores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiGetMock.mockResolvedValue([])
  })

  it('guarda el CSV seleccionado, lo previsualiza y permite importar las filas válidas', async () => {
    const usuario = userEvent.setup()
    apiPostFormMock
      .mockResolvedValueOnce({ validos: [{ fila: 2, documento: '1001', nombre: 'Ana Pérez', correo: 'ana@sena.edu.co', contrato: 'planta', horas: 32, especialidades: [] }], errores: [{ fila: 3, mensaje: 'horas debe ser 32 para planta o 40 para contrato' }] })
      .mockResolvedValueOnce({ creados: 1, existentes: 0, errores: [{ fila: 3, mensaje: 'horas debe ser 32 para planta o 40 para contrato' }], credencialesTemporales: [] })

    render(<CargaMasivaInstructores />)
    const archivo = new File(['documento,nombre,correo,contrato,horas\n1001,Ana Pérez,ana@sena.edu.co,planta,32'], 'instructores.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Archivo CSV'), { target: { files: [archivo] } })

    expect(screen.getByText('instructores.csv')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Revisar archivo' }))
    await screen.findByText('Previsualización: 1 filas válidas y 1 con errores')
    expect(apiPostFormMock).toHaveBeenCalledWith('/usuarios/instructores/importar/previsualizar', expect.any(FormData), 60000)

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 1 filas válidas' }))
    await waitFor(() => expect(apiPostFormMock).toHaveBeenCalledWith('/usuarios/instructores/importar', expect.any(FormData), 60000))
    expect(await screen.findByText('Resultado de la importación')).toBeInTheDocument()
    expect(screen.getByText('Creados: 1. Ya existentes: 0. Rechazados: 1.')).toBeInTheDocument()
  })
})
