import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

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

describe('apiGet — timeout cuando supabase.auth.getSession() se cuelga', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'example-key')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('corta con ApiError 504 en vez de quedarse pending para siempre', async () => {
    // Reproduce el bug real (2026-09-14, HorariosCompletos.tsx): antes,
    // `getSession()` corría FUERA del AbortController/timeout -- si esa
    // llamada nunca resolvía (Supabase intentando refrescar un token
    // vencido sin éxito), el fetch real nunca se disparaba y la promesa
    // de `request()` quedaba pending para siempre, sin importar
    // `timeoutMs`. Se simula con una promesa de getSession() que nunca
    // se resuelve, y se verifica que el timeout SÍ corta la espera.
    const { supabase } = await import('./supabaseClient')
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as never)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { apiGet, ApiError } = await import('./api')
    const promesa = apiGet('/horarios/')

    let error: unknown
    promesa.catch((e: unknown) => {
      error = e
    })

    await vi.advanceTimersByTimeAsync(20000)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as InstanceType<typeof ApiError>).status).toBe(504)
    // El fetch real nunca debió dispararse -- la espera de sesión ya
    // estaba colgada antes de llegar ahí.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
