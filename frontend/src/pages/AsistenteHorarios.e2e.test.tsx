import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { fechaLocalISO } from '../utils/trimestreVigente'
import { AsistenteHorarios } from './AsistenteHorarios'
import type { ImportarExcelPreviewResponse, Trimestre, Usuario } from '../types/api'

/**
 * E2E semana 1: el coordinador recorre el asistente (subir Excel -> fichas
 * listas -> paso 3) y le pregunta algo a la IA; la respuesta de Gemini
 * tiene que quedar visible en pantalla. Se corre el flujo real del
 * componente; solo la red está simulada, para que el test no dependa de la
 * IA en vivo (esa corrida real vive en backend/tests/test_e2e_asistente_gemini.py).
 */

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPostFormMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPatch: vi.fn(),
  apiPostForm: (...args: unknown[]) => apiPostFormMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

// Vigente hoy, sea cuando sea que corra el test.
const TRIMESTRE: Trimestre = {
  idTrimestre: 1,
  nombre: 'Vigente',
  fechaInicio: '2000-01-01',
  fechaFin: '2999-12-31',
  estado: 'activo',
}

const PREVISUALIZACION: ImportarExcelPreviewResponse = {
  nombreArchivo: 'planeacion.xlsx',
  hoja: 'Hoja1',
  filaEncabezado: 1,
  columnas: [{ columnaOriginal: 'FICHA', campo: 'ficha', confianza: 1 }],
  filas: [
    {
      fila: 2, codigoFicha: '3171618', fichaExiste: true, idFicha: 1, programa: 'ADSO', jornada: 'MAÑANA',
      instructorNombre: null, advertencia: null, nivelFormacion: null, coordinacion: null, codigoPrograma: null,
      fechaInicioLectiva: null, fechaFinLectiva: null, fechaFinProductiva: null, faseActual: null, faseActualEnBD: null,
    },
  ],
  totalFilas: 1,
  filasConAdvertencia: 0,
  advertenciaGeneral: null,
  archivoComplementario: null,
  hojaComplementaria: null,
}

const COORDINADOR: Usuario = {
  idUsuario: 'c-1',
  nombre: 'Laura Gómez',
  email: 'laura@mail.com',
  estado: 'activo',
  debeCambiarClave: false,
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
  especialidades: [],
}

const RESPUESTA_IA = 'La ficha 3171618 no se programó porque el instructor ya tiene clase a esa hora.'

function mockearRed(preguntar: () => Promise<unknown>) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
    if (path === '/usuarios/me') return Promise.resolve(COORDINADOR)
    return Promise.resolve([])
  })
  apiPostFormMock.mockResolvedValue(PREVISUALIZACION)
  apiPostMock.mockImplementation((path: string) => {
    if (path === '/horarios/asistente/generar-propuesta') {
      return Promise.resolve({ bloques: [], factible: false, mensaje: 'Sin bloques.', fichasSinProgramar: [] })
    }
    if (path === '/horarios/asistente/preguntar') return preguntar()
    return Promise.resolve({})
  })
}

async function llegarAlPaso3(usuario: ReturnType<typeof userEvent.setup>) {
  renderConProviders(<AsistenteHorarios />)

  const archivo = new File(['x'], 'planeacion.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  await usuario.upload(await screen.findByLabelText('Seleccionar archivo Excel'), archivo)
  const continuar = screen.getByRole('button', { name: 'Continuar' })
  await waitFor(() => expect(continuar).toBeEnabled())
  await usuario.click(continuar)

  await usuario.click(await screen.findByRole('button', { name: /Continuar con 1 ficha/ }))
  return screen.findByPlaceholderText(/por qué esta ficha no se pudo programar/)
}

describe('AsistenteHorarios — E2E pregunta a la IA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mismo criterio que el resto de la suite: la fecha de hoy no importa
    // porque el período del test cubre cualquier fecha.
    expect(fechaLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('la respuesta de la IA queda visible tras preguntar en el paso 3', async () => {
    mockearRed(() => Promise.resolve({ respuesta: RESPUESTA_IA }))
    const usuario = userEvent.setup()
    const caja = await llegarAlPaso3(usuario)

    await usuario.type(caja, '¿por qué no se programó esta ficha?')
    await usuario.click(screen.getByRole('button', { name: 'Preguntar' }))

    expect(await screen.findByText(RESPUESTA_IA)).toBeInTheDocument()
    expect(apiPostMock).toHaveBeenCalledWith(
      '/horarios/asistente/preguntar',
      { pregunta: '¿por qué no se programó esta ficha?', contexto: expect.stringContaining('Propuesta con 0 bloques') },
      expect.anything(),
    )
  })

  it('mientras la IA responde el botón avisa y se bloquea', async () => {
    let resolver: (valor: unknown) => void = () => {}
    mockearRed(() => new Promise((res) => { resolver = res }))
    const usuario = userEvent.setup()
    const caja = await llegarAlPaso3(usuario)

    await usuario.type(caja, 'hola')
    await usuario.click(screen.getByRole('button', { name: 'Preguntar' }))

    expect(await screen.findByRole('button', { name: 'Preguntando…' })).toBeDisabled()

    resolver({ respuesta: RESPUESTA_IA })
    expect(await screen.findByText(RESPUESTA_IA)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preguntar' })).toBeEnabled()
  })

  it('si la IA falla muestra el mensaje de error en lugar de quedarse en blanco', async () => {
    const { ApiError } = await import('../services/api')
    mockearRed(() => Promise.reject(new ApiError(503, 'La IA no está disponible ahora mismo.')))
    const usuario = userEvent.setup()
    const caja = await llegarAlPaso3(usuario)

    await usuario.type(caja, 'hola')
    await usuario.click(screen.getByRole('button', { name: 'Preguntar' }))

    expect(await screen.findByText('La IA no está disponible ahora mismo.')).toBeInTheDocument()
  })

  it('no deja preguntar con la caja vacía', async () => {
    mockearRed(() => Promise.resolve({ respuesta: RESPUESTA_IA }))
    const usuario = userEvent.setup()
    await llegarAlPaso3(usuario)

    expect(screen.getByRole('button', { name: 'Preguntar' })).toBeDisabled()
    expect(apiPostMock).not.toHaveBeenCalledWith('/horarios/asistente/preguntar', expect.anything(), expect.anything())
  })
})
