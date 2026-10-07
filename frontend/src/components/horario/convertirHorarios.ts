import { BLOQUES, DIAS } from '../../pages/horario/tipos'
import type { BloqueClase, GridAsignaciones } from '../../pages/horario/tipos'
import type { Horario } from '../../types/api'

/**
 * idDia en la BD es 1=Lunes..6=Sábado (orden de inserción en
 * "diasDeLaSemana", ver database/02_datos_prueba.sql) — coincide con el
 * índice (1-based) de DIAS.
 */
function indiceDia(idDia: number): number {
  return idDia - 1
}

/** Ubica a qué bloque institucional (BLOQUES) corresponde un horario real,
 * comparando la hora de inicio en formato 24h. Si no coincide con ninguno
 * de los 6 bloques fijos (horario importado o creado fuera de la
 * plantilla), se descarta del grid — el grid solo puede mostrar los
 * bloques que sabe dibujar. */
function indiceBloque(horaInicio: string): number {
  return BLOQUES.findIndex((bloque) => bloque.horaInicio24 === horaInicio)
}

/** Convierte los horarios reales al grid institucional, conservando sus IDs
 * relacionales para mostrar las asignaciones existentes sin recrearlas. */
export function convertirHorariosAGrid(horarios: Horario[]): { bloques: BloqueClase[]; grid: GridAsignaciones } {
  const bloques: BloqueClase[] = []
  const grid: GridAsignaciones = BLOQUES.map(() => DIAS.map(() => null))

  for (const horario of horarios) {
    const idxBloque = indiceBloque(horario.horaInicio)
    if (idxBloque === -1) continue

    const bloqueClase: BloqueClase = {
      id: String(horario.idHorario),
      tematica: horario.resultadoCodigo ?? horario.resultadoDescripcion ?? 'Sin tema',
      instructor: horario.instructorNombre ?? 'Sin instructor',
      ficha: horario.fichaCodigo ?? 'Sin ficha',
      ambiente: horario.ambienteNombre ?? 'Sin ambiente',
      idResultado: horario.idResultado,
      idInstructor: horario.idInstructor,
      idFicha: horario.idFicha,
      idTrimestre: horario.idTrimestre,
      idAmbiente: horario.idAmbiente,
      idHorarioOriginal: horario.idHorario,
    }
    bloques.push(bloqueClase)

    for (const idDia of horario.dias) {
      const idxDia = indiceDia(idDia)
      if (idxDia >= 0 && idxDia < DIAS.length) {
        grid[idxBloque][idxDia] = bloqueClase.id
      }
    }
  }

  return { bloques, grid }
}
