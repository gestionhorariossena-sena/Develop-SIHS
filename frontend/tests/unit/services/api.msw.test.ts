import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Semana 5 — Edith: dobles de prueba para el cliente HTTP real
 * (`src/services/api.ts`) contra la dependencia externa que SÍ está fuera
 * del control del proyecto: la red/el backend FastAPI.
 *
 * Tipo de doble: MSW actúa como un FAKE en la frontera externa -- un
 * servidor HTTP de mentira que intercepta `fetch` de verdad y responde
 * como si fuera el backend, sin levantar FastAPI ni tocar la red real.
 * En los dos primeros tests también se usa como SPY (se captura qué
 * encabezados mandó el cliente) para comprobar comportamiento, no solo
 * estado.
 *
 * No duplica tests/unit/services/api.test.ts (ese cubre
 * getUserFriendlyApiMessage en aislado y UN solo caso de apiGet -- el
 * cuelgue de supabase.auth.getSession() con fetch mockeado a mano). Acá
 * se prueba el contrato HTTP de punta a punta: 200, 500, 422 y una
 * respuesta que NO es JSON, además de si el token viaja o no según haya
 * sesión.
 */

vi.mock('../../../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

// Coincide con `VITE_API_URL` de frontend/.env -- api.ts solo cae al
// 8001 hardcodeado si esa variable no está definida, y en este repo sí lo
// está.
const API_URL = 'http://127.0.0.1:8000/api/v1'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.resetModules()
})
afterAll(() => server.close())

async function conSesion(token: string | null) {
  const { supabase } = await import('../../../src/services/supabaseClient')
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: token ? ({ access_token: token } as never) : null },
  } as never)
}

describe('apiGet/apiPost contra un doble de red (MSW)', () => {
  it('200 feliz: devuelve el JSON tal cual y manda el token real como Authorization', async () => {
    await conSesion('token-de-prueba')

    let encabezadoAutorizacion: string | null = null
    server.use(
      http.get(`${API_URL}/horarios/`, ({ request }) => {
        encabezadoAutorizacion = request.headers.get('Authorization')
        return HttpResponse.json([{ idHorario: 1, publicado: true }])
      }),
    )

    const { apiGet } = await import('../../../src/services/api')
    const resultado = await apiGet('/horarios/')

    // Estado/resultado: el cliente no transforma el cuerpo, lo devuelve tal cual.
    expect(resultado).toEqual([{ idHorario: 1, publicado: true }])
    // Comportamiento: el header que de verdad viajó a la "red" es el Bearer real.
    expect(encabezadoAutorizacion).toBe('Bearer token-de-prueba')
  })

  it('sin sesión activa no manda el encabezado Authorization', async () => {
    await conSesion(null)

    let llegoConAuthorization = true
    server.use(
      http.get(`${API_URL}/avisos/`, ({ request }) => {
        llegoConAuthorization = request.headers.has('Authorization')
        return HttpResponse.json([])
      }),
    )

    const { apiGet } = await import('../../../src/services/api')
    await apiGet('/avisos/')

    // Comportamiento: sin sesión, el cliente no debe inventar ni reusar un token viejo.
    expect(llegoConAuthorization).toBe(false)
  })

  it('500 con detail: lanza ApiError con el mensaje genérico de servidor, no el detail crudo', async () => {
    await conSesion(null)

    server.use(
      http.get(`${API_URL}/horarios/`, () =>
        HttpResponse.json({ detail: 'Fallo interno no documentado para mostrar' }, { status: 500 }),
      ),
    )

    const { apiGet, ApiError } = await import('../../../src/services/api')
    const error = await apiGet('/horarios/').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as InstanceType<typeof ApiError>).status).toBe(500)
    expect((error as Error).message).toBe('El servidor tuvo un problema. Inténtalo de nuevo en unos segundos.')
  })

  it('422 con detail de negocio: el mensaje mostrado es el detail real del backend', async () => {
    await conSesion(null)

    server.use(
      http.post(`${API_URL}/solicitudes-acceso/`, () =>
        HttpResponse.json({ detail: 'Ya existe una solicitud pendiente con ese correo' }, { status: 422 }),
      ),
    )

    const { apiPost, ApiError } = await import('../../../src/services/api')
    const error = await apiPost('/solicitudes-acceso/', { email: 'x@sena.edu.co' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as InstanceType<typeof ApiError>).status).toBe(422)
    expect((error as Error).message).toBe('Ya existe una solicitud pendiente con ese correo')
  })

  it('respuesta no-JSON (ej. página de error de un proxy): no revienta, cae a un ApiError con el estado real', async () => {
    await conSesion(null)

    server.use(
      http.get(`${API_URL}/horarios/`, () =>
        new HttpResponse('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    )

    const { apiGet, ApiError } = await import('../../../src/services/api')
    const error = await apiGet('/horarios/').catch((e: unknown) => e)

    // No debe salir un SyntaxError de JSON.parse sin capturar -- el
    // cliente ya previene esto con `.catch(() => null)` en request().
    expect(error).toBeInstanceOf(ApiError)
    expect((error as InstanceType<typeof ApiError>).status).toBe(502)
    expect((error as Error).message).toBe(
      'La respuesta del servidor tardó demasiado o no está disponible en este momento. Verifica tu conexión e inténtalo otra vez.',
    )
  })
})
