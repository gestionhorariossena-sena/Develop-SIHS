import type { DiaSemana, Horario } from '../../types/api'

const HORAS_OCUPACION = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 21]

/** Pico semanal por hora: un ambiente cuenta una sola vez por día. */
export function ocupacionSemanalPorHora(horarios: Horario[], dias: DiaSemana[], totalAmbientes: number) {
  if (totalAmbientes === 0) return []
  return HORAS_OCUPACION.map((hora) => {
    const pico = Math.max(0, ...dias.map((dia) => new Set(
      horarios.filter((h) => h.dias.includes(dia.idDia) &&
        Number(h.horaInicio.slice(0, 2)) <= hora && hora < Number(h.horaFin.slice(0, 2)))
        .map((h) => h.idAmbiente),
    ).size))
    return { hora, porcentaje: Math.round((Math.min(pico, totalAmbientes) / totalAmbientes) * 100) }
  })
}
