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
    expect(getUserFriendlyApiMessage(403)).toContain('No tienes permisos para realizar esta acción.')
  })

  // H-14: el `detail` del backend se mostraba tal cual para CUALQUIER
  // estado, así que un coordinador leía en pantalla el nombre de una
  // variable de entorno o un escueto "No autorizado".
  it('no muestra el detail técnico del backend en 401/403/503', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')

    expect(getUserFriendlyApiMessage(403, 'No autorizado', 'No autorizado')).toContain(
      'No tienes permisos',
    )
    expect(getUserFriendlyApiMessage(401, 'Token inválido o expirado', 'Token inválido o expirado')).toBe(
      'Tu sesión expiró. Inicia sesión nuevamente.',
    )

    const mensajeIA = getUserFriendlyApiMessage(
      503,
      undefined,
      'GEMINI_API_KEY no está configurada -- la capa de IA está apagada.',
    )
    expect(mensajeIA).toContain('El asistente con IA no está disponible')
    expect(mensajeIA).not.toContain('GEMINI_API_KEY')
  })

  // Encontrado en vivo el 2026-09-24: la clave de Gemini estaba bien
  // configurada, pero clasificar las 52 columnas de un Excel real tardaba
  // ~29s contra un timeout de 30s en el backend. El 503 que salía de ahí
  // decía "GEMINI", así que la pantalla mostraba "falta configurarlo en el
  // servidor" y mandaba al coordinador a reportar un problema inexistente.
  it('distingue por motivo quién puede arreglar un 503 de la IA', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')

    const porTimeout = getUserFriendlyApiMessage(503, undefined, {
      motivo: 'timeout',
      mensaje: 'Gemini no respondió en 90 segundos.',
    })
    expect(porTimeout).toContain('tardó demasiado')
    expect(porTimeout).not.toContain('falta configurarlo')
    expect(porTimeout).not.toContain('Gemini')

    const sinClave = getUserFriendlyApiMessage(503, undefined, {
      motivo: 'no_configurada',
      mensaje: 'GEMINI_API_KEY no está configurada -- la capa de IA está apagada.',
    })
    expect(sinClave).toContain('falta configurarlo en el servidor')
    expect(sinClave).not.toContain('GEMINI_API_KEY')

    const sinConexion = getUserFriendlyApiMessage(503, undefined, {
      motivo: 'conexion',
      mensaje: 'No se pudo contactar a Gemini: connection refused',
    })
    expect(sinConexion).toContain('No se pudo contactar')
    expect(sinConexion).not.toContain('falta configurarlo')
  })

  it('sí muestra el detail cuando está escrito para quien lo lee (400/404/409/422)', async () => {
    const { getUserFriendlyApiMessage } = await import('./api')

    expect(getUserFriendlyApiMessage(404, undefined, 'No existe una ficha con ese código')).toBe(
      'No existe una ficha con ese código',
    )
    expect(getUserFriendlyApiMessage(409, undefined, 'Ya hay una solicitud pendiente con ese correo.')).toBe(
      'Ya hay una solicitud pendiente con ese correo.',
    )
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
