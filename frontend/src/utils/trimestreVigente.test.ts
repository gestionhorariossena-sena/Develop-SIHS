import { describe, expect, it } from 'vitest'
import type { Trimestre } from '../types/api'
import { avisoTrimestres, fechaLocalISO, trimestreVigente } from './trimestreVigente'

const historico: Trimestre = {
  idTrimestre: 1, nombre: 'Histórico', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo',
}
const vigente: Trimestre = {
  idTrimestre: 2, nombre: 'Vigente', fechaInicio: '2026-07-01', fechaFin: '2026-09-30', estado: 'activo',
}

describe('selección de período académico', () => {
  it('no interpreta el estado activo de un período vencido como vigencia actual', () => {
    expect(trimestreVigente([historico], '2026-09-28')).toBeNull()
    expect(avisoTrimestres([historico], '2026-09-28')).toMatch(/No existe un período activo/)
  })

  it('elige únicamente el período activo cuyas fechas incluyen el día', () => {
    expect(trimestreVigente([historico, vigente], '2026-09-28')?.idTrimestre).toBe(2)
    expect(avisoTrimestres([historico, vigente], '2026-09-28')).toBeNull()
    expect(trimestreVigente([vigente], '2026-09-30')?.idTrimestre).toBe(2)
    expect(trimestreVigente([vigente], '2026-10-01')).toBeNull()
  })

  it('no elige arbitrariamente períodos activos solapados ni uno planeado', () => {
    const repetido = { ...vigente, idTrimestre: 3 }
    expect(trimestreVigente([vigente, repetido], '2026-09-28')).toBeNull()
    expect(avisoTrimestres([vigente, repetido], '2026-09-28')).toMatch(/varios períodos/)
    expect(trimestreVigente([{ ...vigente, estado: 'planeado' }], '2026-09-28')).toBeNull()
  })

  it('formatea la fecha de calendario local y no la convierte a UTC', () => {
    expect(fechaLocalISO(new Date(2026, 8, 28))).toBe('2026-09-28')
  })
})
