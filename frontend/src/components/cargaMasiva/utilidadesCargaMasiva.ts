export interface ResultadoCargaMasiva {
  fila: number
  etiqueta: string
  ok: boolean
  mensaje?: string
}

/** Ejecuta las filas en orden y comunica el avance después de cada intento. */
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
