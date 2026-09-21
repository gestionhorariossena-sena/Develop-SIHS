export type FilaCsv = Record<string, string>

function partirLinea(linea: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i++) {
    const caracter = linea[i]
    if (entreComillas) {
      if (caracter === '"' && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else if (caracter === '"') {
        entreComillas = false
      } else {
        actual += caracter
      }
    } else if (caracter === '"') {
      entreComillas = true
    } else if (caracter === ',') {
      campos.push(actual)
      actual = ''
    } else {
      actual += caracter
    }
  }
  campos.push(actual)

  return campos.map((campo) => campo.trim())
}

/** Parser de CSV minimalista (sin librería externa): separa por coma,
 * soporta campos entre comillas dobles (con "" como escape). No cubre
 * separadores alternativos (`;`) ni Excel binario (.xlsx) — el alcance de
 * SCRUM-89 se acotó a CSV, que es un "Guardar como" de un clic desde
 * Excel/Sheets. */
export function parsearCsv(texto: string): { encabezados: string[]; filas: FilaCsv[] } {
  const lineas = texto.split(/\r\n|\n|\r/).filter((linea) => linea.trim() !== '')
  if (lineas.length === 0) return { encabezados: [], filas: [] }

  const encabezados = partirLinea(lineas[0])
  const filas = lineas.slice(1).map((linea) => {
    const valores = partirLinea(linea)
    return Object.fromEntries(encabezados.map((encabezado, indice) => [encabezado, valores[indice] ?? '']))
  })

  return { encabezados, filas }
}
