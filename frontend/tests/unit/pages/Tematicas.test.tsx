import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { Tematicas } from '../../../src/pages/Tematicas'
import type { TematicaCompetencia, Usuario } from '../../../src/types/api'

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
const apiPostFormMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPostForm: (...args: unknown[]) => apiPostFormMock(...args),
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
    apiPostFormMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
  })

  it('abre el currículo filtrado al llegar desde un programa', async () => {
    mockear()
    renderConProviders(<Tematicas />, ['/tematicas?idPrograma=7'])
    expect(await screen.findByRole('combobox', { name: 'Programa' })).toHaveValue('7')
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/tematicas/?id_programa=7'))
  })

  it('lista competencias con su resumen y despliega los resultados', async () => {
    mockear()
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)

    expect(await screen.findByText('220501 · Programar software')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/tematicas/')
    expect(screen.getByText('Resultados sin programar').parentElement?.nextElementSibling).toHaveTextContent('1')
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

  it('permite importar el Excel curricular desde Temáticas sin duplicar lo existente', async () => {
    mockear()
    apiPostFormMock.mockResolvedValue({
      nombreArchivo: '04_curriculo_programa_DEMO_ADSO.xlsx', hoja: 'TRIM I',
      totalCompetencias: 1, totalResultados: 2,
      competencias: [{
        descripcion: 'Programar software',
        resultados: [
          { descripcion: 'Codificar módulos', horasAsignadas: 40, numeroFase: 1 },
          { descripcion: 'Resultado nuevo', horasAsignadas: 20, numeroFase: 1 },
        ],
      }],
    })
    apiPostMock.mockResolvedValue({ idResultado: 21 })
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await screen.findByText('220501 · Programar software')
    await usuario.click(screen.getByRole('button', { name: 'Carga masiva' }))
    await usuario.selectOptions(screen.getByLabelText('Programa para importar temáticas'), '7')
    await usuario.upload(screen.getByLabelText('Archivo Excel de temáticas'), new File(['excel'], '04_curriculo_programa_DEMO_ADSO.xlsx'))
    expect(await screen.findByText(/1 competencias y 2 resultados detectados/)).toBeInTheDocument()
    expect(apiPostMock).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar carga masiva' }))
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1))
    expect(apiPostMock).toHaveBeenCalledWith('/resultados-aprendizaje/', expect.objectContaining({
      idCompetencia: 1, descripcion: 'Resultado nuevo', numeroFase: 1,
    }))
    expect(apiPostMock).not.toHaveBeenCalledWith('/competencias-formacion/', expect.anything())
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
    const { ApiError } = await import('../../../src/services/api')
    apiDeleteMock.mockRejectedValue(new ApiError(409, 'La competencia tiene 1 resultado(s) de aprendizaje.', null))
    const usuario = userEvent.setup()
    renderConProviders(<Tematicas />)
    await screen.findByText('240201 · Comunicación')

    await usuario.click(screen.getByRole('button', { name: 'Eliminar competencia Comunicación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La competencia tiene 1 resultado(s) de aprendizaje.')
  })
})
