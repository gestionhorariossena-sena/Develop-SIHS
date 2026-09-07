import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(await screen.findByText('Gestión de inventarios')).toBeInTheDocument()
    expect(screen.getAllByText('3228973 B').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ambiente 101').length).toBeGreaterThan(0)
  })

  it('celdas sin clase muestran "Franja Libre" y el filtro de jornada oculta las otras filas', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/me/horarios' ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    const usuario = userEvent.setup()
    renderConProviders(<MiHorario />)

    // HORARIO es Lunes en la mañana — el resto de celdas de esa jornada
    // (y de las otras dos jornadas) quedan como "Franja Libre".
    expect((await screen.findAllByText('Franja Libre')).length).toBeGreaterThan(0)

    await usuario.click(screen.getByRole('button', { name: 'Tarde (12:00 - 18:00)' }))

    // Al filtrar por Tarde, el bloque real (que es de Mañana) desaparece
    // del grid y ya no queda nada publicado en esa jornada.
    expect(await screen.findByText('No tenés clases publicadas en esa jornada.')).toBeInTheDocument()
  })

  it('el botón "Abrir Detalle de Franja y Ambiente" está deshabilitado (pantalla de otro ticket, mismo epic)', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/me/horarios' ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    expect(await screen.findByRole('button', { name: /Abrir Detalle de Franja y Ambiente/ })).toBeDisabled()
  })

  it('el ribbon de KPIs usa GET /usuarios/{id}/carga-semanal para la carga lectiva semanal', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'planta', horasAsignadas: 12, horasMaximas: 32 })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('/ 32 hrs semanales')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/usuarios/u1/carga-semanal')
  })

  it('Estatus Normativo RF-011: dentro del tope muestra "Aprobado"', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'planta', horasAsignadas: 12, horasMaximas: 32 })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Aprobado')).toBeInTheDocument()
    expect(screen.getByText('Validado por Coordinación Académica')).toBeInTheDocument()
    expect(screen.getByText('Tope 32h')).toBeInTheDocument()
  })

  it('Estatus Normativo RF-011: sobre el tope NO inventa "Aprobado", muestra el estado real de alerta', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'planta', horasAsignadas: 36, horasMaximas: 32 })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Excede el tope')).toBeInTheDocument()
    expect(screen.getByText('Supera el máximo de RF-011')).toBeInTheDocument()
    expect(screen.queryByText('Aprobado')).not.toBeInTheDocument()
  })

  it('Estatus Normativo RF-011: sin tipoContrato no hay tope que evaluar, no muestra "Aprobado"', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: null, horasAsignadas: 6, horasMaximas: null })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Sin tipo de contrato definido — no hay tope de RF-011 que evaluar.')).toBeInTheDocument()
    expect(screen.queryByText('Aprobado')).not.toBeInTheDocument()
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
    const usuario = userEvent.setup()
    renderConProviders(<MiHorario />)

    await screen.findByText('Todavía no tenés clases publicadas en este trimestre.')
    expect(screen.queryByRole('link', { name: 'Mi horario' })).not.toBeInTheDocument()

    // "Fichas" e "Instructores" ahora viven en desplegables del navbar
    // ("Formación"/"Recursos") — hay que abrirlos para que el link exista
    // en el DOM.
    await usuario.click(await screen.findByRole('button', { name: 'Formación' }))
    expect(await screen.findByRole('link', { name: 'Fichas' })).toBeInTheDocument()

    await usuario.click(await screen.findByRole('button', { name: 'Recursos' }))
    expect(await screen.findByRole('link', { name: 'Instructores' })).toBeInTheDocument()
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
    const usuario = userEvent.setup()
    renderConProviders(<MiHorario />)

    expect(await screen.findByRole('link', { name: 'Mi horario' })).toBeInTheDocument()

    await usuario.click(await screen.findByRole('button', { name: 'Formación' }))
    expect(await screen.findByRole('link', { name: 'Fichas' })).toBeInTheDocument()
  })
})
