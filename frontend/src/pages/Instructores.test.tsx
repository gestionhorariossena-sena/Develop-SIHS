import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Instructores } from './Instructores'
import type { Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  tipoContrato: 'Planta',
  horasContratadasSemana: 32,
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [{ idEspecialidad: 1, nombre: 'Análisis · Verificación', descripcion: null, activo: true }],
}

const COORDINADOR: Usuario = {
  idUsuario: 'u2',
  nombre: 'Ana Martínez',
  email: 'ana@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
  especialidades: [],
}

const USUARIOS: Usuario[] = [INSTRUCTOR, COORDINADOR]

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

/** AppShell también llama a apiGet('/usuarios/me') al montar — el mock
 * tiene que distinguir por ruta o revienta leyendo `.roles` de lo que sea
 * que devuelva /usuarios/. */
function mockeaUsuariosYPerfil(usuarios: unknown) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/') return Promise.resolve(usuarios)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Instructores', () => {
  it('carga los usuarios y solo muestra los que tienen rol Instructor', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    renderConProviders(<Instructores />)

    expect(await screen.findByText('Erick Granados')).toBeInTheDocument()
    expect(screen.queryByText('Ana Martínez')).not.toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/usuarios/')
    expect(screen.getByText('1 de 1 instructores')).toBeInTheDocument()
  })

  it('muestra especialidad y tipo de contrato del instructor', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    const fila = screen.getByText('Erick Granados').closest('tr') as HTMLElement
    expect(within(fila).getByText('Análisis · Verificación')).toBeInTheDocument()
    expect(within(fila).getByText('Planta')).toBeInTheDocument()
    expect(within(fila).getByText('32 h')).toBeInTheDocument()
  })

  it('el buscador filtra por nombre, correo o especialidad', async () => {
    const otroInstructor: Usuario = { ...INSTRUCTOR, idUsuario: 'u3', nombre: 'Fredy Ardila', especialidades: [{ idEspecialidad: 2, nombre: 'Bases de datos', descripcion: null, activo: true }] }
    mockeaUsuariosYPerfil([INSTRUCTOR, otroInstructor])
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.type(screen.getByLabelText('Buscar'), 'Fredy')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 instructores')).toBeInTheDocument()
  })

  it('clic en una fila abre el panel de detalle', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    const panel = screen.getByRole('heading', { name: 'Erick Granados' }).closest('aside') as HTMLElement
    expect(within(panel).getByText('Análisis · Verificación')).toBeInTheDocument()
    expect(within(panel).getByText('Planta')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Instructores />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el listado de instructores.')).toBeInTheDocument()
    })
  })
})
