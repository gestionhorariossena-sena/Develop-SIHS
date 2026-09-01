import { createContext } from 'react'

export type Tema = 'claro' | 'oscuro' | 'sistema'

export interface ThemeContextValue {
  tema: Tema
  setTema: (tema: Tema) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)