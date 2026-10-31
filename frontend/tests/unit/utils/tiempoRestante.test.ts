import { describe, expect, it } from 'vitest'
import { formatearTiempoRestante } from '../../../src/utils/tiempoRestante'

/**
 * Unitarias semana 1 (Edith): regla de negocio real usada en el mensaje de
 * bloqueo del login (RNF-06, bloqueo tras 3 intentos fallidos) — cuántos
 * minutos le quedan a la persona antes de poder reintentar.
 */
describe('formatearTiempoRestante', () => {
  it('redondea hacia arriba y dice "menos de 1 minuto" cuando falta 1 minuto o menos', () => {
    // Arrange
    const segundos = 30

    // Act
    const resultado = formatearTiempoRestante(segundos)

    // Assert
    expect(resultado).toBe('menos de 1 minuto')
  })

  it('redondea segundos sueltos hacia el minuto completo siguiente', () => {
    // Arrange
    const segundos = 61

    // Act
    const resultado = formatearTiempoRestante(segundos)

    // Assert
    expect(resultado).toBe('2 minutos')
  })

  it('muestra el plural correcto para un número exacto de minutos', () => {
    // Arrange
    const segundos = 300

    // Act
    const resultado = formatearTiempoRestante(segundos)

    // Assert
    expect(resultado).toBe('5 minutos')
  })

  it('trata 0 segundos como "menos de 1 minuto", no como "0 minutos"', () => {
    // Arrange
    const segundos = 0

    // Act
    const resultado = formatearTiempoRestante(segundos)

    // Assert
    expect(resultado).toBe('menos de 1 minuto')
  })
})
