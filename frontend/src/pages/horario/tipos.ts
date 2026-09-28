export type Jornada = 'Mañana' | 'Tarde' | 'Noche'

export interface BloqueHorario {
  jornada: Jornada
  horaInicio: string
  horaFin: string
  /** Mismo horario en formato 24h "HH:MM:SS" — lo que espera el backend
   * (`HorarioCreate.horaInicio/horaFin`), separado del texto de display. */
  horaInicio24: string
  horaFin24: string
}

/**
 * Un bloque de clase reutilizable: se define una vez y se asigna a varias
 * celdas del grid. `tematica`/`instructor`/`ficha`/`ambiente` son para
 * mostrar en el grid (`CeldaHorario`/`GridHorario` no cambian); los campos
 * `id*` de abajo son los que de verdad se mandan a `POST /horarios` — ver
 * `ModalBloque.tsx` (los llena eligiendo de catálogos reales) y
 * `NuevoHorario.tsx` (los usa al guardar). Opcionales para no romper los
 * fixtures de tests existentes que no los necesitan.
 */
export interface BloqueClase {
  id: string
  tematica: string
  instructor: string
  ficha: string
  ambiente: string

  idResultado?: number
  idInstructor?: string
  idFicha?: number
  idTrimestre?: number
  idAmbiente?: number
  /** ID relacional conservado al editar un snapshot existente. */
  idHorarioOriginal?: number
}

/** Coordenada de una celda del grid: índice de bloque horario + índice de día. */
export interface PosicionCelda {
  bloqueIdx: number
  diaIdx: number
}

/** Grid de asignaciones: para cada celda, el id de `BloqueClase` asignado (si hay). */
export type GridAsignaciones = (string | null)[][]

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const

// Dos bloques por jornada, con su "Receso" entre ambos — igual que la
// plantilla institucional (ver PDF referenciado en NuevoHorario.tsx).
export const BLOQUES: BloqueHorario[] = [
  { jornada: 'Mañana', horaInicio: '6:15 a.m', horaFin: '9:00 a.m', horaInicio24: '06:15:00', horaFin24: '09:00:00' },
  { jornada: 'Mañana', horaInicio: '9:00 a.m', horaFin: '12:00 p.m', horaInicio24: '09:00:00', horaFin24: '12:00:00' },
  { jornada: 'Tarde', horaInicio: '12:00 p.m', horaFin: '3:00 p.m', horaInicio24: '12:00:00', horaFin24: '15:00:00' },
  { jornada: 'Tarde', horaInicio: '3:00 p.m', horaFin: '6:00 p.m', horaInicio24: '15:00:00', horaFin24: '18:00:00' },
  { jornada: 'Noche', horaInicio: '6:00 p.m', horaFin: '8:00 p.m', horaInicio24: '18:00:00', horaFin24: '20:00:00' },
  { jornada: 'Noche', horaInicio: '8:00 p.m', horaFin: '10:00 p.m', horaInicio24: '20:00:00', horaFin24: '22:00:00' },
]
