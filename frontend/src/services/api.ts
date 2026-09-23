import { supabase } from './supabaseClient'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8001/api/v1'
const TIMEOUT_MS = 15000

export function getUserFriendlyApiMessage(status: number, fallback?: string, detail?: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail

  switch (status) {
    case 401:
      return 'Tu sesión expiró. Inicia sesión nuevamente.'
    case 403:
      return 'No tienes permisos para realizar esta acción.'
    case 404:
      return 'No se encontró la información solicitada.'
    case 409:
      // `fallback` puede venir de `response.statusText`, que HTTP/2 deja
      // vacío por spec — `??` no lo captura (solo null/undefined), así que
      // sin el `||` un 409/422 por HTTP/2 mostraba mensaje en blanco.
      return fallback || 'Hay un conflicto con los datos actuales. Revisa la información e inténtalo otra vez.'
    case 422:
      return fallback || 'Los datos enviados no son válidos. Revisa la información antes de guardar.'
    case 500:
      return 'El servidor tuvo un problema. Inténtalo de nuevo en unos segundos.'
    case 502:
    case 503:
    case 504:
      return 'La respuesta del servidor tardó demasiado o no está disponible en este momento. Verifica tu conexión e inténtalo otra vez.'
    default:
      return fallback || 'No se pudo completar la solicitud. Inténtalo nuevamente.'
  }
}

export class ApiError extends Error {
  status: number
  /** El campo "detail" crudo de FastAPI — a veces es un string, a veces un
   * objeto (ej. `{ mensajes: string[] }` en los 409 de cruce de horarios). */
  detail: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

/**
 * Todas las llamadas al backend pasan por aquí. Se encarga de:
 *  1. Tomar el token de la sesión actual de Supabase (la que crea Login.tsx
 *     al iniciar sesión) y mandarlo como "Authorization: Bearer <token>".
 *  2. Convertir una respuesta no-2xx en un ApiError con un mensaje útil para
 *     el usuario cuando el backend falla por permisos, validación o problemas
 *     del servidor.
 *
 * Para consumir un endpoint nuevo del backend, NO hace falta tocar este
 * archivo — solo llamar a apiGet/apiPost/etc. con la ruta, igual que en
 * Dashboard.tsx. Ver frontend/ESTRUCTURA.md para más detalle.
 */
async function request<T>(path: string, options: RequestInit = {}, timeoutMs: number = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    // `supabase.auth.getSession()` antes vivía FUERA de este try/timeout —
    // si esa llamada se colgaba (ej. Supabase intentando refrescar un
    // access token vencido y la red tardando o fallando en silencio), el
    // fetch de verdad nunca llegaba a dispararse: el AbortController se
    // creaba DESPUÉS de esa espera, así que `timeoutMs` no protegía nada
    // todavía. El resultado, visto en vivo el 2026-09-14: la petición se
    // quedaba "pending" para siempre en el navegador (nunca llegaba ni
    // siquiera al log del backend), mientras OTRA petición en la misma
    // pantalla sí completaba su timeout real y mostraba el mensaje 504 —
    // dando la falsa impresión de "el servidor tardó" cuando el servidor
    // nunca había recibido nada. Ahora la espera de sesión corre bajo el
    // mismo `controller.signal`: si se cuelga, el timeout la corta igual
    // que cortaría un fetch lento.
    const sesionAbortada = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    const {
      data: { session },
    } = await Promise.race([supabase.auth.getSession(), sesionAbortada])

    const headers = new Headers(options.headers)
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (session) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      // No todos los 409 vienen envueltos en {"detail": ...} (el
      // convencional de FastAPI vía HTTPException) — el dry-run de
      // horarios (POST /horarios/validar) devuelve el cuerpo entero al
      // nivel raíz (ok/puedeGuardar/conflictos/...), sin esa clave. Sin
      // este fallback, `detail` quedaba `undefined` y se perdían los
      // conflictos que ModalCruce necesita mostrar.
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : body
      const fallback = typeof detail === 'string' ? detail : response.statusText
      throw new ApiError(response.status, getUserFriendlyApiMessage(response.status, fallback, detail), detail)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(504, getUserFriendlyApiMessage(504), null)
    }

    if (error instanceof TypeError) {
      throw new ApiError(503, getUserFriendlyApiMessage(503), null)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const apiGet = <T>(path: string, timeoutMs?: number) => request<T>(path, {}, timeoutMs)

// `timeoutMs` opcional: el default (15s) alcanza para el CRUD normal, pero
// se queda corto para endpoints que dependen de una llamada real a IA o de
// resolver un modelo de optimización (el asistente de programación) --
// esas pasan su propio timeout más generoso en vez de tocar el default acá.
export const apiPost = <T>(path: string, body?: unknown, timeoutMs?: number) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, timeoutMs)

/** Para endpoints con UploadFile (multipart) -- `request()` ya detecta
 * FormData y no le pone Content-Type: JSON (el navegador arma el
 * boundary del multipart solo). No usar apiPost acá: haría
 * JSON.stringify(FormData) y se perdería el archivo. */
export const apiPostForm = <T>(path: string, formData: FormData, timeoutMs?: number) =>
  request<T>(path, { method: 'POST', body: formData }, timeoutMs)

export const apiPut = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined })

export const apiPatch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })

export const apiDelete = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined })
