import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { fechaLocalISO } from '../../../src/utils/trimestreVigente'
import { AsistenteHorarios } from '../../../src/pages/AsistenteHorarios'
import type { BloquePropuesto, HorarioDryRunResponse, ImportarExcelPreviewResponse, Trimestre, Usuario } from '../../../src/types/api'

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
vi.mock('../../../src/services/api', () => ({
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
    const { ApiError } = await import('../../../src/services/api')
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

/**
 * SCRUM-202: "no debe presentarse una propuesta simulada como si estuviera
 * guardada" y "los errores de configuración deben explicarse claramente".
 * El resto del wizard (subir -> revisar -> propuesta) ya estaba probado
 * arriba solo como contexto para la pregunta a la IA; acá se prueba el
 * principio central del asistente: nada toca la base de datos hasta el
 * paso 4, y un error de servidor no se vuelve un mensaje genérico.
 */
describe('AsistenteHorarios — E2E confirmar y guardar', () => {
  const BLOQUE: BloquePropuesto = {
    idFicha: 1, fichaCodigo: '3171618', idResultado: 9, resultadoDescripcion: 'Programación básica',
    idInstructor: 'u1', instructorNombre: 'Erick Granados', idAmbiente: 1, ambienteNombre: 'Ambiente 101',
    idJornada: 1, dias: [1], horaInicio: '06:15:00', horaFin: '09:00:00',
  }
  const SIN_CRUCES: HorarioDryRunResponse = { ok: true, puedeGuardar: true, mensaje: '', conflictos: [], resumen: { totalCruces: 0, tipos: [] } }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockearRedConPropuesta() {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/usuarios/me') return Promise.resolve(COORDINADOR)
      if (path === '/horarios/') return Promise.resolve([])
      return Promise.resolve([])
    })
    apiPostFormMock.mockResolvedValue(PREVISUALIZACION)
    apiPostMock.mockImplementation((path: string) => {
      if (path === '/horarios/asistente/generar-propuesta') {
        return Promise.resolve({ bloques: [BLOQUE], factible: true, mensaje: '', fichasSinProgramar: [] })
      }
      if (path === '/horarios/validar') return Promise.resolve(SIN_CRUCES)
      if (path === '/horarios/') return Promise.resolve({ idHorario: 99, ...BLOQUE, idTrimestre: 1, publicado: false })
      return Promise.resolve({})
    })
  }

  async function llegarAlPaso3ConPropuesta(usuario: ReturnType<typeof userEvent.setup>) {
    renderConProviders(<AsistenteHorarios />)
    const archivo = new File(['x'], 'planeacion.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await usuario.upload(await screen.findByLabelText('Seleccionar archivo Excel'), archivo)
    const continuar = screen.getByRole('button', { name: 'Continuar' })
    await waitFor(() => expect(continuar).toBeEnabled())
    await usuario.click(continuar)
    await usuario.click(await screen.findByRole('button', { name: /Continuar con 1 ficha/ }))
    await screen.findByText('Sin cruces ✓')
  }

  it('la propuesta queda en pantalla sin guardarse hasta que se confirma explícitamente en el paso 4', async () => {
    mockearRedConPropuesta()
    const usuario = userEvent.setup()
    await llegarAlPaso3ConPropuesta(usuario)

    // El aviso de "es un borrador, nada se guarda" sigue visible en el
    // mismo paso donde ya se ve la propuesta completa.
    expect(screen.getByText(/Nada se guardará en el sistema hasta que tú lo apruebes en el paso final/)).toBeInTheDocument()
    expect(apiPostMock).not.toHaveBeenCalledWith('/horarios/', expect.anything(), expect.anything())

    await usuario.click(screen.getByRole('button', { name: 'Todo se ve bien, ir a confirmar →' }))

    // Paso 4: todavía no se guardó nada -- es la última confirmación, no
    // una consecuencia automática de haber llegado hasta acá.
    expect(screen.getByText(/quedarán como borradores privados para revisión/)).toBeInTheDocument()
    expect(apiPostMock).not.toHaveBeenCalledWith('/horarios/', expect.anything())

    await usuario.click(screen.getByRole('button', { name: 'Confirmar y guardar en BD' }))

    await waitFor(() => expect(screen.getByText('Guardado ✓')).toBeInTheDocument())
    expect(apiPostMock).toHaveBeenCalledWith('/horarios/', expect.objectContaining({ idFicha: 1, publicado: false }))
    expect(await screen.findByText(/todo se guardó como borrador/)).toBeInTheDocument()
  })

  it('un error de configuración del servidor al generar la propuesta se explica claramente, no con un mensaje genérico', async () => {
    const { ApiError } = await import('../../../src/services/api')
    const MENSAJE_CONFIGURACION = 'El asistente con IA no está disponible: falta configurarlo en el servidor. El resto de la programación funciona igual — avisa al administrador del sistema.'
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/usuarios/me') return Promise.resolve(COORDINADOR)
      return Promise.resolve([])
    })
    apiPostFormMock.mockResolvedValue(PREVISUALIZACION)
    apiPostMock.mockImplementation((path: string) =>
      path === '/horarios/asistente/generar-propuesta'
        ? Promise.reject(new ApiError(503, MENSAJE_CONFIGURACION))
        : Promise.resolve({}),
    )
    const usuario = userEvent.setup()
    renderConProviders(<AsistenteHorarios />)
    const archivo = new File(['x'], 'planeacion.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await usuario.upload(await screen.findByLabelText('Seleccionar archivo Excel'), archivo)
    const continuar = screen.getByRole('button', { name: 'Continuar' })
    await waitFor(() => expect(continuar).toBeEnabled())
    await usuario.click(continuar)

    await usuario.click(await screen.findByRole('button', { name: /Continuar con 1 ficha/ }))

    expect(await screen.findByText(MENSAJE_CONFIGURACION)).toBeInTheDocument()
    expect(screen.queryByText('No se pudo generar la propuesta.')).not.toBeInTheDocument()
  })
})
