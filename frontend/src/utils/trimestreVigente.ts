import type { Trimestre } from '../types/api'

/** Fecha local del navegador, sin convertir a UTC (evita desfases de día). */
export function fechaLocalISO(ahora: Date = new Date()): string {
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Solo es vigente si está activo administrativamente Y cubre la fecha. */
export function trimestreVigente(trimestres: Trimestre[], fecha = fechaLocalISO()): Trimestre | null {
  const candidatos = trimestres.filter(
    (trimestre) =>
      trimestre.estado === 'activo' &&
      trimestre.fechaInicio <= fecha &&
      fecha <= trimestre.fechaFin,
  )
  // Evita elegir arbitrariamente cuando hay varios períodos activos solapados.
  return candidatos.length === 1 ? candidatos[0] : null
}

export function avisoTrimestres(trimestres: Trimestre[], fecha = fechaLocalISO()): string | null {
  if (trimestres.length === 0) return 'No hay períodos académicos registrados. Solicita su configuración antes de programar.'
  const vigentes = trimestres.filter(
    (trimestre) =>
      trimestre.estado === 'activo' &&
      trimestre.fechaInicio <= fecha &&
      fecha <= trimestre.fechaFin,
  )
  if (vigentes.length > 1) return 'Hay varios períodos activos para la fecha actual. Selecciona el período de trabajo y solicita revisar su configuración.'
  if (vigentes.length === 1) return null
  return 'No existe un período activo que incluya la fecha actual. Selecciona explícitamente un período para consultar o planear; verifica sus fechas antes de guardar.'
}
