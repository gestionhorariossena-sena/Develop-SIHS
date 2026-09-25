import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { AppShell } from './AppShell'
import type { Notificacion, Usuario } from '../types/api'

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
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
  it('un Aprendiz ve el grupo "Mi trabajo" con sus pantallas, en un desplegable propio del navbar', async () => {
    mockearApiGet(crearPerfil(['Aprendiz']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    const botonGrupo = await screen.findByRole('button', { name: 'Mi trabajo' })
    fireEvent.click(botonGrupo)

    for (const etiqueta of ['Mi horario', 'Mensajes', 'Notificaciones']) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument()
    }
  })

  it('un Instructor ve "Mi horario" plano en el navbar (un solo ítem no abre desplegable)', async () => {
    mockearApiGet(crearPerfil(['Instructor']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    expect(await screen.findByText('Mi horario')).toBeInTheDocument()
    // Un solo ítem en el grupo -> se renderiza como link plano, sin botón
    // de desplegable "Mi trabajo".
    expect(screen.queryByRole('button', { name: 'Mi trabajo' })).not.toBeInTheDocument()
  })

  it('un Coordinador no ve el grupo "Mi trabajo" ni sus pantallas exclusivas de Aprendiz/Instructor', async () => {
    mockearApiGet(crearPerfil(['Coordinador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    await screen.findByRole('button', { name: 'Programación' })

    expect(screen.queryByRole('button', { name: 'Mi trabajo' })).not.toBeInTheDocument()
    expect(screen.queryByText('Mi horario')).not.toBeInTheDocument()
    expect(screen.queryByText('Mensajes Docentes')).not.toBeInTheDocument()
    // "Notificaciones" (Centro de Notificaciones del Aprendiz) y "Avisos y
    // Eventos" son exclusivas de Aprendiz -- ocultas para Coordinador.
    expect(screen.queryByText('Avisos y Eventos')).not.toBeInTheDocument()
  })

  it('un Administrador ve "Solicitudes de acceso" dentro de Administración', async () => {
    mockearApiGet(crearPerfil(['Administrador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    const botonGrupo = await screen.findByRole('button', { name: 'Administración' })
    fireEvent.click(botonGrupo)

    expect(screen.getByText('Solicitudes de acceso')).toBeInTheDocument()
  })

  it('un Coordinador no ve "Solicitudes de acceso" (soloAdmin)', async () => {
    mockearApiGet(crearPerfil(['Coordinador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    const botonGrupo = await screen.findByRole('button', { name: 'Administración' })
    fireEvent.click(botonGrupo)

    expect(screen.queryByText('Solicitudes de acceso')).not.toBeInTheDocument()
  })
})
