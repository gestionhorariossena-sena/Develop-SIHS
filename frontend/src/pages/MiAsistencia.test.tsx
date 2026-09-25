import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { MiAsistencia } from './MiAsistencia'
import type { AsistenciaDeAprendiz, MiAsistencia as Datos, Usuario } from '../types/api'

const APRENDIZ: Usuario = {
  idUsuario: 'a-1',
  nombre: 'Sara Rodríguez',
  email: 'sara@mail.com',
  estado: 'activo',
  debeCambiarClave: false,
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 4, nombre: 'Aprendiz' }],
  especialidades: [],
}

function sesion(overrides: Partial<AsistenciaDeAprendiz> = {}): AsistenciaDeAprendiz {
  return {
    idAsistencia: 1,
    idHorario: 100,
    fechaSesion: '2026-09-22',
    estado: 'presente',
    referenciaExcusa: null,
    resultadoDescripcion: 'Arquitectura de software',
    instructorNombre: 'Carlos Díaz',
    ambienteNombre: 'Laboratorio 302',
    horaInicio: '11:00:00',
    horaFin: '13:00:00',
    ...overrides,
  }
}

function datos(overrides: Partial<Datos> = {}): Datos {
  return {
    resumen: { registradas: 4, presente: 3, tardanza: 1, excusa: 0, ausente: 0, porcentaje: 100 },
    sesiones: [sesion()],
    ...overrides,
  }
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

function mockear(respuesta: Datos) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/asistencias/mias') return Promise.resolve(respuesta)
    if (path === '/usuarios/me') return Promise.resolve(APRENDIZ)
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('MiAsistencia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el porcentaje y el detalle de cada sesión', async () => {
    mockear(datos())
    renderConProviders(<MiAsistencia />)

    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Arquitectura de software')).toBeInTheDocument()
    expect(screen.getByText(/Carlos Díaz · 11:00 - 13:00 · Laboratorio 302/)).toBeInTheDocument()
  })

  // Es de solo lectura: la asistencia la certifica el instructor, y
  // cualquier control de edición acá daría 403.
  it('no ofrece ningún control para editar, justificar ni reclamar', async () => {
    mockear(datos())
    renderConProviders(<MiAsistencia />)

    await screen.findByText('Arquitectura de software')

    expect(screen.queryByRole('button', { name: /justificar|reclamar|editar|subir/i })).not.toBeInTheDocument()
    expect(screen.getByText('Solo lectura')).toBeInTheDocument()
  })

  it('bajo el 85% avisa, porque es el umbral del reglamento', async () => {
    mockear(datos({ resumen: { registradas: 10, presente: 7, tardanza: 0, excusa: 0, ausente: 3, porcentaje: 70 } }))
    renderConProviders(<MiAsistencia />)

    expect(await screen.findByText(/por debajo del 85%/)).toBeInTheDocument()
  })

  it('con buena asistencia no muestra la advertencia', async () => {
    mockear(datos())
    renderConProviders(<MiAsistencia />)

    await screen.findByText('100%')
    expect(screen.queryByText(/por debajo del 85%/)).not.toBeInTheDocument()
  })

  it('filtra por estado sin volver a pedirle nada al backend', async () => {
    mockear(
      datos({
        sesiones: [
          sesion({ idAsistencia: 1, estado: 'presente', resultadoDescripcion: 'Arquitectura de software' }),
          sesion({ idAsistencia: 2, estado: 'ausente', resultadoDescripcion: 'Bases de datos' }),
        ],
      }),
    )
    const usuario = userEvent.setup()
    renderConProviders(<MiAsistencia />)

    await screen.findByText('Bases de datos')
    apiGetMock.mockClear()

    await usuario.click(screen.getByRole('button', { name: 'Ausente (1)' }))

    expect(screen.getByText('Bases de datos')).toBeInTheDocument()
    expect(screen.queryByText('Arquitectura de software')).not.toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/asistencias/mias')
  })

  it('la excusa muestra su referencia', async () => {
    mockear(datos({ sesiones: [sesion({ estado: 'excusa', referenciaExcusa: 'RAD-2026-0918-MED-02' })] }))
    renderConProviders(<MiAsistencia />)

    expect(await screen.findByText(/RAD-2026-0918-MED-02/)).toBeInTheDocument()
  })

  it('sin registros explica que aparece cuando el instructor la registre', async () => {
    mockear({ resumen: { registradas: 0, presente: 0, tardanza: 0, excusa: 0, ausente: 0, porcentaje: 100 }, sesiones: [] })
    renderConProviders(<MiAsistencia />)

    expect(await screen.findByText('Todavía no hay asistencia registrada en tus clases')).toBeInTheDocument()
  })
})
