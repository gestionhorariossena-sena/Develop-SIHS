import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { MiHorario } from '../../../src/pages/MiHorario'
import type { Ficha, Horario } from '../../../src/types/api'

const HORARIO: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1],
  fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const FICHA: Ficha = {
  idFicha: 1, codigoFicha: '3228973 B', idPrograma: 1, idTrimestre: 1, idSede: 1,
  programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Tecnólogo en Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre II', fechaInicio: '2026-01-01', fechaFin: '2026-03-01', estado: 'activo' },
  sede: null,
  aprendicesTotales: 28,
  jornadas: ['Mañana'],
}

const apiGetMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

describe('MiHorario', () => {
  it('pide /usuarios/me/horarios y dibuja el grid con lo publicado', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    expect(apiGetMock).toHaveBeenCalledWith(expect.stringMatching(/^\/usuarios\/me\/horarios\?fechaInicio=\d{4}-\d{2}-\d{2}&fechaFin=\d{4}-\d{2}-\d{2}$/))
    expect(await screen.findByText('Gestión de inventarios')).toBeInTheDocument()
    expect(screen.getAllByText('3228973 B').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ambiente 101').length).toBeGreaterThan(0)
  })

  it('cambia de semana y vuelve a consultar el rango; Hoy regresa a la semana actual', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    const usuario = userEvent.setup()
    const llamadasIniciales = apiGetMock.mock.calls.filter(([path]) => String(path).startsWith('/usuarios/me/horarios')).length
    renderConProviders(<MiHorario />)

    await screen.findByText('Gestión de inventarios')
    const llamadasDeHorario = () => apiGetMock.mock.calls.filter(([path]) => String(path).startsWith('/usuarios/me/horarios'))
    expect(llamadasDeHorario()).toHaveLength(llamadasIniciales + 1)

    await usuario.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    await waitFor(() => expect(llamadasDeHorario()).toHaveLength(llamadasIniciales + 2))

    await usuario.click(screen.getByRole('button', { name: 'Hoy' }))
    await waitFor(() => expect(llamadasDeHorario()).toHaveLength(llamadasIniciales + 3))
  })

  it('Actualiza el horario de la semana actual sin recargar la página', async () => {
    let solicitudes = 0
    apiGetMock.mockImplementation((path: string) => {
      if (path.startsWith('/usuarios/me/horarios')) {
        solicitudes += 1
        return Promise.resolve(solicitudes === 1 ? [HORARIO] : [])
      }
      return Promise.reject(new Error('no mockeado'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<MiHorario />)
    await screen.findByText('Gestión de inventarios')
    await usuario.click(screen.getByRole('button', { name: 'Actualizar horario' }))
    expect(await screen.findByText('Todavía no tenés clases publicadas en este período académico.')).toBeInTheDocument()
    expect(solicitudes).toBe(2)
  })

  it('celdas sin clase muestran "Franja Libre" y el filtro de jornada oculta las otras filas', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
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

  it('permite abrir el detalle desde un bloque del horario', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    const enlaces = await screen.findAllByRole('link', { name: /Detalle/ })
    expect(enlaces[0]).toHaveAttribute('href', expect.stringContaining('/mi-horario/detalle-franja?horario='))
  })

  it('el resumen usa GET /usuarios/{id}/carga-semanal para la carga semanal', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'planta', horasAsignadas: 12, horasMaximas: 32 })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    const resumen = within(await screen.findByRole('region', { name: 'Resumen de mi horario' }))
    expect(await resumen.findByText('12 h')).toBeInTheDocument()
    expect(resumen.getByText('Límite: 32 h')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/usuarios/u1/carga-semanal')
  })

  it('ofrece accesos directos a asistencia y solicitudes de cambio', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    expect(screen.getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('href', '/asistencia')
    expect(screen.getByRole('link', { name: 'Mis solicitudes de cambio' })).toHaveAttribute('href', '/mis-solicitudes-cambio')
  })

  it('Mis Fichas Activas: programa y aprendices son reales; vocero/avance curricular quedan como pendientes, no inventados', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([HORARIO])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Tecnólogo en Análisis y Desarrollo de Software')).toBeInTheDocument()
    expect(screen.getByText('28 aprendices')).toBeInTheDocument()
    expect(screen.getByText('Vocero: No disponible')).toBeInTheDocument()
    expect(screen.getByText('Avance curricular: No disponible')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Contactar/ })).toBeDisabled()
  })

  it('dentro del tope muestra el límite calculado sin atribuir una aprobación', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'planta', horasAsignadas: 12, horasMaximas: 32 })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Dentro del límite de 32 h semanales.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Resumen de mi horario' })).toBeInTheDocument()
  })

  it('sobre el tope muestra el estado real de alerta', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'planta', horasAsignadas: 36, horasMaximas: 32 })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Excede el tope de 32 h')
    expect(screen.getByRole('alert')).toHaveTextContent('Supera el límite de carga docente')
    expect(screen.queryByText('Dentro del límite de 32 h semanales.')).not.toBeInTheDocument()
  })

  it('Estatus Normativo RF-011: sin tipoContrato no hay tope que evaluar, no muestra "Aprobado"', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', roles: [{ idRol: 1, nombre: 'Instructor' }] })
      }
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([HORARIO])
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: null, horasAsignadas: 6, horasMaximas: null })
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Falta el tipo de contrato para evaluar el límite de carga docente.')).toBeInTheDocument()
    expect(screen.queryByText(/Dentro del límite/)).not.toBeInTheDocument()
  })

  it('sin clases publicadas, muestra el mensaje correspondiente', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.resolve([]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<MiHorario />)

    expect(await screen.findByText('Todavía no tenés clases publicadas en este período académico.')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path.startsWith('/usuarios/me/horarios') ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
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
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<MiHorario />)

    await usuario.click(await screen.findByRole('button', { name: 'Mi trabajo' }))
    expect(await screen.findByRole('link', { name: 'Mi horario' })).toHaveAttribute('href', '/mi-horario')
    // Ni siquiera debe aparecer el link — no es solo un tema de que falle
    // al hacer clic, la herramienta de coordinación no debe ser visible.
    expect(screen.queryByRole('link', { name: 'Datos académicos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calendario general' })).not.toBeInTheDocument()
  })

  it('un Coordinador ve las herramientas de coordinación pero NO "Mi horario" (no tiene rol Instructor)', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({ idUsuario: 'u1', nombre: 'Ana', email: 'a@example.com', roles: [{ idRol: 2, nombre: 'Coordinador' }] })
      }
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<MiHorario />)

    await screen.findByText('Todavía no tenés clases publicadas en este período académico.')
    expect(screen.queryByRole('link', { name: 'Mi horario' })).not.toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'Datos académicos' })).toHaveAttribute('href', '/datos-academicos')
  })

  it('un usuario con roles Instructor y Coordinador a la vez ve ambos mundos', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') {
        return Promise.resolve({
          idUsuario: 'u1', nombre: 'Multi', email: 'm@example.com',
          roles: [{ idRol: 1, nombre: 'Instructor' }, { idRol: 2, nombre: 'Coordinador' }],
        })
      }
      if (path.startsWith('/usuarios/me/horarios')) return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<MiHorario />)

    await usuario.click(await screen.findByRole('button', { name: 'Mi trabajo' }))
    expect(await screen.findByRole('link', { name: 'Mi horario' })).toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'Datos académicos' })).toHaveAttribute('href', '/datos-academicos')
  })
})
