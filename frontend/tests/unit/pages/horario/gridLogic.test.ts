import { describe, expect, it } from 'vitest'
import { BLOQUES, DIAS } from '../../../../src/pages/horario/tipos'
import {
  asignarCelda,
  asignarRango,
  colorParaBloque,
  crearGridVacio,
  quitarBloqueDeGrid,
  quitarCelda,
  rangoRectangular,
} from '../../../../src/pages/horario/gridLogic'

describe('crearGridVacio', () => {
  it('crea un grid del tamaño BLOQUES x DIAS, todo sin asignar', () => {
    const grid = crearGridVacio()
    expect(grid).toHaveLength(BLOQUES.length)
    for (const fila of grid) {
      expect(fila).toHaveLength(DIAS.length)
      expect(fila.every((celda) => celda === null)).toBe(true)
    }
  })
})

describe('asignarCelda', () => {
  it('asigna el bloque solo en la celda indicada', () => {
    const grid = crearGridVacio()
    const resultado = asignarCelda(grid, { bloqueIdx: 1, diaIdx: 2 }, 'bloque-1')

    expect(resultado[1][2]).toBe('bloque-1')
    expect(resultado[0][2]).toBeNull()
    expect(resultado[1][3]).toBeNull()
  })

  it('no muta el grid original (inmutabilidad)', () => {
    const grid = crearGridVacio()
    asignarCelda(grid, { bloqueIdx: 0, diaIdx: 0 }, 'bloque-1')

    expect(grid[0][0]).toBeNull()
  })
})

describe('quitarCelda', () => {
  it('deja la celda en null aunque tuviera un bloque asignado', () => {
    const grid = asignarCelda(crearGridVacio(), { bloqueIdx: 0, diaIdx: 0 }, 'bloque-1')
    const resultado = quitarCelda(grid, { bloqueIdx: 0, diaIdx: 0 })

    expect(resultado[0][0]).toBeNull()
  })
})

describe('rangoRectangular', () => {
  it('devuelve una sola celda cuando desde y hasta son iguales', () => {
    const celdas = rangoRectangular({ bloqueIdx: 2, diaIdx: 3 }, { bloqueIdx: 2, diaIdx: 3 })
    expect(celdas).toEqual([{ bloqueIdx: 2, diaIdx: 3 }])
  })

  it('cubre todo el rectángulo entre dos esquinas, sin importar el orden', () => {
    const celdas = rangoRectangular({ bloqueIdx: 0, diaIdx: 0 }, { bloqueIdx: 1, diaIdx: 2 })

    expect(celdas).toEqual([
      { bloqueIdx: 0, diaIdx: 0 },
      { bloqueIdx: 0, diaIdx: 1 },
      { bloqueIdx: 0, diaIdx: 2 },
      { bloqueIdx: 1, diaIdx: 0 },
      { bloqueIdx: 1, diaIdx: 1 },
      { bloqueIdx: 1, diaIdx: 2 },
    ])
  })

  it('funciona igual si las esquinas se pasan en orden invertido', () => {
    const normal = rangoRectangular({ bloqueIdx: 0, diaIdx: 0 }, { bloqueIdx: 1, diaIdx: 1 })
    const invertido = rangoRectangular({ bloqueIdx: 1, diaIdx: 1 }, { bloqueIdx: 0, diaIdx: 0 })

    expect(invertido).toEqual(normal)
  })
})

describe('asignarRango', () => {
  it('asigna el mismo bloque a todas las celdas del rango', () => {
    const grid = crearGridVacio()
    const celdas = rangoRectangular({ bloqueIdx: 0, diaIdx: 0 }, { bloqueIdx: 0, diaIdx: 2 })
    const resultado = asignarRango(grid, celdas, 'bloque-1')

    expect(resultado[0][0]).toBe('bloque-1')
    expect(resultado[0][1]).toBe('bloque-1')
    expect(resultado[0][2]).toBe('bloque-1')
    expect(resultado[0][3]).toBeNull()
  })
})

describe('quitarBloqueDeGrid', () => {
  it('vacía solo las celdas que tenían ese bloque, deja las demás igual', () => {
    let grid = crearGridVacio()
    grid = asignarCelda(grid, { bloqueIdx: 0, diaIdx: 0 }, 'bloque-1')
    grid = asignarCelda(grid, { bloqueIdx: 1, diaIdx: 1 }, 'bloque-2')

    const resultado = quitarBloqueDeGrid(grid, 'bloque-1')

    expect(resultado[0][0]).toBeNull()
    expect(resultado[1][1]).toBe('bloque-2')
  })
})

describe('colorParaBloque', () => {
  it('es determinístico: el mismo id siempre da el mismo color', () => {
    expect(colorParaBloque('abc-123')).toEqual(colorParaBloque('abc-123'))
  })

  it('dos ids distintos normalmente caen en colores distintos', () => {
    expect(colorParaBloque('bloque-1')).not.toEqual(colorParaBloque('bloque-2'))
  })
})
