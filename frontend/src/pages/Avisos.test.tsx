import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Avisos } from './Avisos'
import type { Aviso, Usuario } from '../types/api'

const APRENDIZ: Usuario = {
  idUsuario: 'a-1',
  nombre: 'Sara Rodríguez',
  email: 'sara@mail.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 4, nombre: 'Aprendiz' }],
  especialidades: [],
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
    publicadoPor: 'Ana Martínez',
    ...parcial,
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

function mockear(avisos: Aviso[]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/avisos/') return Promise.resolve(avisos)
    if (path === '/usuarios/me') return Promise.resolve(APRENDIZ)
    if (path === '/notificaciones/') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('Avisos', () => {
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
})
