import type { ReactNode } from 'react'

export interface ResultadoCargaMasiva {
  fila: number
  etiqueta: string
  ok: boolean
  mensaje?: string
}

/** Cada importador decide cómo validar y persistir una fila.
 * Este ejecutor garantiza el mismo avance, aislamiento de errores y resumen.
 * No aplica al asistente de horarios con IA, que utiliza un wizard diferente.
 */
export async function ejecutarCargaMasiva<T>(
  filas: T[],
  importar: (fila: T, indice: number) => Promise<void>,
  alProgresar: (resultados: ResultadoCargaMasiva[]) => void,
  etiqueta: (fila: T, indice: number) => string,
): Promise<ResultadoCargaMasiva[]> {
  const resultados: ResultadoCargaMasiva[] = []
  for (let indice = 0; indice < filas.length; indice++) {
    try {
      await importar(filas[indice], indice)
      resultados.push({ fila: indice + 2, etiqueta: etiqueta(filas[indice], indice), ok: true })
    } catch (error) {
      resultados.push({
        fila: indice + 2,
        etiqueta: etiqueta(filas[indice], indice),
        ok: false,
        mensaje: error instanceof Error ? error.message : 'No se pudo importar.',
      })
    }
    alProgresar([...resultados])
  }
  return resultados
}

export const estiloArchivoCarga =
  'block w-full text-sm text-on-surface file:mr-4 file:rounded-md file:border file:border-outline file:bg-surface-container-low file:px-4 file:py-2 file:text-sm file:font-medium'
export const botonConfirmarCarga =
  'inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-60'
export const botonSecundarioCarga =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-outline px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container disabled:opacity-60'

interface Props {
  titulo: string
  descripcion: string
  columnas?: string
  error?: string | null
  mensaje?: string | null
  onCerrar?: () => void
  children: ReactNode
}

/** La misma estructura visual para catálogos CSV, instructores XLSX y currículo XLSX. */
export function PanelCargaMasiva({ titulo, descripcion, columnas, error, mensaje, onCerrar, children }: Props) {
  return (
    <section aria-label={titulo} className="mb-5 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant px-4 py-4 sm:px-5">
        <div className="max-w-2xl">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">Importación de datos</p>
          <h2 className="text-base font-semibold tracking-tight text-on-surface">{titulo}</h2>
          <p className="mt-1 text-sm leading-6 text-on-surface-variant">{descripcion}</p>
          {columnas && <p className="mt-2 text-xs leading-5 text-on-surface-variant"><strong>Columnas:</strong> {columnas}</p>}
        </div>
        {onCerrar && <button type="button" onClick={onCerrar} className={botonSecundarioCarga}>Cerrar</button>}
      </header>
      <div className="space-y-4 px-4 py-5 sm:px-5">
        {error && <p role="alert" className="rounded-md border border-error/30 bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
        {mensaje && <p role="status" className="rounded-md border border-primary/30 bg-primary-container p-3 text-sm text-on-primary-container">{mensaje}</p>}
        {children}
      </div>
    </section>
  )
}

export function TituloPasoCarga({ numero, titulo, detalle }: { numero: 1 | 2 | 3; titulo: string; detalle?: string }) {
  return <div className="flex items-start gap-3">
    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-container text-xs font-semibold tabular-nums text-on-surface">{numero}</span>
    <div><h3 className="text-sm font-semibold text-on-surface">{titulo}</h3>{detalle && <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{detalle}</p>}</div>
  </div>
}

export function ResumenCargaMasiva({ resultados, total }: { resultados: ResultadoCargaMasiva[]; total: number }) {
  const correctos = resultados.filter(r => r.ok).length
  const fallidos = resultados.length - correctos
  return <section aria-label="Resultado de carga masiva" className="border-t border-outline-variant pt-4">
    <TituloPasoCarga numero={3} titulo="Resultado de la importación" detalle={`${resultados.length} de ${total} procesados · ${correctos} correctos · ${fallidos} con error`} />
    <ul className="mt-3 max-h-56 divide-y divide-outline-variant overflow-auto rounded-md border border-outline-variant text-sm">
      {resultados.map(r => <li key={r.fila} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
        <span className="min-w-0 text-on-surface">Fila {r.fila} · {r.etiqueta}</span>
        <span className={r.ok ? 'text-primary' : 'text-error'}>{r.ok ? 'Importado' : r.mensaje ?? 'Error'}</span>
      </li>)}
    </ul>
  </section>
}
