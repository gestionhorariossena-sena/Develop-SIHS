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

  it('usa el mensaje por defecto (no uno vacío) cuando el fallback es string vacío — HTTP/2 deja statusText vacío', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')
    expect(getUserFriendlyApiMessage(409, '')).toBe(
      'Hay un conflicto con los datos actuales. Revisa la información e inténtalo otra vez.',
    )
    expect(getUserFriendlyApiMessage(422, '')).toBe(
      'Los datos enviados no son válidos. Revisa la información antes de guardar.',
    )
  })
})
