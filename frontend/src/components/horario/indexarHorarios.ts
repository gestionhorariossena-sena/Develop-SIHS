import type { Horario } from '../../types/api'

/** Índice instructor → fichas/ambientes donde dicta, derivado de TODOS los
 * horarios del sistema (`GET /horarios/`) — para filtrar la lista de
 * instructores por ficha o ambiente sin pedir los horarios de cada
 * instructor uno por uno (Instructores.tsx y VistaInstructores.tsx, "quiero
 * mucha flexibilidad para filtrar"). */
export interface AsociacionesInstructor {
  fichas: Set<string>
  ambientes: Set<string>
}

export function indexarPorInstructor(horarios: Horario[]): Map<string, AsociacionesInstructor> {
  const indice = new Map<string, AsociacionesInstructor>()

  for (const horario of horarios) {
    const entrada = indice.get(horario.idInstructor) ?? { fichas: new Set<string>(), ambientes: new Set<string>() }
    if (horario.fichaCodigo) entrada.fichas.add(horario.fichaCodigo)
    if (horario.ambienteNombre) entrada.ambientes.add(horario.ambienteNombre)
    indice.set(horario.idInstructor, entrada)
  }

  return indice
}

/** Fichas/ambientes únicos presentes en los horarios — para poblar las
 * opciones de los <select> de filtro. */
export function opcionesFichaAmbiente(horarios: Horario[]): { fichas: string[]; ambientes: string[] } {
  const fichas = new Set<string>()
  const ambientes = new Set<string>()
  for (const horario of horarios) {
    if (horario.fichaCodigo) fichas.add(horario.fichaCodigo)
    if (horario.ambienteNombre) ambientes.add(horario.ambienteNombre)
  }
  return { fichas: [...fichas].sort(), ambientes: [...ambientes].sort() }
}

/** Índice inverso: ficha → instructores que dictan en ella — para filtrar
 * Fichas.tsx por instructor, mismo criterio que indexarPorInstructor pero
 * al revés. Se indexa por `idFicha` (no por código) porque es lo que ya
 * trae `Ficha`; el valor del filtro sigue siendo el nombre del instructor,
 * que es lo que se muestra en el <select>. */
export function indexarPorFicha(horarios: Horario[]): Map<number, Set<string>> {
  const indice = new Map<number, Set<string>>()

  for (const horario of horarios) {
    if (!horario.instructorNombre) continue
    const entrada = indice.get(horario.idFicha) ?? new Set<string>()
    entrada.add(horario.instructorNombre)
    indice.set(horario.idFicha, entrada)
  }

  return indice
}

/** Instructores únicos presentes en los horarios — para poblar el <select>
 * de filtro por instructor. */
export function opcionesInstructor(horarios: Horario[]): string[] {
  const instructores = new Set<string>()
  for (const horario of horarios) {
    if (horario.instructorNombre) instructores.add(horario.instructorNombre)
  }
  return [...instructores].sort()
}

/** Índice ambiente → fichas/instructores/coordinaciones asociados —
 * para filtrar Ambientes.tsx igual que Instructores.tsx/Fichas.tsx, sin
 * pedir los horarios de cada ambiente uno por uno. La coordinación no
 * viene en `Horario` (solo `idFicha`) — se traduce con `coordinacionPorFicha`
 * (idFicha → idCoordinacion, derivado de `Ficha.programa.idCoordinacion`). */
export interface AsociacionesAmbiente {
  fichas: Set<string>
  instructores: Set<string>
  coordinaciones: Set<number>
}

export function indexarPorAmbiente(horarios: Horario[], coordinacionPorFicha: Map<number, number>): Map<number, AsociacionesAmbiente> {
  const indice = new Map<number, AsociacionesAmbiente>()

  for (const horario of horarios) {
    const entrada = indice.get(horario.idAmbiente) ?? { fichas: new Set<string>(), instructores: new Set<string>(), coordinaciones: new Set<number>() }
    if (horario.fichaCodigo) entrada.fichas.add(horario.fichaCodigo)
    if (horario.instructorNombre) entrada.instructores.add(horario.instructorNombre)
    const idCoordinacion = coordinacionPorFicha.get(horario.idFicha)
    if (idCoordinacion != null) entrada.coordinaciones.add(idCoordinacion)
    indice.set(horario.idAmbiente, entrada)
  }

  return indice
}
