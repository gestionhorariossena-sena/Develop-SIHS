import { describe, expect, it } from 'vitest'
import type { Horario } from '../../../../src/types/api'
import { indexarPorInstructor, opcionesFichaAmbiente } from '../../../../src/components/horario/indexarHorarios'

function horario(overrides: Partial<Horario>): Horario {
  return {
    idHorario: 1,
    horaInicio: '08:00',
    horaFin: '10:00',
    idJornada: 1,
    idTrimestre: 1,
    idAmbiente: 1,
    idInstructor: 'instructor-1',
    idFicha: 1,
    idResultado: 1,
    dias: [1],
    fechaCreacion: '2026-01-01',
    fechaModificacion: '2026-01-01',
    activo: true,
    publicado: true,
    instructorNombre: 'Carlos Pérez',
    fichaCodigo: '3037904',
    ambienteNombre: 'Ambiente 101',
    resultadoCodigo: 'RA1',
    resultadoDescripcion: 'Resultado de aprendizaje 1',
    ...overrides,
  }
}

describe('opcionesFichaAmbiente', () => {
  it('elimina fichas y ambientes repetidos y los ordena alfabéticamente', () => {
    // Arrange
    const horarios = [
      horario({ fichaCodigo: '3037904', ambienteNombre: 'Zeta' }),
      horario({ fichaCodigo: '3037904', ambienteNombre: 'Alfa' }),
      horario({ fichaCodigo: '2912345', ambienteNombre: 'Alfa' }),
    ]

    // Act
    const { fichas, ambientes } = opcionesFichaAmbiente(horarios)

    // Assert
    expect(fichas).toEqual(['2912345', '3037904'])
    expect(ambientes).toEqual(['Alfa', 'Zeta'])
  })

  it('no incluye fichas ni ambientes nulos o vacíos', () => {
    // Arrange
    const horarios = [
      horario({ fichaCodigo: null, ambienteNombre: null }),
      horario({ fichaCodigo: '3037904', ambienteNombre: 'Ambiente 101' }),
    ]

    // Act
    const { fichas, ambientes } = opcionesFichaAmbiente(horarios)

    // Assert
    expect(fichas).toEqual(['3037904'])
    expect(ambientes).toEqual(['Ambiente 101'])
  })

  it('devuelve listas vacías cuando no hay horarios', () => {
    // Arrange
    const horarios: Horario[] = []

    // Act
    const { fichas, ambientes } = opcionesFichaAmbiente(horarios)

    // Assert
    expect(fichas).toEqual([])
    expect(ambientes).toEqual([])
  })
})

describe('indexarPorInstructor', () => {
  it('agrupa las fichas y ambientes de un mismo instructor en una sola entrada', () => {
    // Arrange
    const horarios = [
      horario({ idInstructor: 'instructor-1', fichaCodigo: '3037904', ambienteNombre: 'Ambiente 101' }),
      horario({ idInstructor: 'instructor-1', fichaCodigo: '2912345', ambienteNombre: 'Ambiente 101' }),
      horario({ idInstructor: 'instructor-2', fichaCodigo: '3037904', ambienteNombre: 'Ambiente 202' }),
    ]

    // Act
    const indice = indexarPorInstructor(horarios)

    // Assert
    expect(indice.get('instructor-1')?.fichas).toEqual(new Set(['3037904', '2912345']))
    expect(indice.get('instructor-1')?.ambientes).toEqual(new Set(['Ambiente 101']))
    expect(indice.get('instructor-2')?.fichas).toEqual(new Set(['3037904']))
  })
})
