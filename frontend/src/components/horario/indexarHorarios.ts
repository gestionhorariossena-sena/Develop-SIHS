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
