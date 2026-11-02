import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificacionesPanel } from '../../../src/components/NotificacionesPanel'
import type { Notificacion } from '../../../src/types/api'

const { apiPatchMock } = vi.hoisted(() => ({
  apiPatchMock: vi.fn(),
}))
vi.mock('../../../src/services/api', () => ({ apiPatch: apiPatchMock }))

function crearNotificacion(
  idNotificacion: number,
  leida = false,
): Notificacion {
  return {
    idNotificacion,
    idUsuario: 'usuario-s3-pruebas',
    tipo: 'sistema',
    mensaje: `Aviso de prueba ${idNotificacion}`,
    leida,
    fechaCreacion: '2026-11-02T15:00:00.000Z',
    entidadRelacionada: null,
    idEntidadRelacionada: null,
  }
}

describe('NotificacionesPanel — aporte S3 Dayana', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deshabilita la notificación mientras espera confirmación y luego actualiza la lista', async () => {
    const user = userEvent.setup()
    const notificacion = crearNotificacion(31)
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
      name: /Sistema.*Aviso de prueba 31/,
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
    const notificacion = crearNotificacion(32)
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
      name: /Sistema.*Aviso de prueba 32/,
    })
    await user.click(boton)

    await waitFor(() => expect(boton).toBeEnabled())
    expect(screen.getByText('Aviso de prueba 32')).toBeInTheDocument()
    expect(onActualizadas).not.toHaveBeenCalled()
  })

  it('no envía una solicitud al seleccionar una notificación ya leída', async () => {
    const user = userEvent.setup()
    const notificacion = crearNotificacion(33, true)

    render(
      <NotificacionesPanel
        notificaciones={[notificacion]}
        onNotificacionesActualizadas={vi.fn()}
        onCerrar={vi.fn()}
      />,
    )

    const boton = screen.getByRole('button', {
      name: /Sistema.*Aviso de prueba 33/,
    })

    expect(boton).toBeDisabled()
    await user.click(boton)

    expect(apiPatchMock).not.toHaveBeenCalled()
  })
})
