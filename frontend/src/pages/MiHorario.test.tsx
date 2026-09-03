import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { MiHorario } from './MiHorario'
import type { Horario } from '../types/api'

const HORARIO: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1],
  fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

describe('MiHorario', () => {
  it('pide /usuarios/me/horarios y dibuja el grid con lo publicado', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/me/horarios' ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    expect(apiGetMock).toHaveBeenCalledWith('/usuarios/me/horarios')
    expect(await screen.findByText('CPL18')).toBeInTheDocument()
    expect(screen.getByText('Erick Granados')).toBeInTheDocument()
  })

  it('sin clases publicadas, muestra el mensaje correspondiente', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/me/horarios' ? Promise.resolve([]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Todavía no tenés clases publicadas en este trimestre.')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/me/horarios' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar tu horario.')).toBeInTheDocument()
    })
  })

  it('un Instructor puro ve "Mi horario" pero NO las herramientas de coordinación en el sidebar', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByRole('link', { name: 'Mi horario' })).toHaveAttribute('href', '/mi-horario')
    // Ni siquiera debe aparecer el link — no es solo un tema de que falle
    // al hacer clic, la herramienta de coordinación no debe ser visible.
    expect(screen.queryByRole('link', { name: 'Fichas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Instructores' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendario general' })).not.toBeInTheDocument()
  })

  it('un Coordinador ve las herramientas de coordinación pero NO "Mi horario" (no tiene rol Instructor)', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Ana', email: 'a@example.com', roles: [{ idRol: 2, nombre: 'Coordinador' }] })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    await screen.findByText('Todavía no tenés clases publicadas en este trimestre.')
    expect(screen.queryByRole('link', { name: 'Mi horario' })).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Fichas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Instructores' })).toBeInTheDocument()
  })

  it('un usuario con roles Instructor y Coordinador a la vez ve ambos mundos', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({
          idUsuario: 'u1', nombre: 'Multi', email: 'm@example.com',
          roles: [{ idRol: 1, nombre: 'Instructor' }, { idRol: 2, nombre: 'Coordinador' }],
        })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByRole('link', { name: 'Mi horario' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fichas' })).toBeInTheDocument()
  })
})
