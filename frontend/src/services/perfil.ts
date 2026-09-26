import { apiGet } from './api'
import type { Usuario } from '../types/api'

/**
 * `GET /usuarios/me` cacheado en memoria mientras dure la sesión.
 *
 * Nació con H-5 (roles declarados por ruta): ProtectedRoute necesita el
 * perfil ANTES de montar cada pantalla privada, así que sin caché cada
 * navegación pagaba un request extra y mostraba el "Cargando…" de pantalla
 * completa — un impuesto por cambiar de página que antes no existía. El
 * perfil casi no cambia durante una sesión, y cuando cambia (alguien te
 * asigna un rol) basta con recargar.
 *
 * El caché guarda la PROMESA, no el resultado: si dos componentes lo piden
 * a la vez en el primer render (ProtectedRoute y AppShell, siempre juntos),
 * comparten el mismo request en vez de disparar dos. Un fallo no se
 * memoriza: se limpia para que el siguiente intento vuelva a pedirlo.
 */
let cache: { idUsuario: string; perfil: Promise<Usuario> } | null = null

export function getPerfil(idUsuario: string): Promise<Usuario> {
  if (cache?.idUsuario === idUsuario) {
    return cache.perfil
  }

  const perfil = apiGet<Usuario>('/usuarios/me')
  perfil.catch(() => {
    if (cache?.idUsuario === idUsuario) cache = null
  })

  cache = { idUsuario, perfil }
  return perfil
}

/** Para después de cambiar algo que afecta al propio perfil (ej. asignarse
 * un rol). Cerrar sesión no necesita llamarlo: la clave es el id de la
 * persona, así que entrar con otra cuenta nunca lee el perfil de la
 * anterior. Los tests lo usan para arrancar cada caso sin caché. */
export function olvidarPerfil() {
  cache = null
}
