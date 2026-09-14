import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { AppShell } from './AppShell'
import type { Usuario } from '../types/api'

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

describe('AppShell', () => {
  it('un Aprendiz ve el grupo "MI TRABAJO" con sus 4 pantallas, sin duplicarlas en "GESTIÓN"', async () => {
    apiGetMock.mockResolvedValue(crearPerfil(['Aprendiz']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    expect(await screen.findByText('MI TRABAJO')).toBeInTheDocument()

    const asideElementos = document.querySelectorAll('aside nav')
    const grupoTrabajo = within(asideElementos[0] as HTMLElement)
    const grupoGestion = within(asideElementos[1] as HTMLElement)

    for (const etiqueta of ['Mi Horario', 'Mensajes Docentes', 'Avisos y Eventos', 'Notificaciones']) {
      expect(grupoTrabajo.getByText(etiqueta)).toBeInTheDocument()
      expect(grupoGestion.queryByText(etiqueta)).not.toBeInTheDocument()
    }
  })

  it('un Coordinador no ve el grupo "MI TRABAJO" ni las pantallas exclusivas de Aprendiz, pero sí Avisos y Eventos', async () => {
    apiGetMock.mockResolvedValue(crearPerfil(['Coordinador']))
    renderConProviders(
      <AppShell activo="Inicio">
        <p>contenido</p>
      </AppShell>,
    )

    await screen.findByText('GESTIÓN')

    expect(screen.queryByText('MI TRABAJO')).not.toBeInTheDocument()
    // Mi Horario/Mensajes Docentes/Notificaciones son exclusivas de
    // Aprendiz (SOLO_APRENDIZ) -- ocultas por completo para otros roles.
    expect(screen.queryByText('Mi Horario')).not.toBeInTheDocument()
    expect(screen.queryByText('Mensajes Docentes')).not.toBeInTheDocument()
    expect(screen.queryByText('Notificaciones')).not.toBeInTheDocument()
    // Avisos y Eventos no está en SOLO_APRENDIZ -- sigue visible para
    // cualquier rol en la lista general.
    expect(screen.getByText('Avisos y Eventos')).toBeInTheDocument()
  })
})
