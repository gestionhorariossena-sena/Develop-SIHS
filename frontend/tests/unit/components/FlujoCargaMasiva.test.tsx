import { describe, expect, it, vi } from 'vitest'
import { ejecutarCargaMasiva } from '../../../src/components/cargaMasiva/utilidadesCargaMasiva'

describe('ejecutarCargaMasiva', () => {
  it('continúa tras una fila inválida y notifica el progreso con resultados independientes', async () => {
    const guardar = vi.fn(async (fila: string) => {
      if (fila === 'B') throw new Error('Registro duplicado.')
    })
    const progreso = vi.fn()
    const resultado = await ejecutarCargaMasiva(['A', 'B', 'C'], guardar, progreso, fila => fila)

    expect(guardar).toHaveBeenCalledTimes(3)
    expect(resultado.map(r => r.ok)).toEqual([true, false, true])
    expect(resultado[1]).toMatchObject({ fila: 3, etiqueta: 'B', mensaje: 'Registro duplicado.' })
    expect(progreso).toHaveBeenCalledTimes(3)
    expect(progreso.mock.calls[0][0]).toHaveLength(1)
    expect(progreso.mock.calls[2][0]).toHaveLength(3)
    expect(progreso.mock.calls[0][0]).not.toBe(progreso.mock.calls[2][0])
  })

  it('no hace llamadas si la vista previa no contiene filas', async () => {
    const guardar = vi.fn()
    const progreso = vi.fn()
    expect(await ejecutarCargaMasiva([], guardar, progreso, () => 'sin etiqueta')).toEqual([])
    expect(guardar).not.toHaveBeenCalled()
    expect(progreso).not.toHaveBeenCalled()
  })
})
