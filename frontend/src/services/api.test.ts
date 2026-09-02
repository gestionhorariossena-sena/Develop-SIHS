import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('getUserFriendlyApiMessage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'example-key')
  })

  it('devuelve mensaje claro para errores del servidor', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')
    expect(getUserFriendlyApiMessage(500)).toBe('El servidor tuvo un problema. Inténtalo de nuevo en unos segundos.')
  })

  it('devuelve mensaje claro para timeout o respuesta lenta', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')
    expect(getUserFriendlyApiMessage(504)).toBe(
      'La respuesta del servidor tardó demasiado o no está disponible en este momento. Verifica tu conexión e inténtalo otra vez.',
    )
  })

  it('mantiene el manejo de permisos', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')
    expect(getUserFriendlyApiMessage(403)).toBe('No tienes permisos para realizar esta acción.')
  })
})
