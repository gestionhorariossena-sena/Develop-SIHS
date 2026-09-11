import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Avisos } from './Avisos'
import type { Aviso } from '../types/api'

const AVISOS: Aviso[] = [
  {
    idAviso: 1,
    idUsuarioPublicador: 'u1',
    publicadorNombre: 'Ing. Maritza Benítez',
    titulo: 'Reprogramación jornada del viernes',
    cuerpo: 'Las sesiones presenciales del viernes pasan a modalidad virtual.',
    categoria: 'extraordinario',
    idFicha: null,
    idSede: null,
    adjuntoUrl: 'https://example.com/circular.pdf',
    fechaPublicacion: '2026-05-27T08:30:00Z',
    vigenteHasta: null,
  },
  {
    idAviso: 2,
    idUsuarioPublicador: 'u2',
    publicadorNombre: 'Coord. Mónica Peláez',
    titulo: 'Sesión de Metodologías Ágiles cancelada',
    cuerpo: 'La clase del jueves con la Instructora Diana López queda suspendida.',
    categoria: 'reprog',
    idFicha: 10,
    idSede: null,
    adjuntoUrl: null,
    fechaPublicacion: '2026-05-26T16:40:00Z',
    vigenteHasta: null,
  },
  {
    idAviso: 3,
    idUsuarioPublicador: 'u2',
    publicadorNombre: 'Coord. Mónica Peláez',
    titulo: 'Feria de Empleabilidad SENA Tech 2025',
    cuerpo: 'Convocatoria abierta para stands de exhibición de proyectos formativos.',
    categoria: 'eventos',
    idFicha: null,
    idSede: null,
    adjuntoUrl: null,
    fechaPublicacion: '2026-05-24T09:00:00Z',
    vigenteHasta: null,
  },
]

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

/** AppShell también llama a apiGet('/usuarios/me') al montar. */
function mockeaAvisosYPerfil(avisos: unknown) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/avisos/') return typeof avisos === 'function' ? avisos() : Promise.resolve(avisos)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Avisos', () => {
  it('carga los avisos desde el backend y destaca el extraordinario como hero', async () => {
    mockeaAvisosYPerfil(AVISOS)
    renderConProviders(<Avisos />)

    expect(await screen.findByText('Reprogramación jornada del viernes')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/avisos/')
    // El hero no se repite en el tablón de abajo.
    expect(screen.getAllByText('Reprogramación jornada del viernes')).toHaveLength(1)
    expect(screen.getByText('Sesión de Metodologías Ágiles cancelada')).toBeInTheDocument()
    expect(screen.getByText('Feria de Empleabilidad SENA Tech 2025')).toBeInTheDocument()
  })

  it('el filtro por categoría muestra solo los avisos de esa categoría', async () => {
    mockeaAvisosYPerfil(AVISOS)
    const usuario = userEvent.setup()
    renderConProviders(<Avisos />)
    await screen.findByText('Sesión de Metodologías Ágiles cancelada')

    await usuario.click(screen.getByRole('button', { name: 'Cancelaciones & Reprogramaciones' }))

    expect(screen.getByText('Sesión de Metodologías Ágiles cancelada')).toBeInTheDocument()
    expect(screen.queryByText('Feria de Empleabilidad SENA Tech 2025')).not.toBeInTheDocument()
  })

  it('el buscador filtra por título o cuerpo', async () => {
    mockeaAvisosYPerfil(AVISOS)
    const usuario = userEvent.setup()
    renderConProviders(<Avisos />)
    await screen.findByText('Sesión de Metodologías Ágiles cancelada')

    await usuario.type(screen.getByLabelText('Buscar por tema, ficha o ambiente'), 'Feria')

    expect(screen.queryByText('Sesión de Metodologías Ágiles cancelada')).not.toBeInTheDocument()
    expect(screen.getByText('Feria de Empleabilidad SENA Tech 2025')).toBeInTheDocument()
  })

  it('muestra el link real a Mesa de Ayuda', async () => {
    mockeaAvisosYPerfil(AVISOS)
    renderConProviders(<Avisos />)
    await screen.findByText('Reprogramación jornada del viernes')

    const link = screen.getByRole('link', { name: 'Crear Radicado en Mesa de Ayuda' })
    expect(link).toHaveAttribute('href', 'https://mesadeayuda.sena.edu.co')
  })

  it('el botón "Ver cómo afecta mi horario" está deshabilitado', async () => {
    mockeaAvisosYPerfil(AVISOS)
    renderConProviders(<Avisos />)
    await screen.findByText('Reprogramación jornada del viernes')

    expect(screen.getByRole('button', { name: 'Ver cómo afecta mi horario' })).toBeDisabled()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/avisos/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Avisos />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar los avisos.')).toBeInTheDocument()
    })
  })
})
