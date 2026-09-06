import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Horario, Usuario } from '../types/api'
import type { Jornada } from './horario/tipos'

interface FichaAsignada {
  codigo: string
  temas: string[]
  ambientes: string[]
  bloques: number
}

const FILTROS_JORNADA: { etiqueta: string; valor: Jornada | 'todas' }[] = [
  { etiqueta: 'Todas las jornadas', valor: 'todas' },
  { etiqueta: 'Mañana (06:00 - 12:00)', valor: 'Mañana' },
  { etiqueta: 'Tarde (12:00 - 18:00)', valor: 'Tarde' },
  { etiqueta: 'Noche (18:00 - 22:00)', valor: 'Noche' },
]

/** Duración en horas entre dos "HH:MM:SS" 24h — mismo formato que trae
 * `Horario.horaInicio/horaFin` (ver BLOQUES en pages/horario/tipos.ts). */
function duracionHoras(horaInicio: string, horaFin: string): number {
  const [hIni, mIni] = horaInicio.split(':').map(Number)
  const [hFin, mFin] = horaFin.split(':').map(Number)
  return (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60
}

/** Igual al mapeo BLOQUES de pages/horario/tipos.ts — se repite acá (solo
 * para filtrar por jornada del lado del cliente) para no importar el
 * módulo del editor completo en esta pantalla de solo lectura. */
function jornadaDeHorario(horaInicio: string): Jornada {
  const hora = Number(horaInicio.split(':')[0])
  if (hora < 12) return 'Mañana'
  if (hora < 18) return 'Tarde'
  return 'Noche'
}

/** Agrupa los horarios ya cargados por ficha — no pide nada nuevo al
 * backend, solo resume lo que `GET /usuarios/me/horarios` ya trae
 * (fichaCodigo, resultadoDescripcion, ambienteNombre). No se muestra
 * cantidad de aprendices por ficha: ese dato no viene en la respuesta de
 * este endpoint. */
function agruparPorFicha(horarios: Horario[]): FichaAsignada[] {
  const porFicha = new Map<string, FichaAsignada>()

  for (const horario of horarios) {
    const codigo = horario.fichaCodigo ?? 'Sin ficha'
    const entrada = porFicha.get(codigo) ?? { codigo, temas: [], ambientes: [], bloques: 0 }

    const tema = horario.resultadoDescripcion ?? horario.resultadoCodigo
    if (tema && !entrada.temas.includes(tema)) entrada.temas.push(tema)

    const ambiente = horario.ambienteNombre
    if (ambiente && !entrada.ambientes.includes(ambiente)) entrada.ambientes.push(ambiente)

    entrada.bloques += 1
    porFicha.set(codigo, entrada)
  }

  return [...porFicha.values()]
}

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

const ETIQUETA_CONTRATO: Record<string, string> = {
  planta: 'Instructor de Planta',
  contrato: 'Instructor de Contrato',
}

/**
 * Autoservicio del instructor — "Mi horario" (pedido 2026-09-03). A
 * diferencia de Vista por instructores (que un Coordinador usa para
 * elegir CUALQUIER instructor de una lista), acá no hay nada que elegir:
 * siempre es el usuario logueado, vía `GET /usuarios/me/horarios`, que ya
 * viene filtrado a solo lo publicado — un instructor nunca ve acá un
 * borrador que el coordinador todavía está armando (ver
 * HorarioService.obtener_publicados_por_instructor en el backend).
 *
 * Solo aparece en el nav para quien tenga el rol Instructor
 * (`AppShell.tsx`, ítem "Mi horario" con `soloInstructor: true`), pero la
 * ruta en sí no está restringida por rol — cualquier usuario autenticado
 * puede visitarla y ve sus propias clases (o ninguna, si no dicta clases).
 *
 * Layout reconstruido sobre el mockup Stitch "Mi Horario" — el badge de
 * tipo de contrato y el tope de "Carga Lectiva Semanal" usan
 * `perfil.tipoContrato`/`horasContratadasSemana` (GET /usuarios/me), ya
 * reales; el mockup mostraba además "Ambiente Actual" y una fecha de
 * "última sincronización con SOFIA Plus/SINERGIA" que no tienen ningún
 * dato real detrás — se omiten en vez de inventarlos.
 *
 * "Mis fichas asignadas" y "Carga semanal" son resúmenes derivados de los
 * mismos horarios ya cargados — no hay endpoint nuevo. "Solicitar cambio
 * de horario" queda deshabilitado: no existe todavía tabla ni endpoint de
 * solicitudes de instructor en el backend.
 */
export function MiHorario() {
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtroJornada, setFiltroJornada] = useState<Jornada | 'todas'>('todas')

  useEffect(() => {
    apiGet<Horario[]>('/usuarios/me/horarios')
      .then(setHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.'))

    apiGet<Usuario>('/usuarios/me')
      .then(setPerfil)
      .catch(() => {})
  }, [])

  const horariosFiltrados = useMemo(() => {
    if (!horarios) return null
    if (filtroJornada === 'todas') return horarios
    return horarios.filter((h) => jornadaDeHorario(h.horaInicio) === filtroJornada)
  }, [horarios, filtroJornada])

  const { bloques, grid } = convertirHorariosAGrid(horariosFiltrados ?? [])

  const fichas = useMemo(() => agruparPorFicha(horarios ?? []), [horarios])

  const horasSemanales = useMemo(() => {
    if (!horarios) return 0
    return horarios.reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin) * h.dias.length, 0)
  }, [horarios])

  const tope = perfil?.horasContratadasSemana ?? null
  const porcentajeCarga = tope ? Math.min(100, Math.round((horasSemanales / tope) * 100)) : null

  return (
    <AppShell activo="Mi horario">
      <nav className="mb-3 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span>/</span>
        <span className="text-on-surface">Mi Horario</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface">Mi Horario Semanal</h1>
          <p className="text-sm text-on-surface-variant">
            Tu horario semanal publicado por tu coordinador. Si falta una clase que sabés que ya te
            asignaron, puede que todavía esté en borrador — hablalo con tu coordinador.
          </p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {perfil && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
              {letraInicial(perfil.nombre)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-on-surface">{perfil.nombre}</p>
                {perfil.tipoContrato && ETIQUETA_CONTRATO[perfil.tipoContrato] && (
                  <span className="rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container">
                    {ETIQUETA_CONTRATO[perfil.tipoContrato]}
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">{perfil.email}</p>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Horas semanales</p>
            <p className="text-lg font-bold text-on-surface">{horarios ? horasSemanales : '—'} h activas</p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS_JORNADA.map((filtro) => (
          <button
            key={filtro.valor}
            type="button"
            onClick={() => setFiltroJornada(filtro.valor)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroJornada === filtro.valor
                ? 'border-primary bg-primary-container text-on-primary-container'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {filtro.etiqueta}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-2">
          {!horarios && !error ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">Cargando tu horario…</p>
          ) : bloques.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">
              {filtroJornada === 'todas'
                ? 'Todavía no tenés clases publicadas en este trimestre.'
                : 'No tenés clases publicadas en esa jornada.'}
            </p>
          ) : (
            <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Carga lectiva semanal</p>
              {porcentajeCarga !== null && (
                <span className="rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container">
                  {porcentajeCarga}% asignado
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-on-surface">
              {horarios ? horasSemanales : '—'}
              <span className="ml-1 text-base font-medium text-on-surface-variant">
                {tope ? `/ ${tope} hrs semanales` : 'hrs'}
              </span>
            </p>

            {tope && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${porcentajeCarga}%` }}
                />
              </div>
            )}

            <button
              type="button"
              disabled
              title="Aún no implementado en el backend"
              className="mt-4 w-full cursor-not-allowed rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant"
            >
              Solicitar cambio de horario
            </button>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Mis fichas asignadas</p>
              {horarios && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                  {fichas.length} {fichas.length === 1 ? 'ficha' : 'fichas'}
                </span>
              )}
            </div>

            {!horarios ? (
              <p className="text-sm text-on-surface-variant">Cargando…</p>
            ) : fichas.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Sin fichas asignadas este trimestre.</p>
            ) : (
              <ul className="space-y-3">
                {fichas.map((ficha) => (
                  <li key={ficha.codigo} className="border-t border-outline-variant pt-3 first:border-t-0 first:pt-0">
                    <p className="text-sm font-semibold text-on-surface">Ficha {ficha.codigo}</p>
                    {ficha.temas.length > 0 && (
                      <p className="text-sm text-on-surface-variant">{ficha.temas.join(', ')}</p>
                    )}
                    {ficha.ambientes.length > 0 && (
                      <p className="text-xs text-on-surface-variant">{ficha.ambientes.join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
