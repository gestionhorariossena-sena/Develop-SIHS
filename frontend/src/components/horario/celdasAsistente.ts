import type { Horario } from '../../types/api'

export interface CeldaAsistente {
  /** Único dentro de todo el grid -- id real del horario si ya existe
   * ("existente-42"), o un id sintético del bloque propuesto ("nuevo-3"). */
  id: string
  origen: 'existente' | 'nuevo'
  fichaCodigo: string
  instructorNombre: string
  ambienteNombre: string
  resultadoDescripcion: string | null
  horaInicio: string
  dias: number[]
  /** Solo aplica a `origen: 'nuevo'` -- refleja el resultado de la
   * revalidación en vivo (POST /horarios/validar) que ya corre el
   * asistente antes de llegar aquí. */
  estado?: 'validando' | 'sinCruces' | 'conflicto'
}

/** Convierte `Horario[]` reales (lo que devuelve GET /horarios/) a
 * `CeldaAsistente[]` de solo lectura -- para mostrarlos en GridAsistente
 * desde cualquier pantalla que ya tenga `Horario[]` (HorariosCompletos,
 * futuros drawers de ficha/instructor/ambiente), sin importar si el
 * horario se creó a mano o con el asistente. Todos con `origen:
 * 'existente'`: ya están guardados, no hay nada que "quitar" acá (para
 * eso está Publicar/Despublicar).
 *
 * Vive fuera de GridAsistente.tsx porque ese archivo solo puede exportar
 * componentes: mezclar helpers ahí rompe el fast refresh de Vite (regla
 * react-refresh/only-export-components). */
export function celdasDesdeHorarios(horarios: Horario[]): CeldaAsistente[] {
  return horarios.map((h) => ({
    id: `existente-${h.idHorario}`,
    origen: 'existente',
    fichaCodigo: h.fichaCodigo ?? '—',
    instructorNombre: h.instructorNombre ?? '—',
    ambienteNombre: h.ambienteNombre ?? '—',
    resultadoDescripcion: h.resultadoDescripcion,
    horaInicio: h.horaInicio,
    dias: h.dias,
  }))
}
