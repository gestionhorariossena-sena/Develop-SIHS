import type { ReactNode } from 'react'
import senaLogo from '../assets/sena-logo.jpeg'
import { ThemeSelector } from './ThemeSelector'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Layout compartido por Login, Registro y RecuperarContrasena: barra verde
 * arriba, tarjeta centrada con el logo del SENA, y el pie de página
 * institucional. Tokens del rediseño Stitch — ver GUIA_DE_MARCA.md v2.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface dark:bg-slate-900">
      <div className="h-1.5 w-full bg-primary" />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-lg shadow-slate-200/60 dark:bg-slate-800 dark:shadow-slate-950/40">
          <div className="mb-6 flex items-center gap-3">
            <img src={senaLogo} alt="SENA" className="h-12 w-12 rounded-xl object-cover" />
            <div>
              <p className="font-semibold text-on-surface dark:text-slate-100">Sistema de Horarios</p>
              <p className="text-sm text-on-surface-variant dark:text-slate-400">SIHS · CGMLTI</p>
            </div>
          </div>

          {children}
        </div>
      </main>

      <footer className="flex flex-col items-center gap-1 px-4 pb-6 text-xs text-on-surface-variant sm:flex-row sm:justify-between sm:px-8">
        <span>Servicio Nacional de Aprendizaje · Regional Distrito Capital</span>
        <div className="flex items-center gap-3">
          <ThemeSelector />
          <span>v1.0</span>
        </div>
      </footer>
    </div>
  )
}
