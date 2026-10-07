import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { DashboardInstructor } from './DashboardInstructor'
import type { DiaSemana, Horario, Usuario } from '../types/api'

const { apiGetMock } = vi.hoisted(() => ({ apiGetMock: vi.fn() }))

vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {
    status = 500
  },
}))

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Mismo cálculo que hace el propio componente (capitalizar.es-CO weekday
// long) para que el bloque de "hoy" aparezca sin importar qué día corra
// el test.
const NOMBRE_DIA_HOY = capitalizar(new Date().toLocaleDateString('es-CO', { weekday: 'long' }))
const DIA_HOY: DiaSemana = { idDia: 1, nombreDia: NOMBRE_DIA_HOY }

const HORARIO_HOY: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1],
  fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const PERFIL: Usuario = {
  idUsuario: 'u1', nombre: 'Erick', email: 'e@example.com', estado: 'activo',
  fechaRegistro: '2026-01-01', roles: [{ idRol: 1, nombre: 'Instructor' }], especialidades: [],
  debeCambiarClave: false,
}

describe('DashboardInstructor', () => {
  // T-23 (SCRUM-141): Asistencia desactivada temporalmente -- el botón
  // "Pasar asistencia" no se renderiza mientras tanto. Destapar este test
  // (y quitar el .skip) junto con el resto de T-23 en AppShell/AppRouter.
  it.skip('mantiene visible el acceso a pasar asistencia aunque hoy no tenga clases', () => {
    apiGetMock.mockRejectedValue(new Error('Sin datos para esta prueba'))
    renderConProviders(<DashboardInstructor />)

    const contenido = within(screen.getByRole('main'))
    expect(contenido.getByRole('link', { name: /Pasar asistencia/i })).toHaveAttribute('href', '/asistencia')
  })

  // INS-04: "al seleccionar un horario, mostrar su información completa en
  // una vista/modal ahí mismo" -- "Detalle de ambiente" abre
  // DetalleFranjaAmbiente como modal sobre el Dashboard, no navega a otra ruta.
  it('clic en "Detalle de ambiente" de una sesión de hoy abre el detalle como modal, sin navegar', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO_HOY])
      if (path === '/usuarios/me') return Promise.resolve(PERFIL)
      if (path === '/fichas/') return Promise.resolve([])
      if (path === '/dias-semana/') return Promise.resolve([DIA_HOY])
      if (path === '/solicitudes-cambio-horario/mias') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<DashboardInstructor />)

    await usuario.click(await screen.findByRole('button', { name: 'Detalle de ambiente' }))

    const dialogo = await screen.findByRole('dialog', { name: /Detalle de Franja/ })
    // La pantalla de atrás (el Dashboard) se queda montada -- no navegó.
    expect(screen.getByText(/Hola, Erick/)).toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
