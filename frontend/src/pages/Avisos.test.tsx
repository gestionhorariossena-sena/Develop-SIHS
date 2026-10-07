import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Avisos } from './Avisos'
import type { Aviso, Ficha, Sede, Usuario } from '../types/api'

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

const COORDINADOR: Usuario = {
  ...APRENDIZ,
  idUsuario: 'c-1',
  nombre: 'Ana Martínez',
  email: 'ana@mail.com',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
}

const FICHA: Ficha = {
  idFicha: 21,
  codigoFicha: '3171618',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: 1,
  programa: {
    idPrograma: 1,
    codigoPrograma: 'PROG-1',
    nombrePrograma: 'Programa',
    nivelFormacion: null,
    activo: true,
    idCoordinacion: 1,
  },
  trimestre: {
    idTrimestre: 1,
    nombre: '2026-1',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-04-01',
    estado: 'activo',
  },
  sede: null,
  aprendicesTotales: 1,
  jornadas: [],
}

const SEDE: Sede = {
  idSede: 1,
  nombreSede: 'Sede Norte',
  direccion: null,
  tipoSede: 'principal',
}

function aviso(parcial: Partial<Aviso> = {}): Aviso {
  return {
    idAviso: 1,
    idUsuarioPublicador: 'c-1',
    titulo: 'Reprogramación de la jornada del viernes',
    cuerpo: 'La jornada presencial del viernes se traslada al lunes por encuentro pedagógico.',
    categoria: 'reprog',
    idFicha: null,
    idSede: null,
    adjuntoUrl: null,
    fechaPublicacion: new Date(Date.now() - 3 * 3600_000).toISOString(),
    vigenteHasta: null,
    fichaCodigo: null,
    sedeNombre: null,
    publicadorNombre: 'Ana Martínez',
    ...parcial,
  }
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

function mockear(avisos: Aviso[], usuario: Usuario = APRENDIZ) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/avisos/') return Promise.resolve(avisos)
    if (path === '/usuarios/me') return Promise.resolve(usuario)
    if (path === '/fichas/') return Promise.resolve([FICHA])
    if (path === '/sedes') return Promise.resolve([SEDE])
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('Avisos', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('muestra el comunicado con su categoría, destinatario y quién lo publicó', async () => {
    mockear([aviso()])
    renderConProviders(<Avisos />)

    expect(await screen.findByText('Reprogramación de la jornada del viernes')).toBeInTheDocument()
    expect(screen.getByText('Reprogramación')).toBeInTheDocument()
    // Sin ficha ni sede, el aviso es del centro entero.
    expect(screen.getByText('Todo el centro')).toBeInTheDocument()
    expect(screen.getByText('Publicado por Ana Martínez')).toBeInTheDocument()
    expect(screen.getByText('hace 3 horas')).toBeInTheDocument()
  })

  // El backend resuelve el código de ficha porque un Aprendiz no tiene
  // permiso sobre /fichas/ para hacerlo por su cuenta.
  it('un aviso dirigido a una ficha muestra su código, no el id', async () => {
    mockear([aviso({ idFicha: 21, fichaCodigo: '3171618' })])
    renderConProviders(<Avisos />)

    expect(await screen.findByText('Ficha 3171618')).toBeInTheDocument()
    expect(screen.queryByText('Ficha 21')).not.toBeInTheDocument()
  })

  it('filtra por categoría sin volver a pedirle nada al backend', async () => {
    mockear([
      aviso({ idAviso: 1, titulo: 'Se reprograma el viernes', categoria: 'reprog' }),
      aviso({ idAviso: 2, titulo: 'Semana de la innovación', categoria: 'eventos' }),
    ])
    const usuario = userEvent.setup()
    renderConProviders(<Avisos />)

    await screen.findByText('Se reprograma el viernes')
    apiGetMock.mockClear()

    await usuario.click(screen.getByRole('button', { name: /Eventos y convocatorias/ }))

    expect(screen.getByText('Semana de la innovación')).toBeInTheDocument()
    expect(screen.queryByText('Se reprograma el viernes')).not.toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/avisos/')
  })

  it('un aviso con la vigencia pasada se marca como vencido, no se esconde', async () => {
    mockear([aviso({ vigenteHasta: '2026-01-31' })])
    renderConProviders(<Avisos />)

    expect(await screen.findByText('Vencido')).toBeInTheDocument()
    expect(screen.getByText('Reprogramación de la jornada del viernes')).toBeInTheDocument()
  })

  it('el adjunto se ofrece como enlace, porque el backend solo guarda una URL', async () => {
    mockear([aviso({ adjuntoUrl: 'https://sena.edu.co/circular-089.pdf' })])
    renderConProviders(<Avisos />)

    const enlace = await screen.findByRole('link', { name: /Ver documento adjunto/ })
    expect(enlace).toHaveAttribute('href', 'https://sena.edu.co/circular-089.pdf')
  })

  it('sin comunicados explica qué va a aparecer, en vez de dejar la pantalla en blanco', async () => {
    mockear([])
    renderConProviders(<Avisos />)

    expect(await screen.findByText('Todavía no hay comunicados publicados')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar comunicado' })).not.toBeInTheDocument()
  })

  it('el más reciente va destacado arriba y el resto en la lista', async () => {
    mockear([
      aviso({ idAviso: 9, titulo: 'El más reciente' }),
      aviso({ idAviso: 8, titulo: 'Uno anterior' }),
    ])
    renderConProviders(<Avisos />)

    const destacado = (await screen.findByText('El más reciente')).closest('article')!
    expect(within(destacado).getByText('El más reciente')).toBeInTheDocument()
    expect(screen.getByText('Uno anterior').closest('li')).not.toBeNull()
  })

  it('permite al coordinador publicar un comunicado con audiencia', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/avisos/') return Promise.resolve([])
      if (path === '/usuarios/me') return Promise.resolve(COORDINADOR)
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.resolve([])
    })
    const nuevo = aviso({ idAviso: 2, titulo: 'Cambio de aula', idFicha: 21 })
    apiPostMock.mockResolvedValue(nuevo)
    const usuario = userEvent.setup()
    renderConProviders(<Avisos />)

    await usuario.click(await screen.findByRole('button', { name: 'Publicar comunicado' }))
    await usuario.type(screen.getByLabelText('Título'), 'Cambio de aula')
    await usuario.selectOptions(screen.getByLabelText('Categoría'), 'reprog')
    await usuario.type(screen.getByLabelText('Contenido'), 'La clase se traslada al laboratorio.')
    await usuario.selectOptions(screen.getByLabelText('Dirigido a una ficha'), '21')
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }))

    expect(apiPostMock).toHaveBeenCalledWith('/avisos/', {
      titulo: 'Cambio de aula',
      cuerpo: 'La clase se traslada al laboratorio.',
      categoria: 'reprog',
      idFicha: 21,
      idSede: null,
      adjuntoUrl: null,
      vigenteHasta: null,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Comunicado publicado')
    expect(screen.getByText('Cambio de aula')).toBeInTheDocument()
  })

  it('permite editar un comunicado existente', async () => {
    mockear([aviso()], COORDINADOR)
    apiPutMock.mockResolvedValue(aviso({ titulo: 'Título actualizado' }))
    const usuario = userEvent.setup()
    renderConProviders(<Avisos />)

    await usuario.click(await screen.findByRole('button', { name: 'Editar' }))
    await usuario.clear(screen.getByLabelText('Título'))
    await usuario.type(screen.getByLabelText('Título'), 'Título actualizado')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(apiPutMock).toHaveBeenCalledWith('/avisos/1', expect.objectContaining({ titulo: 'Título actualizado' }))
  })

  it('confirma y ejecuta la eliminación en el backend', async () => {
    mockear([aviso()], COORDINADOR)
    apiDeleteMock.mockResolvedValue({ mensaje: 'Aviso eliminado' })
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const usuario = userEvent.setup()
    renderConProviders(<Avisos />)

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar' }))

    expect(confirmacion).toHaveBeenCalledWith(`¿Eliminar el comunicado "${aviso().titulo}"?`)
    expect(apiDeleteMock).toHaveBeenCalledWith('/avisos/1')
    expect(await screen.findByText('Todavía no hay comunicados publicados')).toBeInTheDocument()
    confirmacion.mockRestore()
  })
})
