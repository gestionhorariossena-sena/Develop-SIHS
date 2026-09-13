import { describe, expect, it } from 'vitest'
import type { Horario } from '../../types/api'
import { BLOQUES, DIAS } from './tipos'
import {
  construirVistaSemanal,
  duracionHoras,
  formatearCuentaRegresiva,
  proximaClase,
} from './vistaReal'

function horario(overrides: Partial<Horario> = {}): Horario {
  return {
    idHorario: 1,
    horaInicio: '06:15:00',
    horaFin: '09:00:00',
    idJornada: 1,
    idTrimestre: 1,
    idAmbiente: 1,
    idInstructor: 'instructor-1',
    idFicha: 1,
    idResultado: 1,
    dias: [1],
    instructorNombre: 'Carlos López',
    fichaCodigo: '2874521',
    ambienteNombre: 'Ambiente 302',
    resultadoCodigo: 'RA-1',
    resultadoDescripcion: 'Bases de datos',
    ...overrides,
  }
}

describe('construirVistaSemanal', () => {
  it('ubica un horario que calza con un bloque institucional en la celda correcta', () => {
    const vista = construirVistaSemanal([horario({ idHorario: 100, dias: [1, 3] })])

    expect(vista.sinUbicar).toHaveLength(0)
    expect(vista.bloques).toHaveLength(1)
    expect(vista.grid[0][0]).toBe('horario-100') // Lunes
    expect(vista.grid[0][2]).toBe('horario-100') // Miércoles
    expect(vista.grid[0][1]).toBeNull()
    expect(vista.jornadas).toEqual(['Mañana'])
  })

  it('un horario cuyo rango no calza con ningún bloque institucional va a sinUbicar', () => {
    const vista = construirVistaSemanal([horario({ horaInicio: '07:00:00', horaFin: '08:30:00' })])

    expect(vista.sinUbicar).toHaveLength(1)
    expect(vista.bloques).toHaveLength(0)
    expect(vista.grid.every((fila) => fila.every((celda) => celda === null))).toBe(true)
  })

  it('acumula las jornadas de varios horarios sin duplicar y en orden Mañana/Tarde/Noche', () => {
    const vista = construirVistaSemanal([
      horario({ idHorario: 1, horaInicio: '18:00:00', horaFin: '20:00:00' }),
      horario({ idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00' }),
      horario({ idHorario: 3, horaInicio: '09:00:00', horaFin: '12:00:00' }),
    ])

    expect(vista.jornadas).toEqual(['Mañana', 'Noche'])
  })

  it('grid vacío tiene el tamaño BLOQUES x DIAS cuando no hay horarios', () => {
    const vista = construirVistaSemanal([])

    expect(vista.grid).toHaveLength(BLOQUES.length)
    expect(vista.grid[0]).toHaveLength(DIAS.length)
  })
})

describe('duracionHoras', () => {
  it('calcula la duración en horas de un rango', () => {
    expect(duracionHoras('06:15:00', '09:00:00')).toBeCloseTo(2.75)
    expect(duracionHoras('08:00:00', '10:00:00')).toBe(2)
  })
})

describe('proximaClase', () => {
  it('elige la ocurrencia más cercana en el futuro dentro de la misma semana', () => {
    // Lunes 2026-01-05 08:00 (getDay() === 1)
    const ahora = new Date(2026, 0, 5, 8, 0, 0)
    const claseLunesTarde = horario({ idHorario: 1, horaInicio: '10:00:00', horaFin: '12:00:00', dias: [1] })
    const claseMiercoles = horario({ idHorario: 2, horaInicio: '06:00:00', horaFin: '08:00:00', dias: [3] })

    const resultado = proximaClase([claseMiercoles, claseLunesTarde], ahora)

    expect(resultado?.horario.idHorario).toBe(1)
    expect(resultado?.fecha.getDate()).toBe(5)
    expect(resultado?.fecha.getHours()).toBe(10)
  })

  it('si la hora de hoy ya pasó, salta a la semana siguiente', () => {
    // Lunes 2026-01-05 08:00, la única clase del lunes es a las 06:00 (ya pasó)
    const ahora = new Date(2026, 0, 5, 8, 0, 0)
    const clase = horario({ idHorario: 1, horaInicio: '06:00:00', horaFin: '08:00:00', dias: [1] })

    const resultado = proximaClase([clase], ahora)

    expect(resultado?.fecha.getDate()).toBe(12) // lunes siguiente
  })

  it('devuelve null si no hay horarios', () => {
    expect(proximaClase([], new Date())).toBeNull()
  })
})

describe('formatearCuentaRegresiva', () => {
  it('formatea horas y minutos', () => {
    const desde = new Date(2026, 0, 5, 8, 0, 0)
    const hasta = new Date(2026, 0, 5, 22, 22, 0)
    expect(formatearCuentaRegresiva(desde, hasta)).toBe('14h 22m')
  })

  it('formatea solo minutos cuando falta menos de una hora', () => {
    const desde = new Date(2026, 0, 5, 8, 0, 0)
    const hasta = new Date(2026, 0, 5, 8, 30, 0)
    expect(formatearCuentaRegresiva(desde, hasta)).toBe('30m')
  })

  it('nunca devuelve negativo', () => {
    const desde = new Date(2026, 0, 5, 8, 30, 0)
    const hasta = new Date(2026, 0, 5, 8, 0, 0)
    expect(formatearCuentaRegresiva(desde, hasta)).toBe('0m')
  })
})
