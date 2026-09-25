import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { AsistenciaDeAprendiz, EstadoAsistencia, MiAsistencia as MiAsistenciaDatos } from '../types/api'

type Filtro = EstadoAsistencia | 'todas'

const ETIQUETA: Record<EstadoAsistencia, string> = {
  presente: 'Presente',
  tardanza: 'Tarde',
  excusa: 'Excusa',
  ausente: 'Ausente',
}

const ESTILO: Record<EstadoAsistencia, string> = {
  presente: 'bg-primary-container text-on-primary-container',
  tardanza: 'bg-tertiary-container text-on-tertiary-container',
  excusa: 'bg-surface-container text-on-surface-variant',
  ausente: 'bg-error-container text-on-error-container',
}

/** Umbral del reglamento del aprendiz SENA. */
const UMBRAL = 85

function mesLegible(iso: string): string {
  const [anio, mes] = iso.split('-').map(Number)
  const nombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

function diaDelMes(iso: string): { dia: string; semana: string } {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  return {
    dia: String(dia),
    semana: fecha.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
  }
}

/**
 * "Mi asistencia" del Aprendiz — solo lectura.
 * Diseño: `mi_asistencia_aprendiz_web_sihs` (Stitch, 2026-09-25).
 *
 * Backend: `GET /asistencias/mias`, que devuelve solo lo propio. No hay
 * ningún control para editar, justificar ni reclamar: la asistencia la
 * certifica el instructor que dictó la clase, y cualquier botón acá daría
 * 403. Si algo no corresponde, se habla con él — eso es lo que dice la
 * bajada de la pantalla.
 *
 * El porcentaje es sobre sesiones REGISTRADAS, no sobre las programadas
 * del trimestre: el sistema solo sabe de las clases a las que alguien le
 * pasó lista, y el encabezado lo dice para que nadie lea "48 clases" como
 * si fuera el total del trimestre.
 */
export function MiAsistencia() {
  const [datos, setDatos] = useState<MiAsistenciaDatos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')

  useEffect(() => {
    apiGet<MiAsistenciaDatos>('/asistencias/mias')
      .then((respuesta) => {
        setDatos(respuesta)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu asistencia.')
      })
      .finally(() => setCargando(false))
  }, [])

  const visibles = useMemo(
    () => (datos?.sesiones ?? []).filter((s) => filtro === 'todas' || s.estado === filtro),
    [datos, filtro],
  )

  const porMes = useMemo(() => {
    const grupos = new Map<string, AsistenciaDeAprendiz[]>()
    for (const sesion of visibles) {
      const clave = sesion.fechaSesion.slice(0, 7)
      grupos.set(clave, [...(grupos.get(clave) ?? []), sesion])
    }
    return [...grupos.entries()]
  }, [visibles])

  const resumen = datos?.resumen
  const bajoUmbral = resumen != null && resumen.registradas > 0 && resumen.porcentaje < UMBRAL

  return (
    <AppShell activo="Mi asistencia">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
            Solo lectura
          </span>
        </div>

        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Mi asistencia</h1>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Lo que registra tu instructor en cada clase. Si algo no corresponde, háblalo con él.
        </p>

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando tu asistencia…</p>}

        {error && (
          <p className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {resumen && resumen.registradas > 0 && (
          <div className="mb-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-4xl font-bold text-primary">{resumen.porcentaje}%</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Asistencia
                </p>
              </div>

              <dl className="flex flex-wrap gap-5 text-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">Sesiones registradas</dt>
                  <dd className="text-lg font-bold text-on-surface dark:text-slate-100">{resumen.registradas}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Presente</dt>
                  <dd className="text-lg font-bold text-primary">{resumen.presente}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Tarde</dt>
                  <dd className="text-lg font-bold text-tertiary">{resumen.tardanza}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Ausente</dt>
                  <dd className="text-lg font-bold text-error">{resumen.ausente}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Con excusa</dt>
                  <dd className="text-lg font-bold text-on-surface-variant">{resumen.excusa}</dd>
                </div>
              </dl>
            </div>

            {bajoUmbral && (
              <p className="mt-4 rounded-xl border border-tertiary/30 bg-tertiary-container px-3 py-2 text-sm text-on-tertiary-container">
                Tu asistencia está por debajo del {UMBRAL}% que pide el reglamento del aprendiz. Habla
                con tu instructor o con coordinación.
              </p>
            )}

            <p className="mt-3 text-xs text-on-surface-variant dark:text-slate-400">
              El porcentaje se calcula sobre las clases a las que ya te pasaron lista, no sobre el
              total del trimestre. Las excusas no cuentan en contra.
            </p>
          </div>
        )}

        {datos && datos.sesiones.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {(['todas', 'presente', 'tardanza', 'excusa', 'ausente'] as Filtro[]).map((valor) => {
              const cantidad =
                valor === 'todas'
                  ? datos.sesiones.length
                  : datos.sesiones.filter((s) => s.estado === valor).length

              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setFiltro(valor)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    filtro === valor
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {valor === 'todas' ? 'Todas' : ETIQUETA[valor]} ({cantidad})
                </button>
              )
            })}
          </div>
        )}

        {!cargando && !error && (datos?.sesiones.length ?? 0) === 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
              fact_check
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface dark:text-slate-100">
              Todavía no hay asistencia registrada en tus clases
            </p>
            <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">
              Aparece a medida que tus instructores la van registrando.
            </p>
          </div>
        )}

        {porMes.map(([mes, sesiones]) => (
          <section key={mes} className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-on-surface-variant dark:text-slate-400">
              {mesLegible(`${mes}-01`)}
            </h2>

            <ul className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
              {sesiones.map((sesion) => {
                const { dia, semana } = diaDelMes(sesion.fechaSesion)

                return (
                  <li
                    key={sesion.idAsistencia}
                    className="flex flex-wrap items-center gap-3 border-b border-outline-variant p-3 last:border-b-0 dark:border-slate-700"
                  >
                    <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-surface-container-low py-1">
                      <span className="text-lg font-bold leading-none text-on-surface dark:text-slate-100">{dia}</span>
                      <span className="text-[10px] uppercase text-on-surface-variant">{semana}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface dark:text-slate-100">
                        {sesion.resultadoDescripcion ?? 'Clase'}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant dark:text-slate-400">
                        {sesion.instructorNombre ?? 'Instructor'} · {sesion.horaInicio.slice(0, 5)} -{' '}
                        {sesion.horaFin.slice(0, 5)}
                        {sesion.ambienteNombre ? ` · ${sesion.ambienteNombre}` : ''}
                      </p>
                      {sesion.referenciaExcusa && (
                        <p className="truncate text-xs text-on-surface-variant dark:text-slate-400">
                          Ref: {sesion.referenciaExcusa}
                        </p>
                      )}
                    </div>

                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILO[sesion.estado]}`}>
                      {ETIQUETA[sesion.estado]}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  )
}
