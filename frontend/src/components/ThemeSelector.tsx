import { useTheme } from '../hooks/useTheme'
import type { Tema } from '../context/theme-context'

interface OpcionTema {
  valor: Tema
  etiqueta: string
  icono: React.ReactNode
}

const OPCIONES: OpcionTema[] = [
  {
    valor: 'claro',
    etiqueta: 'Tema claro',
    icono: (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="4" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    valor: 'oscuro',
    etiqueta: 'Tema oscuro',
    icono: (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.35 15.7A8.5 8.5 0 0 1 8.3 3.65 8.5 8.5 0 1 0 20.35 15.7Z" />
      </svg>
    ),
  },
  {
    valor: 'sistema',
    etiqueta: 'Usar tema del sistema',
    icono: (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="4" width="18" height="13" rx="2" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M8 21h8m-4-4v4" />
      </svg>
    ),
  },
]

export function ThemeSelector() {
  const { tema, setTema } = useTheme()

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Tema de la interfaz">
      {OPCIONES.map((opcion) => {
        const activo = tema === opcion.valor
        return (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => setTema(opcion.valor)}
            title={opcion.etiqueta}
            aria-label={opcion.etiqueta}
            aria-pressed={activo}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sena-600 ${
              activo
                ? 'bg-white text-sena-700 shadow-sm dark:bg-slate-700'
                : 'text-slate-400 hover:bg-white hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {opcion.icono}
          </button>
        )
      })}
    </div>
  )
}