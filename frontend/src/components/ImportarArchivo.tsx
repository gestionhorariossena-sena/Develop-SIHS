import { useState } from 'react'
import { parsearCsv, type FilaCsv } from '../utils/csv'

export interface ColumnaImportar {
  clave: string
  encabezado: string
  /** default true — si no está en el CSV, se bloquea el archivo antes de
   * mostrar la previsualización. */
  requerido?: boolean
}

interface ResultadoFila {
  fila: number
  etiqueta: string
  ok: boolean
  mensaje?: string
}

interface ImportarArchivoProps {
  columnas: ColumnaImportar[]
  /** Crea una fila (ya validada/resuelta por el caller). Debe lanzar un
   * Error con mensaje legible si falla — cada fila es independiente, igual
   * que guardarHorario() en NuevoHorario.tsx: si una falla, las demás
   * igual se intentan. */
  onImportarFila: (fila: FilaCsv) => Promise<void>
  onTerminado?: () => void
  onCerrar: () => void
}

/** SCRUM-89: carga masiva de catálogos por archivo CSV. Genérico a
 * propósito — Fichas.tsx y Ambientes.tsx lo usan con sus propias columnas
 * y su propia lógica de creación (reusan POST /fichas/ y POST /ambientes,
 * no hay endpoint de "importación masiva" nuevo). */
export function ImportarArchivo({ columnas, onImportarFila, onTerminado, onCerrar }: ImportarArchivoProps) {
  const [filas, setFilas] = useState<FilaCsv[] | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null)

  async function manejarArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setResultados(null)
    setErrorArchivo(null)
    setFilas(null)

    const texto = await archivo.text()
    const { encabezados, filas: filasParseadas } = parsearCsv(texto)

    const faltantes = columnas.filter((columna) => columna.requerido !== false && !encabezados.includes(columna.encabezado))
    if (faltantes.length > 0) {
      setErrorArchivo(`Al archivo le faltan estas columnas: ${faltantes.map((columna) => columna.encabezado).join(', ')}.`)
      return
    }
    if (filasParseadas.length === 0) {
      setErrorArchivo('El archivo no tiene filas para importar.')
      return
    }

    setFilas(filasParseadas)
  }

  async function confirmarImportacion() {
    if (!filas) return
    setImportando(true)

    const acumulados: ResultadoFila[] = []
    for (let indice = 0; indice < filas.length; indice++) {
      const fila = filas[indice]
      const etiqueta = fila[columnas[0].encabezado] || `Fila ${indice + 2}`
      try {
        await onImportarFila(fila)
        acumulados.push({ fila: indice + 2, etiqueta, ok: true })
      } catch (error) {
        acumulados.push({ fila: indice + 2, etiqueta, ok: false, mensaje: error instanceof Error ? error.message : 'No se pudo crear.' })
      }
      // Se refleja fila por fila a medida que van terminando, no recién al final.
      setResultados([...acumulados])
    }

    setImportando(false)
    onTerminado?.()
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Cargar archivo">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cargar archivo (CSV)</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Columnas esperadas: {columnas.map((columna) => columna.encabezado).join(', ')}</p>
        </div>
        <button type="button" onClick={onCerrar} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          Cerrar
        </button>
      </div>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(evento) => void manejarArchivo(evento)}
        aria-label="Seleccionar archivo CSV"
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sena-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-700 dark:text-slate-300 dark:file:bg-sena-950/50 dark:file:text-sena-400"
      />

      {errorArchivo && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorArchivo}</p>}

      {filas && !resultados && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
            Se encontraron <strong>{filas.length}</strong> fila{filas.length === 1 ? '' : 's'}. Revisá antes de confirmar — todavía no se creó nada.
          </p>
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  {columnas.map((columna) => (
                    <th key={columna.clave} className="px-3 py-2">
                      {columna.encabezado}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filas.map((fila, indice) => (
                  <tr key={indice}>
                    {columnas.map((columna) => (
                      <td key={columna.clave} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {fila[columna.encabezado] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => void confirmarImportacion()}
            disabled={importando}
            className="mt-3 rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importando ? 'Importando…' : `Confirmar importación de ${filas.length} fila${filas.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {resultados && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {resultados.filter((resultado) => resultado.ok).length} de {filas?.length ?? resultados.length} filas creadas{importando ? ' (importando…)' : '.'}
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {resultados.map((resultado) => (
              <li key={resultado.fila} className={resultado.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                Fila {resultado.fila} — {resultado.etiqueta}: {resultado.ok ? 'creada' : resultado.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
