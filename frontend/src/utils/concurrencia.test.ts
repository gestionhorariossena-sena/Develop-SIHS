import { describe, expect, it } from 'vitest'

import { mapearConLimite } from './concurrencia'

describe('mapearConLimite', () => {
  it('nunca pasa del límite de peticiones en vuelo', async () => {
    let enVuelo = 0
    let maximoVisto = 0

    await mapearConLimite(Array.from({ length: 20 }, (_, i) => i), 6, async (n) => {
      enVuelo++
      maximoVisto = Math.max(maximoVisto, enVuelo)
      await new Promise((r) => setTimeout(r, 1))
      enVuelo--
      return n
    })

    expect(maximoVisto).toBeLessThanOrEqual(6)
    expect(maximoVisto).toBeGreaterThan(1) // y sí paraleliza, no va de a uno
  })

  it('devuelve los resultados en el orden de entrada, no en el de llegada', async () => {
    // El primero tarda más que todos los demás a propósito: si el orden
    // saliera por llegada, quedaría al final.
    const resultados = await mapearConLimite([50, 1, 1, 1], 4, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms))
      return i
    })

    expect(resultados).toEqual([0, 1, 2, 3])
  })

  it('procesa todos los elementos aunque haya menos que el límite', async () => {
    const resultados = await mapearConLimite([1, 2, 3], 10, async (n) => n * 2)

    expect(resultados).toEqual([2, 4, 6])
  })

  it('con lista vacía no hace nada y no se cuelga', async () => {
    expect(await mapearConLimite([], 6, async (n) => n)).toEqual([])
  })
})
