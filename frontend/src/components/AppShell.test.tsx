import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { AppShell } from './AppShell'
import type { Notificacion, Usuario } from '../types/api'

const apiGetMock = vi.fn()
const apiPatchMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
}))

function crearPerfil(roles: string[]): Usuario {
  return {
    idUsuario: 'u1',
    nombre: 'Ana',
    email: 'ana@example.com',
    estado: 'activo',
    fechaRegistro: '2026-01-01',
    roles: roles.map((nombre, idx) => ({ idRol: idx + 1, nombre })),
    especialidades: [],
    debeCambiarClave: false,
  }
}

/** apiGet lo llama AppShell tanto para el perfil (`/usuarios/me`) como
 * para las notificaciones (`/notificaciones/`) -- discrimina por el
 * primer argumento para no devolver el perfil donde se espera un array. */
function mockearApiGet(perfil: Usuario, notificaciones: Notificacion[] = []) {
  apiGetMock.mockImplementation((ruta: string) => {
    if (ruta === '/notificaciones/') return Promise.resolve(notificaciones)
    return Promise.resolve(perfil)
  })
}

describe('AppShell', () => {
  it('aplica el tema guardado en el backend aunque el navegador tenga otro (T-9)', async () => {
    localStorage.setItem('sihs-tema', 'claro')
    mockearApiGet({ ...crearPerfil(['Instructor']), preferenciaTema: 'oscuro' })
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    expect(screen.getByRole('button', { name: 'Tema oscuro' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar el tema desde el navbar lo guarda en el backend (T-9)', async () => {
    localStorage.setItem('sihs-tema', 'claro')
    mockearApiGet(crearPerfil(['Aprendiz']))
    apiPatchMock.mockResolvedValue({ ...crearPerfil(['Aprendiz']), preferenciaTema: 'oscuro' })
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }))

    expect(apiPatchMock).toHaveBeenCalledWith('/usuarios/me/preferencias', { tema: 'oscuro' })
    expect(document.documentElement).toHaveClass('dark')
  })

  it('un Aprendiz no ve herramientas restringidas a instructores ni a coordinación', async () => {
    mockearApiGet(crearPerfil(['Aprendiz']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    await screen.findByText('Ana')
    expect(screen.queryByRole('link', { name: 'Mi horario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Fichas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Aprobar solicitudes de registro' })).not.toBeInTheDocument()
  })

  it('un Instructor ve su enlace de autoservicio y no las herramientas de coordinación', async () => {
    mockearApiGet(crearPerfil(['Instructor']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    expect(await screen.findByRole('link', { name: 'Mi horario' })).toHaveAttribute('href', '/mi-horario')
    expect(screen.queryByRole('link', { name: 'Fichas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Instructores' })).not.toBeInTheDocument()
  })

  it('un Coordinador no ve el grupo "Mi trabajo" ni sus pantallas exclusivas de Aprendiz/Instructor', async () => {
    mockearApiGet(crearPerfil(['Coordinador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    expect(await screen.findByRole('link', { name: 'Fichas' })).toHaveAttribute('href', '/fichas')
    expect(screen.getByRole('link', { name: 'Instructores' })).toHaveAttribute('href', '/instructores')
    expect(screen.queryByRole('link', { name: 'Mi horario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Aprobar solicitudes de registro' })).not.toBeInTheDocument()
  })

  it('un Administrador ve el enlace para aprobar solicitudes', async () => {
    mockearApiGet(crearPerfil(['Administrador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    expect(await screen.findByRole('link', { name: 'Aprobar solicitudes de registro' }))
      .toHaveAttribute('href', '/aprobar-solicitudes')
  })

  it('un Coordinador no ve el enlace para aprobar solicitudes', async () => {
    mockearApiGet(crearPerfil(['Coordinador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    await screen.findByRole('link', { name: 'Fichas' })
    expect(screen.queryByRole('link', { name: 'Aprobar solicitudes de registro' })).not.toBeInTheDocument()
  })

  it('consulta de nuevo las notificaciones persistidas al abrir la campana', async () => {
    mockearApiGet(crearPerfil(['Coordinador']))
    renderConProviders(<AppShell activo="Inicio"><p>contenido</p></AppShell>)
    const botonNotificaciones = await screen.findByRole('button', { name: 'Notificaciones' })
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/notificaciones/'))
    const llamadasAntesDeAbrir = apiGetMock.mock.calls.filter(([ruta]) => ruta === '/notificaciones/').length
    fireEvent.click(botonNotificaciones)
    await waitFor(() => expect(apiGetMock.mock.calls.filter(([ruta]) => ruta === '/notificaciones/').length).toBeGreaterThan(llamadasAntesDeAbrir))
  })
})
