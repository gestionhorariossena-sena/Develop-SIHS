import { BLOQUES, DIAS } from './tipos'
import type { GridAsignaciones, PosicionCelda } from './tipos'

/** Grid del tamaño del horario (bloques × días), todas las celdas sin asignar. */
export function crearGridVacio(): GridAsignaciones {
  return BLOQUES.map(() => DIAS.map(() => null))
}

function clonarGrid(grid: GridAsignaciones): GridAsignaciones {
  return grid.map((fila) => [...fila])
}

/** Asigna un bloque de clase a una única celda. No muta `grid`. */
export function asignarCelda(
  grid: GridAsignaciones,
  posicion: PosicionCelda,
  bloqueId: string,
): GridAsignaciones {
  const siguiente = clonarGrid(grid)
  siguiente[posicion.bloqueIdx][posicion.diaIdx] = bloqueId
  return siguiente
}

/** Quita la asignación de una única celda (queda vacía). No muta `grid`. */
export function quitarCelda(grid: GridAsignaciones, posicion: PosicionCelda): GridAsignaciones {
  const siguiente = clonarGrid(grid)
  siguiente[posicion.bloqueIdx][posicion.diaIdx] = null
  return siguiente
}

/**
 * Todas las celdas del rectángulo entre dos esquinas (inclusive), en
 * cualquier orden en que se hayan seleccionado. Se usa para el "aplicar a
 * rango": el usuario llena una celda y luego, con Shift, hace clic en otra
 * para que el bloque activo se copie a todas las celdas intermedias.
 */
export function rangoRectangular(desde: PosicionCelda, hasta: PosicionCelda): PosicionCelda[] {
  const bloqueMin = Math.min(desde.bloqueIdx, hasta.bloqueIdx)
  const bloqueMax = Math.max(desde.bloqueIdx, hasta.bloqueIdx)
  const diaMin = Math.min(desde.diaIdx, hasta.diaIdx)
  const diaMax = Math.max(desde.diaIdx, hasta.diaIdx)

  const celdas: PosicionCelda[] = []
  for (let bloqueIdx = bloqueMin; bloqueIdx <= bloqueMax; bloqueIdx += 1) {
    for (let diaIdx = diaMin; diaIdx <= diaMax; diaIdx += 1) {
      celdas.push({ bloqueIdx, diaIdx })
    }
  }
  return celdas
}

/** Asigna el mismo bloque de clase a varias celdas de una sola vez. No muta `grid`. */
export function asignarRango(
  grid: GridAsignaciones,
  celdas: PosicionCelda[],
  bloqueId: string,
): GridAsignaciones {
  const siguiente = clonarGrid(grid)
  for (const { bloqueIdx, diaIdx } of celdas) {
    siguiente[bloqueIdx][diaIdx] = bloqueId
  }
  return siguiente
}

/** Vacía todas las celdas que tuvieran asignado `bloqueId` — se usa al eliminar un bloque. */
export function quitarBloqueDeGrid(grid: GridAsignaciones, bloqueId: string): GridAsignaciones {
  return grid.map((fila) => fila.map((id) => (id === bloqueId ? null : id)))
}

/** Paleta de colores para distinguir bloques de clase en el grid (independiente del color de jornada). */
const PALETA_BLOQUES = [
  { fondo: 'bg-primary-container', borde: 'border-primary', texto: 'text-on-primary-container' },
  { fondo: 'bg-tertiary-container', borde: 'border-tertiary', texto: 'text-on-tertiary-container' },
  { fondo: 'bg-secondary-container', borde: 'border-secondary', texto: 'text-on-secondary-container' },
  { fondo: 'bg-surface-container', borde: 'border-outline', texto: 'text-on-surface' },
] as const

export type ColorBloque = (typeof PALETA_BLOQUES)[number]

/** Color determinístico para un bloque de clase: el mismo id siempre da el mismo color. */
export function colorParaBloque(bloqueId: string): ColorBloque {
  let hash = 0
  for (let i = 0; i < bloqueId.length; i += 1) {
    hash = (hash * 31 + bloqueId.charCodeAt(i)) >>> 0
  }
  return PALETA_BLOQUES[hash % PALETA_BLOQUES.length]
}

/** Id único para un bloque de clase nuevo. `crypto.randomUUID` con fallback por si el entorno no lo expone. */
export function crearIdBloque(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `bloque-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
