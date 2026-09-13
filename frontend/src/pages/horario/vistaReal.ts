import { crearGridVacio } from './gridLogic'
import { BLOQUES } from './tipos'
import type { BloqueClase, GridAsignaciones, Jornada } from './tipos'
import type { Horario } from '../../types/api'

const ORDEN_JORNADA: Jornada[] = ['Mañana', 'Tarde', 'Noche']

export interface VistaSemanal {
  bloques: BloqueClase[]
  grid: GridAsignaciones
  /** Horarios reales cuyo horaInicio/horaFin no calza con ninguno de los 6
   * bloques institucionales -- no se pueden dibujar en la grilla (mismo
   * caso que HistorialHorarios.tsx), pero sí cuentan para los cálculos
   * del panel lateral (horas, instructores, próxima clase). */
  sinUbicar: Horario[]
  /** Jornadas presentes en la grilla, en orden Mañana/Tarde/Noche -- para
   * el encabezado ("Jornada Diurna", "Mañana y Tarde", etc.). */
  jornadas: Jornada[]
}

/**
 * Convierte una lista de horarios reales (GET /horarios/, GET
 * /ficha-usuario/mi-horario) en el shape que espera `GridHorario`
 * (bloques + grid) -- generaliza `construirVistaClaseReal` de
 * HistorialHorarios.tsx para más de un horario a la vez. Reusable por
 * cualquier pantalla que necesite pintar horarios reales en la grilla
 * institucional (esta pantalla, y a futuro "Mi Horario" de instructor).
 */
export function construirVistaSemanal(horarios: Horario[]): VistaSemanal {
  const grid: GridAsignaciones = crearGridVacio()
  const bloques: BloqueClase[] = []
  const sinUbicar: Horario[] = []
  const jornadasPresentes = new Set<Jornada>()

  for (const horario of horarios) {
    const bloqueIdx = BLOQUES.findIndex(
      (b) => b.horaInicio24 === horario.horaInicio && b.horaFin24 === horario.horaFin,
    )

    if (bloqueIdx === -1) {
      sinUbicar.push(horario)
      continue
    }

    const id = `horario-${horario.idHorario}`
    const tematica = [horario.resultadoCodigo, horario.resultadoDescripcion].filter(Boolean).join(' — ') || 'Clase'
    bloques.push({
      id,
      tematica,
      instructor: horario.instructorNombre ?? '—',
      ficha: horario.fichaCodigo ?? '—',
      ambiente: horario.ambienteNombre ?? '—',
    })

    jornadasPresentes.add(BLOQUES[bloqueIdx].jornada)

    for (const dia of horario.dias) {
      const diaIdx = dia - 1
      if (diaIdx >= 0 && diaIdx < 6) grid[bloqueIdx][diaIdx] = id
    }
  }

  return {
    bloques,
    grid,
    sinUbicar,
    jornadas: ORDEN_JORNADA.filter((j) => jornadasPresentes.has(j)),
  }
}

/** Duración en horas de un rango "HH:MM:SS"-"HH:MM:SS". */
export function duracionHoras(horaInicio: string, horaFin: string): number {
  const [horaIni, minIni] = horaInicio.split(':').map(Number)
  const [horaFinN, minFin] = horaFin.split(':').map(Number)
  return horaFinN + minFin / 60 - (horaIni + minIni / 60)
}

export interface ProximaClase {
  horario: Horario
  fecha: Date
}

/**
 * Próxima ocurrencia entre todos los horarios: para cada (horario, día)
 * calcula la próxima fecha/hora futura (si hoy ya pasó esa hora, salta a
 * la semana siguiente) y devuelve la más cercana a `ahora`. `idDia` del
 * backend es 1=Lunes...6=Sábado, igual que `Date.getDay()` (0=Domingo,
 * 1=Lunes...6=Sábado) para ese mismo rango -- no hace falta offset.
 */
export function proximaClase(horarios: Horario[], ahora: Date): ProximaClase | null {
  let mejor: ProximaClase | null = null

  for (const horario of horarios) {
    const [horas, minutos] = horario.horaInicio.split(':').map(Number)

    for (const dia of horario.dias) {
      if (dia < 1 || dia > 6) continue

      const diasHasta = (dia - ahora.getDay() + 7) % 7
      const candidata = new Date(ahora)
      candidata.setDate(ahora.getDate() + diasHasta)
      candidata.setHours(horas, minutos, 0, 0)

      if (candidata.getTime() <= ahora.getTime()) {
        candidata.setDate(candidata.getDate() + 7)
      }

      if (!mejor || candidata.getTime() < mejor.fecha.getTime()) {
        mejor = { horario, fecha: candidata }
      }
    }
  }

  return mejor
}

/** "14h 22m" a partir de la diferencia entre dos fechas (nunca negativo). */
export function formatearCuentaRegresiva(desde: Date, hasta: Date): string {
  const totalMinutos = Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 60000))
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  if (horas === 0) return `${minutos}m`
  return `${horas}h ${minutos}m`
}
