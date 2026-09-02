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
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (session) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const detail = body?.detail
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

export const apiGet = <T>(path: string) => request<T>(path)

export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })

export const apiPut = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined })

export const apiDelete = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined })
