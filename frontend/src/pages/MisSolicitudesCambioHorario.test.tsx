import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { MisSolicitudesCambioHorario } from './MisSolicitudesCambioHorario'
import type { SolicitudCambioHorario, Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'i-1',
  nombre: 'Carlos López',
  email: 'carlos@mail.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  debeCambiarClave: false,
  roles: [{ idRol: 3, nombre: 'Instructor' }],
  especialidades: [],
}

const SOLICITUD: SolicitudCambioHorario = {
  idSolicitud: 1,
  idInstructor: 'i-1',
  idHorarioOrigen: 169,
  tipo: 'cambio-ambiente',
  motivo: 'El videobeam no enciende.',
  estado: 'pendiente',
  fechaSolicitud: '2026-09-24T10:00:00Z',
  fechaResolucion: null,
  idAdminResolvio: null,
  instructorNombre: 'Carlos López',
  fichaCodigo: '3171618',
  horaInicio: '11:00:00',
  horaFin: '13:00:00',
  ambienteNombre: 'Laboratorio de Redes',
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

describe('MisSolicitudesCambioHorario', () => {
  it('muestra al instructor el estado y los datos de su reporte', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/solicitudes-cambio-horario/mias') return Promise.resolve([SOLICITUD])
      if (path === '/usuarios/me') return Promise.resolve(INSTRUCTOR)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.resolve([])
    })

    renderConProviders(<MisSolicitudesCambioHorario />)

    expect(await screen.findByText('El videobeam no enciende.')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText(/Ficha 3171618 · 11:00 a 13:00 · Laboratorio de Redes/)).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/solicitudes-cambio-horario/mias')
  })
})
