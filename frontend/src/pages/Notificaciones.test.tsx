import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Notificaciones } from './Notificaciones'
import type { Notificacion } from '../types/api'

const HACE_3_DIAS = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
const HACE_MUCHO = '2020-01-01T08:00:00Z'

const NOTIFICACIONES: Notificacion[] = [
  {
    idNotificacion: 1,
    idUsuario: 'u1',
    tipo: 'Cambios de Aula & Horario',
    mensaje: 'Tu sesión de mañana cambia de ambiente.',
    leida: false,
    fechaCreacion: new Date().toISOString(),
    entidadRelacionada: 'horarios',
    idEntidadRelacionada: '42',
  },
  {
    idNotificacion: 2,
    idUsuario: 'u1',
    tipo: 'Recordatorios de Tareas',
    mensaje: 'Entrega del proyecto formativo en 24 horas.',
    leida: false,
    fechaCreacion: HACE_3_DIAS,
    entidadRelacionada: null,
    idEntidadRelacionada: null,
  },
  {
    idNotificacion: 3,
    idUsuario: 'u1',
    tipo: 'Sistema & Coordinación',
    mensaje: 'Jornada pedagógica el viernes.',
    leida: true,
    fechaCreacion: HACE_MUCHO,
    entidadRelacionada: null,
    idEntidadRelacionada: null,
  },
]

const apiGetMock = vi.fn()
const apiPatchMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  ApiError: class ApiError extends Error {},
}))

/** AppShell también llama a apiGet('/usuarios/me') al montar. */
function mockearNotificacionesYPerfil(notificaciones: unknown) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/notificaciones/') return typeof notificaciones === 'function' ? notificaciones() : Promise.resolve(notificaciones)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Notificaciones', () => {
  it('carga las notificaciones y las agrupa por fecha', async () => {
    mockearNotificacionesYPerfil(NOTIFICACIONES)
    renderConProviders(<Notificaciones />)

    expect(await screen.findByText('Tu sesión de mañana cambia de ambiente.')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/notificaciones/')
    expect(screen.getByText('Hoy')).toBeInTheDocument()
    expect(screen.getByText('Esta semana')).toBeInTheDocument()
    expect(screen.getByText('Anteriores')).toBeInTheDocument()
    expect(screen.getByText('2 notificaciones no leídas.')).toBeInTheDocument()
  })

  it('el filtro por tipo muestra solo las notificaciones de esa categoría', async () => {
    mockearNotificacionesYPerfil(NOTIFICACIONES)
    const usuario = userEvent.setup()
    renderConProviders(<Notificaciones />)
    await screen.findByText('Tu sesión de mañana cambia de ambiente.')

    await usuario.click(screen.getByRole('button', { name: 'Recordatorios de Tareas' }))

    expect(screen.getByText('Entrega del proyecto formativo en 24 horas.')).toBeInTheDocument()
    expect(screen.queryByText('Tu sesión de mañana cambia de ambiente.')).not.toBeInTheDocument()
  })

  it('marca una notificación individual como leída', async () => {
    mockearNotificacionesYPerfil(NOTIFICACIONES)
    apiPatchMock.mockResolvedValue({ ...NOTIFICACIONES[0], leida: true })
    const usuario = userEvent.setup()
    renderConProviders(<Notificaciones />)
    await screen.findByText('Tu sesión de mañana cambia de ambiente.')

    await usuario.click(screen.getAllByRole('button', { name: 'Marcar como leída' })[0])

    expect(apiPatchMock).toHaveBeenCalledWith('/notificaciones/1/leida')
    await waitFor(() => {
      expect(screen.getByText('1 notificación no leída.')).toBeInTheDocument()
    })
  })

  it('marca todas como leídas', async () => {
    mockearNotificacionesYPerfil(NOTIFICACIONES)
    apiPatchMock.mockResolvedValue({ mensaje: 'ok', cantidad: 2 })
    const usuario = userEvent.setup()
    renderConProviders(<Notificaciones />)
    await screen.findByText('Tu sesión de mañana cambia de ambiente.')

    await usuario.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }))

    expect(apiPatchMock).toHaveBeenCalledWith('/notificaciones/marcar-todas-leidas')
    await waitFor(() => {
      expect(screen.getByText('Sin notificaciones pendientes.')).toBeInTheDocument()
    })
  })

  it('el botón "Ver en mi horario" está deshabilitado (Mi Horario del Aprendiz es otro ticket)', async () => {
    mockearNotificacionesYPerfil(NOTIFICACIONES)
    renderConProviders(<Notificaciones />)
    await screen.findByText('Tu sesión de mañana cambia de ambiente.')

    const botones = screen.getAllByRole('button', { name: 'Ver en mi horario' })
    expect(botones.length).toBeGreaterThan(0)
    botones.forEach((boton) => expect(boton).toBeDisabled())
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/notificaciones/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Notificaciones />)

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar tus notificaciones.')).toBeInTheDocument()
    })
  })
})
