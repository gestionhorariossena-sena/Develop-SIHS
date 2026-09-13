import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { InsigniaVitrina } from '../components/InsigniaVitrina'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Horario } from '../types/api'
import {
  construirVistaSemanal,
  duracionHoras,
  formatearCuentaRegresiva,
  proximaClase,
} from './horario/vistaReal'

const ACTUALIZACION_RELOJ_MS = 30_000
const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function formatearHora(hhmmss: string) {
  return hhmmss.slice(0, 5)
}

/**
 * Grilla semanal real del Aprendiz — GET /ficha-usuario/mi-ficha (datos de
 * la ficha) + GET /ficha-usuario/mi-horario (todas sus clases), pintadas
 * con el mismo GridHorario/CeldaHorario que ya usa el editor de horarios y
 * HistorialHorarios.tsx en modo lectura (ver pages/horario/vistaReal.ts,
 * que generaliza esa conversión para más de un horario a la vez).
 *
 * "Resumen Semanal", "Mis Instructores" y "Próxima Clase" son cálculo
 * puro en cliente sobre esa misma respuesta de mi-horario -- no hay
 * endpoint aparte para esto. La cuenta regresiva de "Próxima Clase" se
 * refresca sola cada 30s contra la hora real del navegador.
 */
export function MiHorarioAprendiz() {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [sinFicha, setSinFicha] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    apiGet<Ficha>('/ficha-usuario/mi-ficha')
      .then((fichaVinculada) => {
        setFicha(fichaVinculada)
        return apiGet<Horario[]>('/ficha-usuario/mi-horario')
      })
      .then(setHorarios)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setSinFicha(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.')
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), ACTUALIZACION_RELOJ_MS)
    return () => window.clearInterval(id)
  }, [])

  const vista = useMemo(() => construirVistaSemanal(horarios ?? []), [horarios])
  const proxima = useMemo(() => proximaClase(horarios ?? [], ahora), [horarios, ahora])

  const horasProgramadas = useMemo(
    () => (horarios ?? []).reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin) * h.dias.length, 0),
    [horarios],
  )
  const materiasActivas = useMemo(
    () => new Set((horarios ?? []).map((h) => h.resultadoCodigo ?? String(h.idResultado))).size,
    [horarios],
  )
  const instructores = useMemo(() => {
    const mapa = new Map<string, { nombre: string; ambientes: Set<string> }>()
    for (const h of horarios ?? []) {
      const entrada = mapa.get(h.idInstructor) ?? {
        nombre: h.instructorNombre ?? 'Instructor',
        ambientes: new Set<string>(),
      }
      if (h.ambienteNombre) entrada.ambientes.add(h.ambienteNombre)
      mapa.set(h.idInstructor, entrada)
    }
    return [...mapa.values()]
  }, [horarios])

  return (
    <AppShell activo="Mi Horario">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {ficha && (
              <span className="rounded-md bg-sena-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-sena-700 dark:bg-sena-950/50 dark:text-sena-400">
                Ficha {ficha.codigoFicha}
              </span>
            )}
            {ficha?.programa && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {ficha.programa.nombrePrograma}
              </span>
            )}
            {ficha?.trimestre && (
              <span className="rounded-md border border-sena-200 bg-sena-50 px-2 py-0.5 text-xs font-medium text-sena-700 dark:border-sena-900 dark:bg-sena-950/50 dark:text-sena-400">
                {ficha.trimestre.nombre}
              </span>
            )}
          </div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Mi Horario Semanal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {vista.jornadas.length > 0
              ? `Jornada ${vista.jornadas.join(' y ')} · ${horasProgramadas.toFixed(1)}h lectivas por semana`
              : 'Distribución de clases de Lunes a Sábado por franja horaria.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <span className="rounded-md bg-white px-3 py-1.5 font-semibold text-sena-700 shadow-sm dark:bg-slate-700 dark:text-sena-400">
              Grilla Semanal
            </span>
            <button
              type="button"
              disabled
              title="Vista Agenda: contenido de mockup (Stitch) — pendiente de conectar a un dato real del backend"
              className="cursor-not-allowed rounded-md px-3 py-1.5 font-medium text-slate-400 dark:text-slate-500"
            >
              Vista Agenda
            </button>
          </div>

          <button
            type="button"
            disabled
            title="Contenido de mockup (Stitch) — pendiente de conectar a un dato real del backend"
            className="cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
          >
            Descargar Horario PDF
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando tu horario...</p>
      ) : sinFicha ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Todavía no tienes una ficha vinculada — vincúlala desde tu perfil para ver tu horario.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <GridHorario bloques={vista.bloques} grid={vista.grid} hayBloqueActivo={false} soloLectura />
            </div>

            {vista.sinUbicar.length > 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {vista.sinUbicar.length} clase{vista.sinUbicar.length === 1 ? '' : 's'} con un horario que no
                coincide con los bloques institucionales, así que no se puede dibujar en la grilla:{' '}
                {vista.sinUbicar
                  .map((h) => `${h.resultadoCodigo ?? h.resultadoDescripcion ?? 'Clase'} (${formatearHora(h.horaInicio)}–${formatearHora(h.horaFin)})`)
                  .join(', ')}
                .
              </p>
            )}

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <span>Horario oficial emitido por Coordinación Académica.</span>
              <button
                type="button"
                disabled
                title="Contenido de mockup (Stitch) — pendiente de conectar a un dato real del backend"
                className="cursor-not-allowed font-medium text-slate-400 dark:text-slate-500"
              >
                Reportar novedad de asistencia
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Organizador personal</p>
                <InsigniaVitrina />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Contenido de mockup (Stitch) — pendiente de conectar a un dato real del backend. Notas privadas,
                recordatorios y etiquetas (Examen, Entrega, Importante) por clase son el ticket
                "[DB/Arquitectura][Backend] Anotaciones personales de horario" de este mismo Epic.
              </p>
            </div>
          </div>

          <aside className="flex flex-col gap-4 lg:col-span-4">
            {proxima && (
              <div className="rounded-xl bg-gradient-to-br from-sena-700 to-sena-900 p-4 text-white shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Próxima clase
                  </span>
                  <span className="font-mono text-xs text-sena-100">{formatearCuentaRegresiva(ahora, proxima.fecha)}</span>
                </div>
                <h3 className="text-base font-bold leading-snug">
                  {proxima.horario.resultadoCodigo ?? proxima.horario.resultadoDescripcion ?? 'Clase'}
                </h3>
                <p className="mt-0.5 text-xs text-sena-100">
                  {DIAS_NOMBRE[proxima.fecha.getDay() - 1]} · {formatearHora(proxima.horario.horaInicio)} –{' '}
                  {formatearHora(proxima.horario.horaFin)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-black/20 p-2">
                    <span className="block text-[10px] text-sena-100">Ambiente</span>
                    <span className="text-xs font-bold">{proxima.horario.ambienteNombre ?? '—'}</span>
                  </div>
                  <div className="rounded-lg bg-black/20 p-2">
                    <span className="block text-[10px] text-sena-100">Instructor</span>
                    <span className="text-xs font-bold">{proxima.horario.instructorNombre ?? '—'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Resumen semanal</p>
                <span className="rounded border border-sena-200 bg-sena-50 px-2 py-0.5 font-mono text-xs font-bold text-sena-700 dark:border-sena-900 dark:bg-sena-950/50 dark:text-sena-400">
                  {horasProgramadas.toFixed(1)}h
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">Materias activas</span>
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">{materiasActivas}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">Docentes asignados</span>
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">{instructores.length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Mis instructores</p>
              {instructores.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin clases programadas todavía.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs dark:divide-slate-700">
                  {instructores.map((instructor) => (
                    <div key={instructor.nombre} className="flex items-center justify-between gap-2 py-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{instructor.nombre}</span>
                      <span className="rounded bg-sena-50 px-2 py-0.5 font-medium text-sena-700 dark:bg-sena-950/50 dark:text-sena-400">
                        {[...instructor.ambientes].join(', ') || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  )
}
