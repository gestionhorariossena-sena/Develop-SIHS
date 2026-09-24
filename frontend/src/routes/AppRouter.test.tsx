import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRouter } from './AppRouter'
import { AuthContext } from '../context/auth-context'
import type { AuthContextValue } from '../context/auth-context'
import { ThemeProvider } from '../context/ThemeContext'
import { apiGet, ApiError } from '../services/api'

vi.mock('../services/api', async () => {
  const real = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...real, apiGet: vi.fn(), apiPost: vi.fn() }
})

const apiGetMock = vi.mocked(apiGet)

const PERFIL_APRENDIZ = {
  idUsuario: 'u-aprendiz',
  nombre: 'Juan',
  email: 'juan@mail.com',
  estado: 'activo' as const,
  fechaRegistro: '2026-09-24',
  roles: [{ idRol: 4, nombre: 'Aprendiz' }],
  especialidades: [],
}

const PERFIL_COORDINADOR = {
  ...PERFIL_APRENDIZ,
  idUsuario: 'u-coordinador',
  nombre: 'Ana',
  email: 'ana@mail.com',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
}

let sesionesCreadas = 0

function renderRuta(ruta: string) {
  sesionesCreadas += 1
  const auth = {
    session: { user: { id: `aprendiz-${sesionesCreadas}` } },
    loading: false,
    signOut: async () => {},
  } as AuthContextValue

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ThemeProvider>
        <AuthContext.Provider value={auth}>
          <AppRouter />
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}

/**
 * H-5: hasta el 2026-09-23 ninguna ruta declaraba roles, así que un
 * Aprendiz que escribía `/horarios/asistente-ia` llegaba al formulario
 * entero y recién al pulsar "Continuar" recibía el "No autorizado" del
 * backend. Estas pruebas fijan la puerta cerrada: que la pantalla ajena
 * no se monte nunca.
 */
describe('AppRouter · roles por ruta', () => {
  it('un Aprendiz que escribe una ruta de coordinación acaba en su propia pantalla', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_APRENDIZ)
      if (path === '/notificaciones/') return Promise.resolve([])
      // Sin ficha vinculada: /dashboard manda al Aprendiz a su horario y
      // esa pantalla responde 404 en mi-ficha.
      return Promise.reject(new ApiError(404, 'No encontrado', null))
    })

    renderRuta('/horarios/asistente-ia')

    expect(await screen.findByText('Autoservicio del aprendiz')).toBeInTheDocument()
    expect(screen.queryByText('Asistente de Programación')).not.toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith(expect.stringContaining('/asistente'))
  })

  it('un Aprendiz tampoco alcanza el panel de administración', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_APRENDIZ)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.reject(new ApiError(404, 'No encontrado', null))
    })

    renderRuta('/panel-administracion')

    expect(await screen.findByText('Autoservicio del aprendiz')).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/solicitudes-acceso/')
  })

  // H-6: asignar y quitar roles exige Administrador en el backend, así que
  // un Coordinador que entraba a /usuarios veía los botones y recibía un
  // 403 al pulsarlos.
  it('un Coordinador no entra a /usuarios: repartir roles es del Administrador', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/me') return Promise.resolve(PERFIL_COORDINADOR)
      if (path === '/notificaciones/') return Promise.resolve([])
      return Promise.resolve([])
    })

    renderRuta('/usuarios')

    // Acaba en su home de coordinación, no en la pantalla de usuarios.
    expect(await screen.findByText('Accesos de coordinación')).toBeInTheDocument()
    expect(apiGetMock).not.toHaveBeenCalledWith('/usuario-rol/asignar')
  })
})
