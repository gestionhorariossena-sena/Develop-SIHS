import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Tematicas } from './Tematicas'
import type { TematicaCompetencia, Usuario } from '../types/api'

const TEMATICAS: TematicaCompetencia[] = [
  {
    idCompetencia: 1,
    codigo: '220501',
    descripcion: 'Programar software',
    idPrograma: 7,
    nombrePrograma: 'ADSO',
    especialidades: [],
    totalHoras: 60,
    resultados: [
      { idResultado: 10, codigo: 'RA-1', descripcion: 'Codificar módulos', horasAsignadas: 40, numeroFase: 1, idGuia: 3, horariosAsignados: 2 },
      { idResultado: 11, codigo: 'RA-2', descripcion: 'Probar el software', horasAsignadas: 20, numeroFase: 2, idGuia: null, horariosAsignados: 0 },
    ],
  },
  {
    idCompetencia: 2,
    codigo: '240201',
    descripcion: 'Comunicación',
    idPrograma: 7,
    nombrePrograma: 'ADSO',
    especialidades: [],
    totalHoras: 0,
    resultados: [],
  },
]

function perfil(rol: string): Usuario {
  return {
    idUsuario: 'u1',
    nombre: 'Persona',
    email: 'p@sena.edu.co',
    estado: 'activo',
    fechaRegistro: '2026-01-01T00:00:00Z',
    roles: [{ idRol: 1, nombre: rol }],
  } as Usuario
}

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  ApiError: class ApiError extends Error {
    constructor(_status: number, mensaje: string) {
      super(mensaje)
    }
  },
}))

function mockear(rol = 'Administrador') {
  apiGetMock.mockImplementation((path: string) => {
    if (path.startsWith('/tematicas/')) return Promise.resolve(TEMATICAS)
    if (path === '/programas/') return Promise.resolve([{ idPrograma: 7, codigoPrograma: 'P7', nombrePrograma: 'ADSO', nivelFormacion: null, activo: true, idCoordinacion: 1 }])
    if (path === '/usuarios/me') return Promise.resolve(perfil(rol))
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.reject(new Error(`no mockeado: ${path}`))
  })
}

describe('Tematicas', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
  })

  it('lista competencias con su resumen y despliega los resultados', async () => {
    mockear()
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)

    expect(await screen.findByText('220501 · Programar software')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/tematicas/')
    expect(screen.getByText('Resultados sin programar').nextSibling).toHaveTextContent('1')
    expect(screen.queryByText('Codificar módulos')).not.toBeInTheDocument()

    await usuario.click(screen.getByText('220501 · Programar software'))

    expect(screen.getByText('Codificar módulos')).toBeInTheDocument()
    expect(screen.getByText('Probar el software')).toBeInTheDocument()
  })

  it('filtrar por programa vuelve a pedir al backend con id_programa', async () => {
    mockear()
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await screen.findByText('220501 · Programar software')

    await usuario.selectOptions(screen.getByLabelText('Programa'), '7')

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/tematicas/?id_programa=7'))
  })

  it('no deja borrar un resultado usado en horarios ni una competencia con resultados', async () => {
    mockear()
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await usuario.click(await screen.findByText('220501 · Programar software'))

    expect(screen.getByRole('button', { name: 'Eliminar resultado Codificar módulos' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar competencia Programar software' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar competencia Comunicación' })).toBeEnabled()
  })

  it('elimina un resultado libre y recarga', async () => {
    mockear()
    apiDeleteMock.mockResolvedValue({ mensaje: 'ok' })
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await usuario.click(await screen.findByText('220501 · Programar software'))

    await usuario.click(screen.getByRole('button', { name: 'Eliminar resultado Probar el software' }))

    expect(apiDeleteMock).toHaveBeenCalledWith('/resultados-aprendizaje/11')
    await waitFor(() => expect(apiGetMock.mock.calls.filter(([p]) => p === '/tematicas/').length).toBeGreaterThan(1))
  })

  it('editar un resultado conserva su guía', async () => {
    mockear()
    apiPutMock.mockResolvedValue({})
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await usuario.click(await screen.findByText('220501 · Programar software'))

    await usuario.click(screen.getByRole('button', { name: 'Editar resultado Codificar módulos' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(apiPutMock).toHaveBeenCalledWith('/resultados-aprendizaje/10', {
      codigo: 'RA-1',
      descripcion: 'Codificar módulos',
      idCompetencia: 1,
      horasAsignadas: 40,
      numeroFase: 1,
      idGuia: 3,
    })
  })

  it('un coordinador ve las temáticas pero no las acciones de edición', async () => {
    mockear('Coordinador')
    renderConProviders(<Tematicas />)
    await screen.findByText('220501 · Programar software')

    expect(screen.queryByRole('button', { name: 'Nueva competencia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar resultado' })).not.toBeInTheDocument()
  })

  it('muestra el motivo si el backend rechaza el borrado', async () => {
    mockear()
    const { ApiError } = await import('../services/api')
    apiDeleteMock.mockRejectedValue(new ApiError(409, 'La competencia tiene 1 resultado(s) de aprendizaje.', null))
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await screen.findByText('240201 · Comunicación')

    await usuario.click(screen.getByRole('button', { name: 'Eliminar competencia Comunicación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La competencia tiene 1 resultado(s) de aprendizaje.')
  })
})
