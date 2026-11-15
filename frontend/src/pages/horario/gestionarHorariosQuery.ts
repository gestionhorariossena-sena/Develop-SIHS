/**
 * Contrato de URL de la experiencia unificada de Gestionar horarios.
 *
 * Fase 2: `HorariosCompletos` ya lo consume para las cuatro perspectivas
 * (Bloques/Por ficha/Por instructor/Por ambiente), compartiendo filtros y
 * drawer vía URL canónica. `/vista-fichas`, `/vista-instructores` y
 * `/vista-ambientes` siguen existiendo como rutas propias (ver
 * `normalizarRutaHorarioLegada`); redirigirlas a la ruta canónica es Fase 3,
 * todavía sin activar.
 */
export const PERSPECTIVAS_HORARIOS = ['bloques', 'ficha', 'instructor', 'ambiente'] as const
export const VISTAS_HORARIOS = ['lista', 'calendario', 'conflictos'] as const
export const JORNADAS_QUERY = ['manana', 'tarde', 'noche'] as const
export const ESTADOS_PUBLICACION_QUERY = ['publicado', 'borrador'] as const

export type PerspectivaHorario = (typeof PERSPECTIVAS_HORARIOS)[number]
export type VistaHorario = (typeof VISTAS_HORARIOS)[number]
export type JornadaQuery = (typeof JORNADAS_QUERY)[number]
export type EstadoPublicacionQuery = (typeof ESTADOS_PUBLICACION_QUERY)[number]

export interface GestionarHorariosQuery {
  perspectiva: PerspectivaHorario
  vista: VistaHorario
  idHorario?: string
  idFicha?: string
  idInstructor?: string
  idAmbiente?: string
  q?: string
  jornada?: JornadaQuery
  idTrimestre?: string
  estado?: EstadoPublicacionQuery
  pagina: number
}

const DEFAULT_QUERY: GestionarHorariosQuery = {
  perspectiva: 'bloques',
  vista: 'lista',
  pagina: 1,
}

function enumQuery<T extends string>(valor: string | null, valores: readonly T[]): T | undefined {
  return valor !== null && valores.includes(valor as T) ? valor as T : undefined
}

function textoQuery(valor: string | null): string | undefined {
  const limpio = valor?.trim()
  return limpio || undefined
}

function paginaQuery(valor: string | null): number {
  const pagina = Number(valor)
  return Number.isInteger(pagina) && pagina > 0 ? pagina : DEFAULT_QUERY.pagina
}

/** Lee parámetros canónicos y descarta valores inválidos en vez de dejar una
 * URL rota. Los IDs son strings porque instructor usa UUID y los demás IDs
 * numéricos; la capa de datos valida el tipo al consultar. */
export function leerGestionarHorariosQuery(params: URLSearchParams): GestionarHorariosQuery {
  return {
    perspectiva: enumQuery(params.get('perspectiva'), PERSPECTIVAS_HORARIOS) ?? DEFAULT_QUERY.perspectiva,
    vista: enumQuery(params.get('vista'), VISTAS_HORARIOS) ?? DEFAULT_QUERY.vista,
    idHorario: textoQuery(params.get('idHorario')),
    idFicha: textoQuery(params.get('idFicha')),
    idInstructor: textoQuery(params.get('idInstructor')),
    idAmbiente: textoQuery(params.get('idAmbiente')),
    q: textoQuery(params.get('q')),
    jornada: enumQuery(params.get('jornada'), JORNADAS_QUERY),
    idTrimestre: textoQuery(params.get('idTrimestre')),
    estado: enumQuery(params.get('estado'), ESTADOS_PUBLICACION_QUERY),
    pagina: paginaQuery(params.get('pagina')),
  }
}

/** Serializa de forma estable: no publica defaults, por lo que las URLs
 * generales quedan cortas y copiar/pegar preserva solo estado significativo. */
export function escribirGestionarHorariosQuery(query: GestionarHorariosQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.perspectiva !== DEFAULT_QUERY.perspectiva) params.set('perspectiva', query.perspectiva)
  if (query.vista !== DEFAULT_QUERY.vista) params.set('vista', query.vista)
  if (query.idHorario) params.set('idHorario', query.idHorario)
  if (query.idFicha) params.set('idFicha', query.idFicha)
  if (query.idInstructor) params.set('idInstructor', query.idInstructor)
  if (query.idAmbiente) params.set('idAmbiente', query.idAmbiente)
  if (query.q) params.set('q', query.q)
  if (query.jornada) params.set('jornada', query.jornada)
  if (query.idTrimestre) params.set('idTrimestre', query.idTrimestre)
  if (query.estado) params.set('estado', query.estado)
  if (query.pagina > DEFAULT_QUERY.pagina) params.set('pagina', String(query.pagina))
  return params
}

/**
 * Caracteriza la traducción que harán las redirecciones en Fase 3, sin
 * activarlas aún. `id` es ambiguo solo en rutas antiguas; nunca se propaga a
 * la URL canónica.
 */
export function normalizarRutaHorarioLegada(pathname: string, params: URLSearchParams): GestionarHorariosQuery | null {
  const base = leerGestionarHorariosQuery(params)
  const idLegado = textoQuery(params.get('id'))

  if (pathname === '/horarios/completos') {
    // En la ruta canónica no se reinterpreta estado ya explícito. Solo el
    // antiguo `?id=` necesita completar Bloques/Lista para conservar el
    // deep link que abría un bloque desde calendario o auditoría.
    if (!idLegado) return base
    return {
      ...base,
      perspectiva: params.has('perspectiva') ? base.perspectiva : 'bloques',
      vista: params.has('vista') ? base.vista : 'lista',
      idHorario: base.idHorario ?? idLegado,
    }
  }
  if (pathname === '/vista-fichas') {
    return { ...base, perspectiva: 'ficha', vista: 'calendario', idFicha: base.idFicha ?? idLegado }
  }
  if (pathname === '/vista-instructores') {
    return { ...base, perspectiva: 'instructor', vista: 'calendario', idInstructor: base.idInstructor ?? idLegado }
  }
  if (pathname === '/vista-ambientes') {
    return { ...base, perspectiva: 'ambiente', vista: 'calendario', idAmbiente: base.idAmbiente ?? idLegado }
  }
  return null
}
