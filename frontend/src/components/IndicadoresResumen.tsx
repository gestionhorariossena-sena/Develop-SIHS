import type { ReactNode } from 'react'

export type IndicadorResumen = {
  etiqueta: string
  valor: ReactNode
  detalle?: ReactNode
  icono?: string
  progreso?: number
}

export function IndicadoresResumen({ items, titulo, className = '' }: {
  items: IndicadorResumen[]
  titulo: string
  className?: string
}) {
  return (
    <section aria-label={titulo} className={`border-y border-outline-variant dark:border-slate-700 ${className}`}>
      <dl className={`grid divide-y divide-outline-variant dark:divide-slate-700 sm:divide-y-0 ${items.length === 2 ? 'sm:grid-cols-2 sm:divide-x' : items.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4 lg:divide-x' : items.length === 5 ? 'sm:grid-cols-2 lg:grid-cols-5 lg:divide-x' : 'sm:grid-cols-3 sm:divide-x'}`}>
        {items.map((item) => (
          <div key={item.etiqueta} className="min-w-0 py-4 sm:px-5 sm:first:pl-0 sm:last:pr-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-on-surface-variant dark:text-slate-400">{item.etiqueta}</dt>
              {item.icono && <span className="material-symbols-outlined shrink-0 text-[18px] text-primary" aria-hidden="true">{item.icono}</span>}
            </div>
            <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-on-surface dark:text-slate-100">{item.valor}</dd>
            {item.detalle && <p className="mt-1 text-xs leading-5 text-on-surface-variant dark:text-slate-400">{item.detalle}</p>}
            {item.progreso !== undefined && (
              <div className="mt-2 h-1 w-full bg-surface-container dark:bg-slate-700" role="meter" aria-label={`${item.etiqueta}: ${item.progreso}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, item.progreso))}>
                <div className="h-1 bg-primary" style={{ width: `${Math.max(0, Math.min(100, item.progreso))}%` }} />
              </div>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
