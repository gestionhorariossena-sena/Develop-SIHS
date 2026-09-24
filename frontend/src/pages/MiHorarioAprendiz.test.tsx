import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { MiHorarioAprendiz } from './MiHorarioAprendiz'
import { ApiError } from '../services/api'
import type { Ficha, Horario } from '../types/api'

const FICHA: Ficha = {
  idFicha: 21, codigoFicha: '3171618', idPrograma: 1, idTrimestre: 1, idSede: 1,
  programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre 1 - 2026', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  sede: null,
  aprendicesTotales: 1,
  jornadas: ['Mañana'],
}

const HORARIO: Horario = {
  idHorario: 169, horaInicio: '11:00:00', horaFin: '13:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 21, idResultado: 1, dias: [4],
  fechaCreacion: '2026-09-14T11:00:00Z', fechaModificacion: '2026-09-14T11:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Instructor de Prueba', fichaCodigo: '3171618', ambienteNombre: 'Ambiente',
  resultadoCodigo: null, resultadoDescripcion: '01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO',
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
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

/** Aprendiz recién registrado: los dos endpoints propios responden 404. */
function sinFicha(path: string) {
  if (path === '/ficha-usuario/mi-ficha' || path === '/ficha-usuario/mi-horario') {
    return Promise.reject(new ApiError(404, 'No tienes una ficha vinculada'))
  }
  return Promise.reject(new Error('no mockeado en este test'))
}

describe('MiHorarioAprendiz', () => {
  // Los mocks son de módulo: sin esto, un test ve las llamadas del
  // anterior (y "no se llamó a apiPost" pasa a ser imposible de afirmar).
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carga la ficha vinculada y muestra el bloque publicado en el grid', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText('Ficha 3171618')).toBeInTheDocument()
    expect(screen.getByText('Análisis y Desarrollo de Software · Trimestre 1 - 2026')).toBeInTheDocument()
    expect(screen.getByText('01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO')).toBeInTheDocument()
  })

  it('sin ficha vinculada (404), ofrece el formulario para vincularla', async () => {
    apiGetMock.mockImplementation(sinFicha)
    renderConProviders(<MiHorarioAprendiz />)

    expect(await screen.findByText('Vincula tu ficha para ver tu horario')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de ficha')).toBeInTheDocument()
  })

  // H-1: el recorrido entero que antes no existía — escribir el código y
  // quedarse en la misma pantalla viendo el horario, sin que nadie toque
  // la base de datos.
  it('vincular con un código válido deja ver el horario sin salir de la pantalla', async () => {
    let yaVinculado = false
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') {
        return yaVinculado ? Promise.resolve(FICHA) : Promise.reject(new ApiError(404, 'No tienes una ficha vinculada'))
      }
      if (path === '/ficha-usuario/mi-horario') {
        return yaVinculado ? Promise.resolve([HORARIO]) : Promise.reject(new ApiError(404, 'No tienes una ficha vinculada'))
      }
      return Promise.reject(new Error('no mockeado en este test'))
    })
    apiPostMock.mockImplementation(() => {
      yaVinculado = true
      return Promise.resolve(FICHA)
    })

    const usuario = userEvent.setup()
    renderConProviders(<MiHorarioAprendiz />)

    await usuario.type(await screen.findByLabelText('Código de ficha'), '3171618')
    await usuario.click(screen.getByRole('button', { name: 'Vincular ficha' }))

    expect(apiPostMock).toHaveBeenCalledWith('/ficha-usuario/vincular', { codigoFicha: '3171618' })
    expect(await screen.findByText('Ficha 3171618')).toBeInTheDocument()
    expect(screen.getByText('01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código de ficha')).not.toBeInTheDocument()
  })

  it('un código inexistente explica qué hacer, no el texto crudo del backend', async () => {
    apiGetMock.mockImplementation(sinFicha)
    apiPostMock.mockRejectedValue(new ApiError(404, 'No existe una ficha con ese código'))

    const usuario = userEvent.setup()
    renderConProviders(<MiHorarioAprendiz />)

    await usuario.type(await screen.findByLabelText('Código de ficha'), '9999999')
    await usuario.click(screen.getByRole('button', { name: 'Vincular ficha' }))

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('No encontramos la ficha 9999999')
    expect(aviso).toHaveTextContent('pídele a tu coordinador que registre la ficha')
    expect(screen.queryByText('No existe una ficha con ese código')).not.toBeInTheDocument()
  })

  // Anotaciones personales (SCRUM-107): el backend existía sin pantalla.
  it('pulsar una clase abre el organizador y guarda la nota con su etiqueta', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
      if (path === '/anotaciones-horario/mias') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    apiPostMock.mockResolvedValue({
      idAnotacion: 3, idUsuario: 'a1', idHorario: 169, nota: 'Traer el modelo ER',
      etiqueta: 'Entrega', recordatorioActivo: true, fechaCreacion: '2026-09-24T10:00:00Z',
    })

    const usuario = userEvent.setup()
    renderConProviders(<MiHorarioAprendiz />)

    await usuario.click(await screen.findByText('01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO'))

    const organizador = await screen.findByRole('dialog')
    await usuario.type(screen.getByLabelText('Nota personal'), 'Traer el modelo ER')
    await usuario.click(within(organizador).getByText('Entrega'))
    await usuario.click(screen.getByLabelText(/Marcarla como pendiente/))
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }))

    expect(apiPostMock).toHaveBeenCalledWith('/anotaciones-horario/', {
      idHorario: 169,
      nota: 'Traer el modelo ER',
      etiqueta: 'Entrega',
      recordatorioActivo: true,
    })

    // Y queda pintada sobre la clase, sin recargar nada.
    expect(await screen.findByText(/Traer el modelo ER/)).toBeInTheDocument()
  })

  it('una anotación que ya existe se edita en vez de duplicarse', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
      if (path === '/anotaciones-horario/mias') {
        return Promise.resolve([
          {
            idAnotacion: 7, idUsuario: 'a1', idHorario: 169, nota: 'Repasar mocks',
            etiqueta: 'Examen', recordatorioActivo: false, fechaCreacion: '2026-09-20T10:00:00Z',
          },
        ])
      }
      return Promise.reject(new Error('no mockeado en este test'))
    })
    apiPutMock.mockResolvedValue({
      idAnotacion: 7, idUsuario: 'a1', idHorario: 169, nota: 'Repasar mocks y fixtures',
      etiqueta: 'Examen', recordatorioActivo: false, fechaCreacion: '2026-09-20T10:00:00Z',
    })

    const usuario = userEvent.setup()
    renderConProviders(<MiHorarioAprendiz />)

    // La nota existente se ve sobre la clase antes de tocar nada.
    expect(await screen.findByText(/Repasar mocks/)).toBeInTheDocument()

    await usuario.click(screen.getByText('01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO'))
    const campo = await screen.findByLabelText('Nota personal')
    expect(campo).toHaveValue('Repasar mocks')

    await usuario.type(campo, ' y fixtures')
    await usuario.click(screen.getByRole('button', { name: 'Guardar anotación' }))

    expect(apiPutMock).toHaveBeenCalledWith('/anotaciones-horario/7', {
      nota: 'Repasar mocks y fixtures',
      etiqueta: 'Examen',
      recordatorioActivo: false,
    })
    expect(apiPostMock).not.toHaveBeenCalled()
  })

  // El mockup promete "recordatorios de 30 minutos" y el backend no manda
  // nada: la pantalla no puede prometer una alarma que no existe.
  it('el recordatorio se ofrece como marca personal, sin prometer avisos', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([HORARIO])
      if (path === '/anotaciones-horario/mias') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado en este test'))
    })

    const usuario = userEvent.setup()
    renderConProviders(<MiHorarioAprendiz />)

    await usuario.click(await screen.findByText('01. INCORPORAR ACTIVIDADES DE ASEGURAMIENTO'))

    expect(
      await screen.findByText(/todavía no envía recordatorios por correo ni al celular/),
    ).toBeInTheDocument()
  })

  it('bloques no publicados (todavía en borrador) no se muestran', async () => {
    const sinPublicar: Horario = { ...HORARIO, idHorario: 170, publicado: false }
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/ficha-usuario/mi-ficha') return Promise.resolve(FICHA)
      if (path === '/ficha-usuario/mi-horario') return Promise.resolve([sinPublicar])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<MiHorarioAprendiz />)

    await screen.findByText('Ficha 3171618')
    expect(screen.getByText('Tu ficha todavía no tiene horarios publicados.')).toBeInTheDocument()
  })
})
