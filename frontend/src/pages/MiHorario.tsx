import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Horario } from '../types/api'

interface FichaAsignada {
  codigo: string
  temas: string[]
  ambientes: string[]
  bloques: number
}

/** Duración en horas entre dos "HH:MM:SS" 24h — mismo formato que trae
 * `Horario.horaInicio/horaFin` (ver BLOQUES en pages/horario/tipos.ts). */
function duracionHoras(horaInicio: string, horaFin: string): number {
  const [hIni, mIni] = horaInicio.split(':').map(Number)
  const [hFin, mFin] = horaFin.split(':').map(Number)
  return (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60
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

/**
 * Autoservicio del instructor — "Mi horario" (pedido 2026-09-03). A
 * diferencia de Vista por instructores (que un Coordinador usa para
 * elegir CUALQUIER instructor de una lista), acá no hay nada que elegir:
 * siempre es el usuario logueado, vía `GET /usuarios/me/horarios`, que ya
 * viene filtrado a solo lo publicado — un instructor nunca ve acá un
 * borrador que el coordinador todavía está armando (ver
 * HorarioService.obtener_publicados_por_instructor en el backend).
 *
 * Solo aparece en el sidebar para quien tenga el rol Instructor
 * (`AppShell.tsx`, ítem "Mi horario" con `soloInstructor: true`), pero la
 * ruta en sí no está restringida por rol — cualquier usuario autenticado
 * puede visitarla y ve sus propias clases (o ninguna, si no dicta clases).
 *
 * "Mis fichas asignadas" y "Carga semanal" (abajo) son resúmenes
 * derivados de los mismos horarios ya cargados — no hay endpoint nuevo.
 * "Solicitar cambio de horario" queda deshabilitado: no existe todavía
 * tabla ni endpoint de solicitudes de instructor en el backend.
 */
export function MiHorario() {
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Horario[]>('/usuarios/me/horarios')
      .then(setHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.'))
  }, [])

  const { bloques, grid } = convertirHorariosAGrid(horarios ?? [])

  const fichas = useMemo(() => agruparPorFicha(horarios ?? []), [horarios])

  const horasSemanales = useMemo(() => {
    if (!horarios) return 0
    return horarios.reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin) * h.dias.length, 0)
  }, [horarios])

  return (
    <AppShell activo="Mi horario">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Mi horario</h1>
        <p className="text-sm text-on-surface-variant dark:text-slate-400">
          Tu horario semanal publicado por tu coordinador. Si falta una clase que sabés que ya te
          asignaron, puede que todavía esté en borrador — hablalo con tu coordinador.
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800 lg:col-span-2">
          {!horarios && !error ? (
            <p className="py-16 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando tu horario…</p>
          ) : bloques.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface-variant dark:text-slate-400">
              Todavía no tenés clases publicadas en este trimestre.
            </p>
          ) : (
            <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Carga semanal asignada</p>
            <p className="mt-1 text-3xl font-bold text-on-surface dark:text-slate-100">
              {horarios ? horasSemanales : '—'}
              <span className="ml-1 text-base font-medium text-on-surface-variant dark:text-slate-400">hrs</span>
            </p>

            <button
              type="button"
              disabled
              title="Aún no implementado en el backend"
              className="mt-4 w-full cursor-not-allowed rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant dark:border-slate-600 dark:text-slate-300"
            >
              Solicitar cambio de horario
            </button>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-on-surface-variant">Mis fichas asignadas</p>

            {!horarios ? (
              <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando…</p>
            ) : fichas.length === 0 ? (
              <p className="text-sm text-on-surface-variant dark:text-slate-400">Sin fichas asignadas este trimestre.</p>
            ) : (
              <ul className="space-y-3">
                {fichas.map((ficha) => (
                  <li key={ficha.codigo} className="border-t border-outline-variant pt-3 first:border-t-0 first:pt-0 dark:border-slate-700">
                    <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Ficha {ficha.codigo}</p>
                    {ficha.temas.length > 0 && (
                      <p className="text-sm text-on-surface-variant dark:text-slate-300">{ficha.temas.join(', ')}</p>
                    )}
                    {ficha.ambientes.length > 0 && (
                      <p className="text-xs text-on-surface-variant dark:text-slate-400">{ficha.ambientes.join(' · ')}</p>
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
