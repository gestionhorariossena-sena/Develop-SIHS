import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext } from '../context/auth-context'
import type { AuthContextValue } from '../context/auth-context'
import { ThemeProvider } from '../context/ThemeContext'

/** Sesión falsa mínima — suficiente para que useAuth() no reviente al
 * renderizar páginas envueltas en <AppShell>, que la exige vía contexto. */
const sesionFalsa: AuthContextValue = {
  session: null,
  loading: false,
  signOut: async () => {},
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
        <AuthContext.Provider value={sesionFalsa}>{ui}</AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>,
  )
}
