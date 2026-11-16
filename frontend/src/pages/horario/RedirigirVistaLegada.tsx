import { Navigate, useLocation } from 'react-router-dom'
import { escribirGestionarHorariosQuery, normalizarRutaHorarioLegada } from './gestionarHorariosQuery'

/**
 * Fase 3: /vista-fichas, /vista-instructores y /vista-ambientes ya no
 * renderizan una pantalla propia -- redirigen a la experiencia unificada
 * (`/horarios/completos`) traduciendo su `?id=` legado a la perspectiva y
 * al parámetro canónico correspondientes (`normalizarRutaHorarioLegada`),
 * para no romper los links que ya apuntan a ellas (Instructores.tsx,
 * Ambientes.tsx, Fichas.tsx).
 */
export function RedirigirVistaLegada() {
  const { pathname, search } = useLocation()
  const query = normalizarRutaHorarioLegada(pathname, new URLSearchParams(search))
  const destino = query ? `/horarios/completos?${escribirGestionarHorariosQuery(query).toString()}` : '/horarios/completos'
  return <Navigate to={destino} replace />
}
