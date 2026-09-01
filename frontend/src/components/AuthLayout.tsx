import type { ReactNode } from 'react'
import senaLogo from '../assets/sena-logo.jpeg'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Layout compartido por Login, Registro y RecuperarContrasena: barra verde
 * arriba, tarjeta blanca centrada con el logo del SENA, y el pie de página
 * institucional. Replica el mockup en
 * _Docs/Diseño/mockups-institucionales/01-login.png (y 02, 04).
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="h-1.5 w-full bg-sena-600" />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-slate-200/60">
          <div className="mb-6 flex items-center gap-3">
            <img src={senaLogo} alt="SENA" className="h-12 w-12 rounded-xl object-cover" />
            <div>
              <p className="font-semibold text-slate-900">Sistema de Horarios</p>
              <p className="text-sm text-slate-500">SIHS · CGMLTI</p>
            </div>
          </div>

          {children}
        </div>
      </main>

      <footer className="flex flex-col items-center gap-1 px-4 pb-6 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-8">
        <span>Servicio Nacional de Aprendizaje · Regional Distrito Capital</span>
        <span>v1.0</span>
      </footer>
    </div>
  )
}
