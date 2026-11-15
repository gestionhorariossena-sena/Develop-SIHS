import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificacionesPanel } from '../../../src/components/NotificacionesPanel'
import type { Notificacion } from '../../../src/types/api'

const { apiPatchMock } = vi.hoisted(() => ({
  apiPatchMock: vi.fn(),
}))
vi.mock('../../../src/services/api', () => ({ apiPatch: apiPatchMock }))

const crearNotificacion = (
  idNotificacion: number,
  tipo: string,
  leida = false,
): Notificacion => ({
  idNotificacion,
  idUsuario: 'usuario-pruebas',
  tipo,
  mensaje: `Mensaje de prueba ${idNotificacion}`,
  leida,
  fechaCreacion: new Date().toISOString(),
  entidadRelacionada: null,
  idEntidadRelacionada: null,
})

describe('NotificacionesPanel — comportamiento visible', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el estado vacío y permite cerrar el panel', () => {
    // Arrange
    const onCerrar = vi.fn()
    render(
      <NotificacionesPanel
        notificaciones={[]}
        onNotificacionesActualizadas={vi.fn()}
        onCerrar={onCerrar}
      />,
    )

    // Assert
    expect(screen.getByText('No tienes notificaciones.')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(screen.getByTitle('No hay notificaciones sin leer')).toBeDisabled()

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificaciones' }))
    expect(onCerrar).toHaveBeenCalledOnce()
  })

  it('muestra distintos tipos de notificaciones y marca una como leída', async () => {
    // Arrange
    const notificaciones = [
      crearNotificacion(1, 'cruce'),
      crearNotificacion(2, 'horario'),
      crearNotificacion(3, 'ambiente'),
      crearNotificacion(4, 'sistema'),
    ]
    const onActualizadas = vi.fn()
    apiPatchMock.mockResolvedValue({ ...notificaciones[0], leida: true })
    render(
      <NotificacionesPanel
        notificaciones={notificaciones}
        onNotificacionesActualizadas={onActualizadas}
        onCerrar={vi.fn()}
      />,
    )
    expect(screen.getByText('4 sin leer')).toBeInTheDocument()
    for (const item of notificaciones) {
      expect(screen.getByText(item.mensaje)).toBeInTheDocument()
    }

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Cruce/i }))

    // Assert
    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/notificaciones/1/leida'))
    await waitFor(() => expect(onActualizadas).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ idNotificacion: 1, leida: true })]),
    ))
  })

  it('marca todas las notificaciones como leídas solo al confirmar el backend', async () => {
    // Arrange
    const onActualizadas = vi.fn()
    const notificaciones = [crearNotificacion(10, 'sistema'), crearNotificacion(11, 'horario')]
    apiPatchMock.mockResolvedValue({})
    render(
      <NotificacionesPanel
        notificaciones={notificaciones}
        onNotificacionesActualizadas={onActualizadas}
        onCerrar={vi.fn()}
      />,
    )

    // Act
    fireEvent.click(screen.getByTitle('Marcar todas como leídas'))

    // Assert
    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/notificaciones/marcar-todas-leidas'))
    await waitFor(() => expect(onActualizadas).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ idNotificacion: 10, leida: true }),
        expect.objectContaining({ idNotificacion: 11, leida: true }),
      ]),
    ))
  })

  it('conserva las notificaciones si falla la operación del backend', async () => {
    // Arrange
    const onActualizadas = vi.fn()
    apiPatchMock.mockRejectedValue(new Error('Sin conexión'))
    render(
      <NotificacionesPanel
        notificaciones={[crearNotificacion(20, 'ambiente')]}
        onNotificacionesActualizadas={onActualizadas}
        onCerrar={vi.fn()}
      />,
    )

    // Act
    fireEvent.click(screen.getByTitle('Marcar todas como leídas'))

    // Assert
    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByTitle('Marcar todas como leídas')).toBeEnabled())
    expect(onActualizadas).not.toHaveBeenCalled()
  })

  it('deshabilita la notificación mientras espera confirmación y luego actualiza la lista', async () => {
    const user = userEvent.setup()
    const notificacion = crearNotificacion(31, 'sistema')
    const actualizada = { ...notificacion, leida: true }
    let confirmarActualizacion!: (valor: Notificacion) => void
    const respuesta = new Promise<Notificacion>((resolve) => {
      confirmarActualizacion = resolve
    })
    const onActualizadas = vi.fn()
    apiPatchMock.mockReturnValue(respuesta)

    render(
      <NotificacionesPanel
        notificaciones={[notificacion]}
        onNotificacionesActualizadas={onActualizadas}
        onCerrar={vi.fn()}
      />,
    )

    const boton = screen.getByRole('button', {
      name: /Sistema.*Mensaje de prueba 31/,
    })
    await user.click(boton)

    expect(apiPatchMock).toHaveBeenCalledWith('/notificaciones/31/leida')
    expect(boton).toBeDisabled()

    confirmarActualizacion(actualizada)

    await waitFor(() => {
      expect(onActualizadas).toHaveBeenCalledWith([actualizada])
      expect(boton).toBeEnabled()
    })
  })

  it('conserva una notificación sin leer si falla su actualización individual', async () => {
    const user = userEvent.setup()
    const notificacion = crearNotificacion(32, 'sistema')
    const onActualizadas = vi.fn()
    apiPatchMock.mockRejectedValue(new Error('Sin conexión'))

    render(
      <NotificacionesPanel
        notificaciones={[notificacion]}
        onNotificacionesActualizadas={onActualizadas}
        onCerrar={vi.fn()}
      />,
    )

    const boton = screen.getByRole('button', {
      name: /Sistema.*Mensaje de prueba 32/,
    })
    await user.click(boton)

    await waitFor(() => expect(boton).toBeEnabled())
    expect(screen.getByText('Mensaje de prueba 32')).toBeInTheDocument()
    expect(onActualizadas).not.toHaveBeenCalled()
  })

  it('no envía una solicitud al seleccionar una notificación ya leída', async () => {
    const user = userEvent.setup()
    const notificacion = crearNotificacion(33, 'sistema', true)

    render(
      <NotificacionesPanel
        notificaciones={[notificacion]}
        onNotificacionesActualizadas={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    const boton = screen.getByRole('button', {
      name: /Sistema.*Mensaje de prueba 33/,
    })

    expect(boton).toBeDisabled()
    await user.click(boton)

    expect(apiPatchMock).not.toHaveBeenCalled()
  })
})
