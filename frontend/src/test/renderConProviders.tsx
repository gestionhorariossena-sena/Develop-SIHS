import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext } from '../context/auth-context'
import type { AuthContextValue } from '../context/auth-context'
import { ThemeProvider } from '../context/ThemeContext'

/** Sesión falsa mínima — suficiente para que useAuth() no reviente al
 * renderizar páginas envueltas en <AppShell>, que la exige vía contexto.
 *
 * Trae un `user.id` porque AppShell pide el perfil por ese id
 * (`services/perfil.ts`); con `session: null` no pedía ninguno y el navbar
 * se dibujaba sin roles. El id es distinto en cada render a propósito:
 * ese servicio cachea el perfil por persona y su caché vive en el módulo,
 * así que un id fijo haría que un test viera los roles que mockeó el
 * anterior. */
let sesionesCreadas = 0

function crearSesionFalsa(): AuthContextValue {
  sesionesCreadas += 1
  return {
    session: {
      user: { id: `usuario-de-prueba-${sesionesCreadas}` },
    } as AuthContextValue['session'],
    loading: false,
    signOut: async () => {},
  }
}

/** Envuelve con MemoryRouter (AppShell usa <Link>), AuthContext (AppShell
 * usa useAuth()) y ThemeProvider (AppShell renderiza <ThemeSelector>, que
 * usa useTheme()) — lo mínimo que necesita cualquier página real para
 * renderizar en un test sin reventar, sin levantar el AuthProvider de
 * verdad (que llama a Supabase). ThemeProvider sí se usa real: solo toca
 * localStorage/matchMedia, ambos disponibles en jsdom.
 *
 * `initialEntries` opcional — para páginas que leen query params con
 * useSearchParams (ej. Instructores.tsx?id=... desde VistaInstructores.tsx). */
export function renderConProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <AuthContext.Provider value={crearSesionFalsa()}>{ui}</AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}
