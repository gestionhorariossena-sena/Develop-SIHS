import { beforeEach, describe, expect, it } from 'vitest'
import { authStorage, configurarRecordarme } from './authStorage'

describe('almacenamiento de la sesión', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('conserva las sesiones persistentes que ya tenían los usuarios', () => {
    localStorage.setItem('auth-token', 'sesion-existente')
    expect(authStorage.getItem('auth-token')).toBe('sesion-existente')
  })

  it('sin Recordarme guarda el token solo durante la sesión de la pestaña', () => {
    localStorage.setItem('auth-token', 'sesion-anterior')
    configurarRecordarme(false)
    authStorage.setItem('auth-token', 'sesion-nueva')

    expect(sessionStorage.getItem('auth-token')).toBe('sesion-nueva')
    expect(localStorage.getItem('auth-token')).toBeNull()
    expect(authStorage.getItem('auth-token')).toBe('sesion-nueva')

    sessionStorage.clear()
    expect(authStorage.getItem('auth-token')).toBeNull()
  })

  it('con Recordarme vuelve a persistir y limpia la copia temporal', () => {
    configurarRecordarme(false)
    authStorage.setItem('auth-token', 'temporal')
    configurarRecordarme(true)
    authStorage.setItem('auth-token', 'persistente')

    expect(localStorage.getItem('auth-token')).toBe('persistente')
    expect(sessionStorage.getItem('auth-token')).toBeNull()
    authStorage.removeItem('auth-token')
    expect(localStorage.getItem('auth-token')).toBeNull()
    expect(sessionStorage.getItem('auth-token')).toBeNull()
  })
})
