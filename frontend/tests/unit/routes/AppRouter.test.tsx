import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../../../src/routes/AppRouter'
import { AuthContext } from '../../../src/context/auth-context'
import type { AuthContextValue } from '../../../src/context/auth-context'
import { ThemeProvider } from '../../../src/context/ThemeContext'
import { apiGet, apiPatch, ApiError } from '../../../src/services/api'

// Sin `importActual`: eso carga services/api de verdad, que a su vez
// construye el cliente de Supabase y necesita las variables de entorno.
// Acá solo hace falta el contrato que usan las pantallas montadas.
vi.mock('../../../src/services/supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}))

vi.mock('../../../src/services/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiPostForm: vi.fn(),
  apiDelete: vi.fn(),
  getUserFriendlyApiMessage: (_status: number, fallback?: string) => fallback ?? 'Error',
  ApiError: class ApiError extends Error {
    status: number
    detail: unknown
    constructor(status: number, message: string, detail?: unknown) {
      super(message)
      this.status = status
      this.detail = detail
    }
  },
}))

const apiGetMock = vi.mocked(apiGet)
const apiPatchMock = vi.mocked(apiPatch)

const PERFIL_APRENDIZ = {
  idUsuario: 'u-aprendiz',
  nombre: 'Juan',
  email: 'juan@mail.com',
  estado: 'activo' as const,
  debeCambiarClave: false,
  fechaRegistro: '2026-09-24',
  roles: [{ idRol: 4, nombre: 'Aprendiz' }],
  especialidades: [],
}

const PERFIL_COORDINADOR = {
  ...PERFIL_APRENDIZ,
  idUsuario: 'u-coordinador',
  nombre: 'Ana',
  email: 'ana@mail.com',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
}

let sesionesCreadas = 0

function renderRuta(ruta: string) {
  sesionesCreadas += 1
  const auth = {
    session: { user: { id: `aprendiz-${sesionesCreadas}` } },
    loading: false,
    signOut: async () => {},
  } as AuthContextValue

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ThemeProvider>
        <AuthContext.Provider value={auth}>
          <AppRouter />
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

/**
 * H-5: hasta el 2026-09-23 ninguna ruta declaraba roles, así que un
 * Aprendiz que escribía `/horarios/asistente-ia` llegaba al formulario
 * entero y recién al pulsar "Continuar" recibía el "No autorizado" del
 * backend. Estas pruebas fijan la puerta cerrada: que la pantalla ajena
 * no se monte nunca.
 */
describe('AppRouter · roles por ruta', () => {
  it('un Aprendiz que escribe una ruta de coordinación acaba en su propia pantalla', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_APRENDIZ)
      if (path === '/notificaciones/') return Promise.resolve([])
      // Sin ficha vinculada: su home responde 404 en mi-ficha.
      return Promise.reject(new ApiError(404, 'No encontrado', null))
    })

    renderRuta('/horarios/asistente-ia')

    expect(await screen.findByRole('heading', { name: 'Mi jornada' })).toBeInTheDocument()
    expect(screen.queryByText('Asistente de Programación')).not.toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith(expect.stringContaining('/asistente'))
  })

  it('un Aprendiz no puede abrir la gestión de publicaciones programadas', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_APRENDIZ)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.reject(new ApiError(404, 'No encontrado', null))
    })

    renderRuta('/horarios/publicaciones-programadas')

    expect(await screen.findByRole('heading', { name: 'Mi jornada' })).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/publicaciones-programadas/')
  })

  it('un Aprendiz no puede abrir el directorio de fichas', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_APRENDIZ)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.reject(new ApiError(404, 'No encontrado', null))
    })

    renderRuta('/fichas')

    expect(await screen.findByRole('heading', { name: 'Mi jornada' })).toBeInTheDocument()
    expect(screen.queryByText('Directorio de Fichas de Caracterización')).not.toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/fichas/')
  })

  it('un Aprendiz tampoco alcanza el panel de administración', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_APRENDIZ)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.reject(new ApiError(404, 'No encontrado', null))
    })

    renderRuta('/panel-administracion')

    expect(await screen.findByRole('heading', { name: 'Mi jornada' })).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/solicitudes-acceso/')
  })

  // H-6: asignar y quitar roles exige Administrador en el backend, así que
  // un Coordinador que entraba a /usuarios veía los botones y recibía un
  // 403 al pulsarlos.
  it('un Coordinador no entra a /usuarios: repartir roles es del Administrador', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_COORDINADOR)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.resolve([])
    })

    renderRuta('/usuarios')

    // Acaba en su home de coordinación, no en la pantalla de usuarios.
    expect(await screen.findByText('Accesos de coordinación')).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/usuario-rol/asignar')
  })
})

/**
 * SCRUM-200/201 (Fase 3): /vista-fichas, /vista-instructores y
 * /vista-ambientes dejaron de ser pantallas propias -- redirigen a
 * `/horarios/completos` con la perspectiva y el id canónico equivalentes,
 * para no romper los links que ya apuntan a ellas (Instructores.tsx,
 * Ambientes.tsx) ni duplicar la pantalla que ya cubre las 4 perspectivas.
 */
describe('AppRouter · redirecciones legadas de Gestionar horarios', () => {
  const FICHA = {
    idFicha: 1, codigoFicha: '3228973 B', idPrograma: 1, idTrimestre: 1, idSede: null, sede: null,
    programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
    trimestre: { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
    aprendicesTotales: 30, jornadas: ['Mañana'],
  }
  const INSTRUCTOR = {
    idUsuario: 'u1', nombre: 'Erick Granados', email: 'erick@example.com', estado: 'activo', fechaRegistro: '2026-01-01',
    tipoContrato: 'Planta', roles: [{ idRol: 1, nombre: 'Instructor' }], especialidades: [], debeCambiarClave: false,
  }
  const AMBIENTE = { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Ambiente 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 }

  function mockeaCatalogos() {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_COORDINADOR)
      if (path === '/notificaciones/') return Promise.resolve([])
      if (path === '/horarios/') return Promise.resolve([])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([])
      if (path === '/trimestres/') return Promise.resolve([])
      if (path === '/dias-semana/') return Promise.resolve([])
      if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      return Promise.resolve([])
    })
  }

  it('/vista-fichas?id= redirige a Gestionar horarios en la perspectiva Por ficha, con la ficha seleccionada', async () => {
    mockeaCatalogos()
    renderRuta('/vista-fichas?id=1')

    expect(await screen.findByText('Gestionar horarios')).toBeInTheDocument()
    expect(screen.queryByText('Vista por fichas')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por ficha' })).toHaveClass('bg-primary')
    expect(await screen.findByLabelText('Seleccionar ficha')).toHaveValue('1')
  })

  it('/vista-instructores?id= redirige a Gestionar horarios en la perspectiva Por instructor, con el instructor seleccionado', async () => {
    mockeaCatalogos()
    renderRuta('/vista-instructores?id=u1')

    expect(await screen.findByText('Gestionar horarios')).toBeInTheDocument()
    expect(screen.queryByText('Vista por instructores')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por instructor' })).toHaveClass('bg-primary')
    expect(await screen.findByLabelText('Seleccionar instructor')).toHaveValue('u1')
  })

  it('/vista-ambientes?id= redirige a Gestionar horarios en la perspectiva Por ambiente, con el ambiente seleccionado', async () => {
    mockeaCatalogos()
    renderRuta('/vista-ambientes?id=1')

    expect(await screen.findByText('Gestionar horarios')).toBeInTheDocument()
    expect(screen.queryByText('Vista por ambientes')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Por ambiente' })).toHaveClass('bg-primary')
    expect(await screen.findByLabelText('Seleccionar ambiente')).toHaveValue('1')
  })
})

/**
 * SCRUM-204: "Pruebas de creación, filtros URL, cajón, conflictos,
 * publicación y rutas legadas" -- cada pieza ya tenía sus propias pruebas
 * aisladas (HorariosCompletos.test.tsx, NuevoHorario.test.tsx,
 * ModalCruce.test.tsx, y las redirecciones legadas de arriba), pero ninguna
 * probaba que funcionan juntas en una sola sesión real: entrar con un
 * filtro y un bloque ya abierto por URL, ver su conflicto real, resolverlo
 * publicando/despublicando, y cambiar de perspectiva sin perder ese
 * filtro. Esta prueba cierra esa brecha de regresión de flujo completo
 * (las rutas legadas en sí ya quedan cubiertas arriba, con sus propias 3
 * pruebas dedicadas).
 */
describe('AppRouter · regresión de flujo completo de Gestionar horarios (SCRUM-204)', () => {
  const FICHA = {
    idFicha: 1, codigoFicha: '3228973 B', idPrograma: 1, idTrimestre: 1, idSede: null, sede: null,
    programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
    trimestre: { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
    aprendicesTotales: 30, jornadas: ['Mañana'],
  }
  const INSTRUCTOR = {
    idUsuario: 'u1', nombre: 'Erick Granados', email: 'erick@example.com', estado: 'activo', fechaRegistro: '2026-01-01',
    tipoContrato: 'Planta', roles: [{ idRol: 1, nombre: 'Instructor' }], especialidades: [], debeCambiarClave: false,
  }
  const AMBIENTE = { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Ambiente 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 }
  const HORARIO = {
    idHorario: 7, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
    idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
    instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
    resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
  }

  it('filtro + bloque abiertos por URL, conflicto real visible, se resuelve publicando y la perspectiva cambia sin perder el filtro', async () => {
    let llamadasAuditoria = 0
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_COORDINADOR)
      if (path === '/notificaciones/') return Promise.resolve([])
      if (path === '/horarios/') return Promise.resolve([HORARIO])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([])
      if (path === '/trimestres/') return Promise.resolve([])
      if (path === '/dias-semana/') return Promise.resolve([])
      if (path === '/horarios/auditoria-cruces') {
        llamadasAuditoria += 1
        return Promise.resolve(
          llamadasAuditoria === 1
            ? { conflictos: [{ idHorario: 7, idHorarioExistente: null, tipo: 'regla_instructor', mensaje: 'Excede el tope de horas semanales.' }], resumen: { totalCruces: 1, tipos: ['regla_instructor'] } }
            : { conflictos: [], resumen: { totalCruces: 0, tipos: [] } },
        )
      }
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve({ idUsuario: 'u1', tipoContrato: 'Planta', horasAsignadas: 10, horasMaximas: 40 })
      return Promise.resolve([])
    })
    apiPatchMock.mockResolvedValue({ ...HORARIO, publicado: false })
    const usuario = userEvent.setup()

    // Filtros URL + cajón: llega con un texto de búsqueda y un bloque ya
    // abierto, como si viniera de un link compartido o de "volver atrás".
    renderRuta('/horarios/completos?q=Erick&idHorario=7')

    const drawer = await screen.findByRole('dialog', { name: 'Horario #7' })

    // Conflictos: el cruce real (no simulado) aparece en el cajón.
    await usuario.click(within(drawer).getByRole('tab', { name: 'Relaciones' }))
    expect(await screen.findByText('Excede el tope de horas semanales.')).toBeInTheDocument()

    // Publicación: resolver el conflicto despublicando desde el cajón.
    await usuario.click(within(drawer).getByRole('tab', { name: 'Publicación' }))
    await usuario.click(await screen.findByRole('button', { name: 'Despublicar' }))
    expect(apiPatchMock).toHaveBeenCalledWith('/horarios/7/estado', { publicado: false })

    // La auditoría real se vuelve a consultar sola -- el conflicto ya
    // resuelto deja de mostrarse sin recargar la pantalla.
    await usuario.click(within(drawer).getByRole('tab', { name: 'Relaciones' }))
    await waitFor(() => expect(screen.getByText('Validación de cruces superada.')).toBeInTheDocument())

    // Cambiar de perspectiva desde el cajón no descarta el filtro de texto
    // que ya estaba en la URL al entrar.
    await usuario.click(within(drawer).getByRole('link', { name: 'Ver horario por ficha →' }))

    expect(await screen.findByRole('button', { name: 'Por ficha' })).toHaveClass('bg-primary')
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', expect.stringContaining('q=Erick'))
  })
})
