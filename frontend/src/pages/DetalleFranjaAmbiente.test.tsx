import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { DetalleFranjaAmbiente } from './DetalleFranjaAmbiente'
import type { Ambiente, CompetenciaFormacion, Ficha, Horario, ResultadoAprendizaje, Usuario } from '../types/api'

const HORARIO: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 5, idInstructor: 'u1', idFicha: 7, idResultado: 3, dias: [1],
  fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Carlos Morales', fichaCodigo: '2670142', ambienteNombre: 'Laboratorio 302',
  resultadoCodigo: 'RAP1', resultadoDescripcion: 'Construir el sistema de información.',
}

const PERFIL: Usuario = {
  idUsuario: 'u1', nombre: 'Carlos Morales', email: 'carlos@example.com', estado: 'activo',
  fechaRegistro: '2026-01-01', tipoContrato: 'planta', roles: [{ idRol: 1, nombre: 'Instructor' }], especialidades: [],
  debeCambiarClave: false,
}

const FICHA: Ficha = {
  idFicha: 7, codigoFicha: '2670142', idPrograma: 1, idTrimestre: 1, idSede: 1,
  programa: { idPrograma: 1, codigoPrograma: '228106', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, nombre: '2026-1', fechaInicio: '2026-01-05', fechaFin: '2026-04-30', estado: 'activo' },
  sede: { idSede: 1, nombreSede: 'Calle 52', direccion: null, tipoSede: 'principal' },
  aprendicesTotales: 28,
  jornadas: ['Mañana'],
}

const AMBIENTE: Ambiente = {
  idAmbiente: 5, numeroAmbiente: 302, nombreAmbiente: 'Laboratorio 302', tipoAmbiente: 'especial', estadoAmbiente: 'disponible', idSede: 1,
}

const RESULTADO: ResultadoAprendizaje = {
  idResultado: 3, codigo: 'RAP1', descripcion: 'Construir el sistema de información.', idCompetencia: 9, idGuia: null, horasAsignadas: null,
}

const COMPETENCIA: CompetenciaFormacion = {
  idCompetencia: 9, codigo: '220501096', descripcion: 'Construcción de software según requisitos técnicos.', idPrograma: 1,
}

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockRespuestasCompletas() {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
    if (path === '/usuarios/me') return Promise.resolve(PERFIL)
    if (path === '/fichas/7') return Promise.resolve(FICHA)
    if (path === '/ambientes/5') return Promise.resolve(AMBIENTE)
    if (path === '/resultados-aprendizaje/3') return Promise.resolve(RESULTADO)
    if (path === '/competencias-formacion/9') return Promise.resolve(COMPETENCIA)
    if (path === '/solicitudes-cambio-horario/mias') return Promise.resolve([])
    return Promise.reject(new Error('no mockeado'))
  })
}

describe('DetalleFranjaAmbiente', () => {
  it('sin ?horario= en la URL, muestra "No encontramos esa franja"', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/me/horarios' ? Promise.resolve([HORARIO]) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja'])

    expect(await screen.findByText('No encontramos esa franja.')).toBeInTheDocument()
  })

  it('con datos reales completos, dibuja programa, ficha, ambiente, competencia y RAP', async () => {
    mockRespuestasCompletas()
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja?horario=1&dia=Lunes'])

    expect(await screen.findByText('Detalle de Sesión Formativa: Análisis y Desarrollo de Software')).toBeInTheDocument()
    expect(await screen.findByText('Construcción de software según requisitos técnicos.')).toBeInTheDocument()
    expect(screen.getByText('"Construir el sistema de información."')).toBeInTheDocument()
    expect(screen.getByText('Laboratorio 302')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('Calle 52')).toBeInTheDocument()
  })

  it('marca como pendientes los datos que dependen de otros tickets, sin inventarlos', async () => {
    mockRespuestasCompletas()
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja?horario=1&dia=Lunes'])

    await screen.findByText('Detalle de Sesión Formativa: Análisis y Desarrollo de Software')

    expect(screen.getByText('Pendiente — depende del ticket de avance curricular.')).toBeInTheDocument()
    expect(screen.getByText('Pendiente — depende del ticket de vocero/subvocero.')).toBeInTheDocument()
    expect(screen.getByText('*Dato Conceptual / En Evaluación')).toBeInTheDocument()
  })

  it('nómina de aprendices: mantiene el banner de módulo exploratorio y NO muestra una tabla de aprendices inventados', async () => {
    mockRespuestasCompletas()
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja?horario=1&dia=Lunes'])

    await screen.findByText('Detalle de Sesión Formativa: Análisis y Desarrollo de Software')

    expect(screen.getByText('MÓDULO EXPLORATORIO / EN EVALUACIÓN UX')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Juan Camilo Pérez')).not.toBeInTheDocument()
  })

  it('las acciones sin backend real quedan deshabilitadas', async () => {
    mockRespuestasCompletas()
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja?horario=1&dia=Lunes'])

    await screen.findByText('Detalle de Sesión Formativa: Análisis y Desarrollo de Software')

    // No hay exportación de ficha ni concepto de "sesión" que cerrar.
    expect(screen.getByRole('button', { name: /Descargar Ficha/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Cerrar Sesión de Formación/ })).toBeDisabled()
  })

  // H-4: reportar SÍ tiene backend desde siempre — lo que faltaba era
  // esta pantalla. Es la única voz del instructor en el sistema.
  it('reportar una novedad manda el tipo y el motivo a /solicitudes-cambio-horario', async () => {
    mockRespuestasCompletas()
    apiPostMock.mockResolvedValue({
      idSolicitud: 10, idInstructor: 'u1', idHorarioOrigen: 1, tipo: 'cambio-ambiente',
      motivo: 'El videobeam no enciende.', estado: 'pendiente',
      fechaSolicitud: '2026-09-24T10:00:00Z', fechaResolucion: null, idAdminResolvio: null,
    })
    const usuario = userEvent.setup()
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja?horario=1&dia=Lunes'])

    await screen.findByText('Detalle de Sesión Formativa: Análisis y Desarrollo de Software')
    await usuario.click(screen.getByRole('button', { name: /Reportar Novedad/ }))

    const modal = await screen.findByRole('dialog')
    await usuario.click(within(modal).getByLabelText(/Cambio de ambiente/))
    await usuario.type(within(modal).getByLabelText('¿Qué pasó?'), 'El videobeam no enciende.')
    await usuario.click(within(modal).getByRole('button', { name: 'Enviar a coordinación' }))

    expect(apiPostMock).toHaveBeenCalledWith('/solicitudes-cambio-horario/', {
      idHorarioOrigen: 1,
      tipo: 'cambio-ambiente',
      motivo: 'El videobeam no enciende.',
    })

    // Y queda a la vista, para que no lo reporte dos veces creyendo que se perdió.
    expect(await screen.findByText('Lo que ya reportaste de esta franja')).toBeInTheDocument()
    expect(screen.getByText('En revisión de coordinación')).toBeInTheDocument()
  })

  it('lo ya reportado de esta franja se muestra con su estado', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/solicitudes-cambio-horario/mias') {
        return Promise.resolve([
          {
            idSolicitud: 4, idInstructor: 'u1', idHorarioOrigen: 1, tipo: 'novedad',
            motivo: 'Faltaron sillas.', estado: 'aprobada',
            fechaSolicitud: '2026-09-20T10:00:00Z', fechaResolucion: '2026-09-21T10:00:00Z',
            idAdminResolvio: 'c1',
          },
          // De otra franja: no debe aparecer acá.
          {
            idSolicitud: 5, idInstructor: 'u1', idHorarioOrigen: 99, tipo: 'permuta',
            motivo: 'Otra franja distinta.', estado: 'pendiente',
            fechaSolicitud: '2026-09-20T10:00:00Z', fechaResolucion: null, idAdminResolvio: null,
          },
        ])
      }
      if (path === '/usuarios/me/horarios') return Promise.resolve([HORARIO])
      if (path === '/usuarios/me') return Promise.resolve(PERFIL)
      if (path === '/fichas/7') return Promise.resolve(FICHA)
      if (path === '/ambientes/5') return Promise.resolve(AMBIENTE)
      if (path === '/resultados-aprendizaje/3') return Promise.resolve(RESULTADO)
      if (path === '/competencias-formacion/9') return Promise.resolve(COMPETENCIA)
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<DetalleFranjaAmbiente />, ['/mi-horario/detalle-franja?horario=1&dia=Lunes'])

    expect(await screen.findByText('Faltaron sillas.')).toBeInTheDocument()
    expect(screen.getByText('Aprobada por coordinación')).toBeInTheDocument()
    expect(screen.queryByText('Otra franja distinta.')).not.toBeInTheDocument()
  })
})
