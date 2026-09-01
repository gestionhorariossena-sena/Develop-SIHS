import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext } from '../context/auth-context'
import type { AuthContextValue } from '../context/auth-context'

/** Sesión falsa mínima — suficiente para que useAuth() no reviente al
 * renderizar páginas envueltas en <AppShell>, que la exige vía contexto. */
const sesionFalsa: AuthContextValue = {
  session: null,
  loading: false,
  signOut: async () => {},
}

/** Envuelve con MemoryRouter (AppShell usa <Link>) y AuthContext (AppShell
 * usa useAuth()) — lo mínimo que necesita cualquier página real para
 * renderizar en un test sin reventar, sin levantar el AuthProvider de
 * verdad (que llama a Supabase). */
export function renderConProviders(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={sesionFalsa}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )
}
