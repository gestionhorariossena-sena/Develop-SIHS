import { useState, type ChangeEvent } from 'react'
import { parsearCsv, type FilaCsv } from '../utils/csv'
import {
  ejecutarCargaMasiva, PanelCargaMasiva, ResumenCargaMasiva, TituloPasoCarga,
  botonConfirmarCarga, estiloArchivoCarga, type ResultadoCargaMasiva,
} from './cargaMasiva/FlujoCargaMasiva'

export interface ColumnaImportar {
  clave: string
  encabezado: string
  requerido?: boolean
}
interface ImportarArchivoProps {
  columnas: ColumnaImportar[]
  entidad?: string
  onImportarFila: (fila: FilaCsv) => Promise<void>
  onTerminado?: () => void
  onCerrar: () => void
}

/** Catálogos Fichas y Ambientes: mismo flujo que el alta masiva y currículo.
 * CSV es el formato de estos dos catálogos, no un importador distinto.
 */
export function ImportarArchivo({ columnas, entidad = 'registros', onImportarFila, onTerminado, onCerrar }: ImportarArchivoProps) {
  const [filas, setFilas] = useState<FilaCsv[] | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoCargaMasiva[] | null>(null)
  const filasInvalidas = filas?.map((fila, indice) => ({ indice, campos: columnas.filter(c => c.requerido !== false && !fila[c.encabezado]?.trim()).map(c => c.encabezado) })).filter(fila => fila.campos.length > 0) ?? []

  async function manejarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setResultados(null)
    setErrorArchivo(null)
    setFilas(null)
    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      setErrorArchivo('Selecciona un archivo CSV.')
      return
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorArchivo('El archivo supera el límite de 2 MB.')
      return
    }
    try {
      const { encabezados, filas: parseadas } = parsearCsv(await archivo.text())
      const faltantes = columnas.filter(c => c.requerido !== false && !encabezados.includes(c.encabezado))
      if (faltantes.length > 0) {
        setErrorArchivo(`Al archivo le faltan estas columnas: ${faltantes.map(c => c.encabezado).join(', ')}.`)
      } else if (parseadas.length === 0) {
        setErrorArchivo('El archivo no tiene filas para importar.')
      } else if (parseadas.length > 200) {
        setErrorArchivo('El máximo por archivo es 200 registros.')
      } else {
        setFilas(parseadas)
      }
    } catch {
      setErrorArchivo('No se pudo leer el archivo CSV.')
    }
  }

  async function confirmarImportacion() {
    if (!filas || importando || filasInvalidas.length > 0) return
    setImportando(true)
    try {
      await ejecutarCargaMasiva(
        filas, onImportarFila, setResultados,
        (fila, indice) => fila[columnas[0].encabezado] || `Fila ${indice + 2}`,
      )
      onTerminado?.()
    } finally {
      setImportando(false)
    }
  }

  return <PanelCargaMasiva
    titulo={`Carga masiva de ${entidad}`}
    descripcion="Selecciona el archivo, revisa su contenido y confirma antes de crear registros."
    columnas={columnas.map(c => c.encabezado).join(', ')}
    error={errorArchivo}
    onCerrar={onCerrar}
  >
    <div className="space-y-2">
      <TituloPasoCarga numero={1} titulo="Seleccionar archivo" detalle="Formato CSV · máximo 2 MB y 200 registros." />
      <input type="file" accept=".csv,text/csv" onChange={(e) => void manejarArchivo(e)} aria-label="Seleccionar archivo CSV" className={estiloArchivoCarga} disabled={importando} />
    </div>
    {filas && !resultados && <section className="space-y-3 border-t border-outline-variant pt-4">
      <TituloPasoCarga numero={2} titulo="Revisar datos" detalle={`Se encontraron ${filas.length} filas. Aún no se ha guardado ninguna.`} />
      <p className="text-sm text-on-surface-variant">Vista previa de <strong>{filas.length}</strong> filas para importar.{filasInvalidas.length > 0 && ` ${filasInvalidas.length} requieren corrección antes de confirmar.`}</p>
      <div className="max-h-64 overflow-auto rounded-md border border-outline-variant">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-container-low font-semibold text-on-surface-variant"><tr>{columnas.map(c => <th key={c.clave} className="px-3 py-2">{c.encabezado}</th>)}</tr></thead>
          <tbody className="divide-y divide-outline-variant">{filas.map((fila, i) =>
            <tr key={i}>{columnas.map(c => <td key={c.clave} className={`px-3 py-2 ${c.requerido !== false && !fila[c.encabezado]?.trim() ? 'font-semibold text-error' : 'text-on-surface-variant'}`}>{fila[c.encabezado] || 'Falta dato'}</td>)}</tr>,
          )}</tbody>
        </table>
      </div>
      <button type="button" onClick={() => void confirmarImportacion()} disabled={importando || filasInvalidas.length > 0} className={botonConfirmarCarga}>
        {importando ? 'Importando…' : `Confirmar importación de ${filas.length} fila${filas.length === 1 ? '' : 's'}`}
      </button>
    </section>}
    {resultados && <ResumenCargaMasiva resultados={resultados} total={filas?.length ?? resultados.length} />}
  </PanelCargaMasiva>
}
