import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, type Tema } from './theme-context'

const CLAVE_TEMA = 'sihs-tema'

function obtenerTemaInicial(): Tema {
  const temaGuardado = localStorage.getItem(CLAVE_TEMA)
  return temaGuardado === 'claro' || temaGuardado === 'oscuro' || temaGuardado === 'sistema'
    ? temaGuardado
    : 'sistema'
}

function aplicarTema(tema: Tema) {
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', tema === 'oscuro' || (tema === 'sistema' && prefiereOscuro))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(obtenerTemaInicial)

  useEffect(() => {
    aplicarTema(tema)
    localStorage.setItem(CLAVE_TEMA, tema)

    if (tema !== 'sistema') return

    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiarPreferencia = () => aplicarTema('sistema')
    consulta.addEventListener('change', alCambiarPreferencia)
    return () => consulta.removeEventListener('change', alCambiarPreferencia)
  }, [tema])

  return <ThemeContext.Provider value={{ tema, setTema }}>{children}</ThemeContext.Provider>
}