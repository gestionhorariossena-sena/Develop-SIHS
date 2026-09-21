import { describe, expect, it } from 'vitest'
import { parsearCsv } from './csv'

describe('parsearCsv', () => {
  it('parsea encabezados y filas separados por coma', () => {
    const resultado = parsearCsv('codigo,nombre\nA1,Ana\nB2,Beto')

    expect(resultado.encabezados).toEqual(['codigo', 'nombre'])
    expect(resultado.filas).toEqual([
      { codigo: 'A1', nombre: 'Ana' },
      { codigo: 'B2', nombre: 'Beto' },
    ])
  })

  it('soporta campos entre comillas con comas adentro', () => {
    const resultado = parsearCsv('codigo,descripcion\nA1,"Análisis, Desarrollo y Software"')

    expect(resultado.filas).toEqual([{ codigo: 'A1', descripcion: 'Análisis, Desarrollo y Software' }])
  })

  it('soporta comillas escapadas ("") dentro de un campo entre comillas', () => {
    const resultado = parsearCsv('codigo,nota\nA1,"Dijo ""hola"""')

    expect(resultado.filas).toEqual([{ codigo: 'A1', nota: 'Dijo "hola"' }])
  })

  it('ignora líneas en blanco', () => {
    const resultado = parsearCsv('codigo,nombre\nA1,Ana\n\nB2,Beto\n')

    expect(resultado.filas).toHaveLength(2)
  })

  it('con un archivo vacío, devuelve encabezados y filas vacíos', () => {
    expect(parsearCsv('')).toEqual({ encabezados: [], filas: [] })
  })

  it('recorta espacios alrededor de cada valor', () => {
    const resultado = parsearCsv('codigo, nombre \n A1 , Ana ')

    expect(resultado.encabezados).toEqual(['codigo', 'nombre'])
    expect(resultado.filas).toEqual([{ codigo: 'A1', nombre: 'Ana' }])
  })
})
