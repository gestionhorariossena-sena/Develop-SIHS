import { describe, expect, it } from 'vitest'
import { ocupacionSemanalPorHora } from '../../../../src/pages/horario/ocupacionSemanal'
import type { DiaSemana, Horario } from '../../../../src/types/api'

const dias = [{ idDia: 1 }, { idDia: 2 }] as DiaSemana[]
const bloque = (idAmbiente: number, diasBloque: number[]) => ({
  idAmbiente,
  dias: diasBloque,
  horaInicio: '08:00:00',
  horaFin: '10:00:00',
}) as Horario

describe('ocupacionSemanalPorHora', () => {
  it('cuenta ambientes distintos del mismo día y toma el pico semanal', () => {
    const resultado = ocupacionSemanalPorHora([
      bloque(1, [1]), bloque(1, [1]), bloque(2, [2]),
    ], dias, 2)
    expect(resultado.find(({ hora }) => hora === 8)?.porcentaje).toBe(50)
    expect(resultado.find(({ hora }) => hora === 10)?.porcentaje).toBe(0)
  })

  it('nunca muestra más del 100 %', () => {
    const resultado = ocupacionSemanalPorHora([
      bloque(1, [1]), bloque(2, [1]), bloque(3, [1]),
    ], dias, 2)
    expect(resultado.find(({ hora }) => hora === 8)?.porcentaje).toBe(100)
  })
})
