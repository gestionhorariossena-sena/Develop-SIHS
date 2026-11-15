import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderConProviders } from '../../helpers/renderConProviders'
import { DashboardAprendiz } from '../../../src/pages/DashboardAprendiz'
import type { Aviso, Ficha, Horario, MiAsistencia, Notificacion, Usuario } from '../../../src/types/api'

const { ApiErrorMock, apiGetMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { ApiErrorMock, apiGetMock: vi.fn() }
})
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: ApiErrorMock,
}))

const PERFIL: Usuario = {
  idUsuario: 'u1',
  nombre: 'Sara Rodríguez',
  email: 'sara@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 1, nombre: 'Aprendiz' }],
  especialidades: [],
  debeCambiarClave: false,
}

const FICHA: Ficha = {
  idFicha: 1,
  codigoFicha: '2874521',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  programa: {
    idPrograma: 1,
    codigoPrograma: 'ADSO',
    nombrePrograma: 'Análisis y Desarrollo de Software',
    nivelFormacion: 'Tecnólogo',
    activo: true,
    idCoordinacion: 1,
  },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre IV', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  sede: null,
  aprendicesTotales: 30,
  jornadas: [],
}

function mockearRespuestas({
  ficha,
  fichaError,
  horarios = [],
  asistencia,
  avisos = [],
  notificaciones = [],
}: {
  ficha?: Ficha
  fichaError?: InstanceType<typeof ApiErrorMock>
  horarios?: Horario[]
  asistencia?: MiAsistencia
  avisos?: Aviso[]
  notificaciones?: Notificacion[]
}) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/me') return Promise.resolve(PERFIL)
    if (path === '/ficha-usuario/mi-ficha') {
      return fichaError ? Promise.reject(fichaError) : Promise.resolve(ficha)
    }
    if (path === '/ficha-usuario/mi-horario') return Promise.resolve(horarios)
    if (path === '/asistencias/mias') {
      return asistencia ? Promise.resolve(asistencia) : Promise.reject(new ApiErrorMock(404, 'Sin asistencia'))
    }
    if (path === '/avisos/') return Promise.resolve(avisos)
    if (path === '/notificaciones/') return Promise.resolve(notificaciones)
    return Promise.reject(new Error(`no mockeado: ${path}`))
  })
}

const HORARIO: Horario = {
  idHorario: 1,
  horaInicio: '06:15:00',
  horaFin: '09:00:00',
  idJornada: 1,
  idTrimestre: 1,
  idAmbiente: 1,
  idInstructor: 'i-1',
  idFicha: 1,
  idResultado: 1,
  // Todos los días: así la prueba encuentra "próxima clase" sin importar
  // en qué día/hora real corra (no usa fake timers).
  dias: [1, 2, 3, 4, 5, 6],
  fechaCreacion: '2026-01-01',
  fechaModificacion: '2026-01-01',
  activo: true,
  publicado: true,
  instructorNombre: 'Ana Ríos',
  fichaCodigo: '2874521',
  ambienteNombre: '204',
  resultadoCodigo: null,
  resultadoDescripcion: 'Programación Web',
}

const ASISTENCIA: MiAsistencia = {
  resumen: { registradas: 48, presente: 42, tardanza: 3, excusa: 2, ausente: 1, porcentaje: 92 },
  sesiones: [],
}

const AVISO: Aviso = {
  idAviso: 1,
  idUsuarioPublicador: null,
  publicadorNombre: 'Coordinación Académica',
  titulo: 'Suspensión de clases el viernes',
  cuerpo: 'Mantenimiento eléctrico en el bloque B.',
  categoria: 'reprog',
  idFicha: null,
  idSede: null,
  adjuntoUrl: null,
  fechaPublicacion: new Date().toISOString(),
  vigenteHasta: null,
  fichaCodigo: null,
  sedeNombre: null,
}

const NOTIFICACION: Notificacion = {
  idNotificacion: 1,
  idUsuario: 'u1',
  tipo: 'ambiente',
  mensaje: 'Cambio de ambiente: Programación Web ahora en el 204.',
  leida: false,
  fechaCreacion: new Date().toISOString(),
  entidadRelacionada: null,
  idEntidadRelacionada: null,
}

describe('DashboardAprendiz', () => {
  it('saluda por el nombre de pila y muestra la ficha vinculada', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    expect(await screen.findByText('Hola, Sara')).toBeInTheDocument()
    expect(await screen.findByText('Ficha 2874521')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Desarrollo de Software')).toBeInTheDocument()
  })

  it('no muestra la tarjeta de ficha si el aprendiz no tiene una vinculada', async () => {
    mockearRespuestas({ fichaError: new ApiErrorMock(404, 'No tienes una ficha vinculada') })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Sara')
    await waitFor(() => expect(screen.queryByText(/^Ficha /)).not.toBeInTheDocument())
  })

  it('enlaza a las 4 pantallas del Aprendiz', async () => {
    mockearRespuestas({ ficha: FICHA })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Sara')

    // Se acota al <main> porque el sidebar (AppShell) también linkea a
    // estas mismas rutas dentro del grupo "MI TRABAJO".
    const contenido = within(screen.getByRole('main'))
    // '/mi-horario' está protegida para Instructor (ver AppRouter.tsx) -- un
    // Aprendiz necesita '/mi-horario-aprendiz' o ProtectedRoute lo rebota a
    // /dashboard. Antes de esta prueba, el link sí apuntaba a '/mi-horario'
    // y nadie lo notó porque esta aserción solo comparaba el string.
    expect(contenido.getByRole('link', { name: /Mi Horario/ })).toHaveAttribute('href', '/mi-horario-aprendiz')
    // '/mensajes-docentes' no existe en AppRouter.tsx -- solo '/mensajes'
    // renderiza MensajesAprendiz. El link viejo era un 404 silencioso.
    expect(contenido.getByRole('link', { name: /Mis instructores/ })).toHaveAttribute('href', '/mensajes')
    expect(contenido.getByRole('link', { name: /Comunicados del centro/ })).toHaveAttribute('href', '/avisos')
    expect(contenido.getByRole('link', { name: /Notificaciones/ })).toHaveAttribute('href', '/notificaciones')
  })

  it('muestra la franja de asistencia y los previews de cada tarjeta con datos reales', async () => {
    mockearRespuestas({
      ficha: FICHA,
      horarios: [HORARIO],
      asistencia: ASISTENCIA,
      avisos: [AVISO],
      notificaciones: [NOTIFICACION],
    })
    renderConProviders(<DashboardAprendiz />)

    await screen.findByText('Hola, Sara')

    // Franja de asistencia.
    expect(await screen.findByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()

    // Preview de "Mi Horario": próxima clase.
    expect(screen.getByText('Programación Web')).toBeInTheDocument()

    // Preview de "Mis instructores": instructor derivado del horario.
    // "Ana Ríos" aparece más de una vez (también en el pie de "Mi Horario").
    expect(screen.getAllByText(/Ana Ríos/).length).toBeGreaterThan(0)

    // Preview de "Comunicados del centro".
    expect(screen.getByText('Suspensión de clases el viernes')).toBeInTheDocument()

    // Preview de "Notificaciones".
    expect(screen.getByText('1 sin leer')).toBeInTheDocument()
  })
})
