import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { AnotacionHorario, AnotacionHorarioInput, EtiquetaAnotacion, Ficha, Horario } from '../types/api'
import {
  construirVistaSemanal,
  duracionHoras,
  formatearCuentaRegresiva,
  proximaClase,
} from './horario/vistaReal'

const ACTUALIZACION_RELOJ_MS = 30_000
const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Colores del mockup mi_horario_rol_aprendiz_sihs_sena (Organizador
// Personal): Examen=rojo, Entrega=ámbar, Importante=violeta. "Normal" no
// está en el mockup pero es un valor válido del schema (etiqueta por
// defecto de una nota sin categoría particular).
const ETIQUETAS: EtiquetaAnotacion[] = ['Normal', 'Examen', 'Entrega', 'Importante']

const COLOR_ETIQUETA: Record<EtiquetaAnotacion, { dot: string; badge: string; badgeActiva: string }> = {
  Examen: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    badgeActiva: 'bg-red-600 text-white',
  },
  Entrega: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    badgeActiva: 'bg-amber-600 text-white',
  },
  Importante: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    badgeActiva: 'bg-violet-600 text-white',
  },
  Normal: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    badgeActiva: 'bg-slate-600 text-white',
  },
}

/** El backend responde "No existe una ficha con ese código" y "Ya tienes
 * una ficha vinculada": correcto como contrato, inútil como instrucción. */
function mensajeDeVinculo(err: unknown, codigo: string): string {
  if (err instanceof ApiError) {
    if (err.status === 404) {
      return `No encontramos la ficha ${codigo}. Revisa que esté completa (son 7 dígitos) y, si el código es el correcto, pídele a tu coordinador que registre la ficha.`
    }
    if (err.status === 400) {
      return 'Ya tienes una ficha vinculada. Si no es la tuya, tu coordinador puede corregirla.'
    }
    return err.message
  }

  return 'No se pudo vincular tu ficha. Inténtalo de nuevo en unos segundos.'
}

function idHorarioDeBloqueId(bloqueId: string): number {
  return Number(bloqueId.replace('horario-', ''))
}

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

  // H-1: vincular la ficha desde acá. El endpoint existía desde siempre
  // sin ninguna pantalla que lo llamara, así que un aprendiz recién
  // registrado leía "vincúlala desde tu perfil" y allá tampoco había nada.
  const [codigoFicha, setCodigoFicha] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const [errorVinculo, setErrorVinculo] = useState<string | null>(null)

  const [anotaciones, setAnotaciones] = useState<AnotacionHorario[]>([])
  const [errorAnotaciones, setErrorAnotaciones] = useState<string | null>(null)
  const [idHorarioSeleccionado, setIdHorarioSeleccionado] = useState<number | null>(null)
  const [notaBorrador, setNotaBorrador] = useState('')
  const [etiquetaBorrador, setEtiquetaBorrador] = useState<EtiquetaAnotacion>('Normal')
  const [recordatorioBorrador, setRecordatorioBorrador] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorDrawer, setErrorDrawer] = useState<string | null>(null)

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

  async function vincularFicha(evento: React.FormEvent) {
    evento.preventDefault()

    const codigo = codigoFicha.trim()
    if (!codigo || vinculando) return

    setVinculando(true)
    setErrorVinculo(null)

    try {
      const fichaVinculada = await apiPost<Ficha>('/ficha-usuario/vincular', { codigoFicha: codigo })
      setFicha(fichaVinculada)
      setSinFicha(false)
      setCodigoFicha('')
      // Se recarga el horario en la misma pantalla: aparece abajo sin
      // navegar ni recargar el navegador.
      setHorarios(await apiGet<Horario[]>('/ficha-usuario/mi-horario'))
    } catch (err: unknown) {
      setErrorVinculo(mensajeDeVinculo(err, codigo))
    } finally {
      setVinculando(false)
    }
  }

  useEffect(() => {
    apiGet<AnotacionHorario[]>('/anotaciones-horario/mias')
      .then(setAnotaciones)
      .catch((err: unknown) => {
        setErrorAnotaciones(err instanceof ApiError ? err.message : 'No se pudieron cargar tus anotaciones.')
      })
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), ACTUALIZACION_RELOJ_MS)
    return () => window.clearInterval(id)
  }, [])

  const anotacionesPorHorario = useMemo(() => {
    const mapa = new Map<number, AnotacionHorario>()
    for (const anotacion of anotaciones) {
      if (anotacion.idHorario != null) mapa.set(anotacion.idHorario, anotacion)
    }
    return mapa
  }, [anotaciones])

  const marcadoresPorBloqueId = useMemo(() => {
    const mapa: Record<string, { etiqueta: string; claseColor: string }> = {}
    for (const anotacion of anotaciones) {
      if (anotacion.idHorario == null) continue
      mapa[`horario-${anotacion.idHorario}`] = {
        etiqueta: anotacion.etiqueta,
        claseColor: COLOR_ETIQUETA[anotacion.etiqueta].dot,
      }
    }
    return mapa
  }, [anotaciones])

  const anotacionSeleccionada = idHorarioSeleccionado != null ? anotacionesPorHorario.get(idHorarioSeleccionado) : undefined
  const horarioSeleccionado = useMemo(
    () => (horarios ?? []).find((h) => h.idHorario === idHorarioSeleccionado) ?? null,
    [horarios, idHorarioSeleccionado],
  )

  function abrirOrganizador(idHorario: number) {
    const existente = anotacionesPorHorario.get(idHorario)
    setIdHorarioSeleccionado(idHorario)
    setNotaBorrador(existente?.nota ?? '')
    setEtiquetaBorrador(existente?.etiqueta ?? 'Normal')
    setRecordatorioBorrador(existente?.recordatorioActivo ?? false)
    setErrorDrawer(null)
  }

  function cerrarOrganizador() {
    setIdHorarioSeleccionado(null)
  }

  async function guardarAnotacion() {
    if (idHorarioSeleccionado == null) return

    setGuardando(true)
    setErrorDrawer(null)

    const payload: AnotacionHorarioInput = {
      idHorario: idHorarioSeleccionado,
      nota: notaBorrador.trim(),
      etiqueta: etiquetaBorrador,
      recordatorioActivo: recordatorioBorrador,
    }

    try {
      const guardada = anotacionSeleccionada
        ? await apiPut<AnotacionHorario>(`/anotaciones-horario/${anotacionSeleccionada.idAnotacion}`, payload)
        : await apiPost<AnotacionHorario>('/anotaciones-horario/', payload)

      setAnotaciones((prev) => [...prev.filter((a) => a.idAnotacion !== guardada.idAnotacion), guardada])
      cerrarOrganizador()
    } catch (err) {
      setErrorDrawer(err instanceof ApiError ? err.message : 'No se pudo guardar la anotación.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarAnotacion() {
    if (!anotacionSeleccionada) return

    setGuardando(true)
    setErrorDrawer(null)

    try {
      await apiDelete(`/anotaciones-horario/${anotacionSeleccionada.idAnotacion}`)
      setAnotaciones((prev) => prev.filter((a) => a.idAnotacion !== anotacionSeleccionada.idAnotacion))
      cerrarOrganizador()
    } catch (err) {
      setErrorDrawer(err instanceof ApiError ? err.message : 'No se pudo eliminar la anotación.')
    } finally {
      setGuardando(false)
    }
  }

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
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-base font-semibold text-on-surface dark:text-slate-100">
            Vincula tu ficha para ver tu horario
          </h2>
          <p className="mb-4 mt-1 text-sm text-on-surface-variant dark:text-slate-400">
            Escribe el código de la ficha en la que estás matriculado. Lo encuentras en tu carta de
            aceptación o se lo puedes pedir a tu coordinador.
          </p>

          <form onSubmit={vincularFicha} className="flex flex-wrap items-start gap-3">
            <div className="min-w-[14rem] flex-1">
              <label
                htmlFor="codigo-ficha"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400"
              >
                Código de ficha
              </label>
              <input
                id="codigo-ficha"
                name="codigoFicha"
                value={codigoFicha}
                onChange={(e) => setCodigoFicha(e.target.value)}
                placeholder="Ej. 3171618"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={!codigoFicha.trim() || vinculando}
              className="mt-[1.4rem] rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {vinculando ? 'Vinculando…' : 'Vincular ficha'}
            </button>
          </form>

          {errorVinculo && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorVinculo}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <GridHorario
                bloques={vista.bloques}
                grid={vista.grid}
                hayBloqueActivo={false}
                soloLectura
                marcadoresPorBloqueId={marcadoresPorBloqueId}
                onClicBloqueLectura={(bloqueId) => abrirOrganizador(idHorarioDeBloqueId(bloqueId))}
              />
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
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {anotaciones.length} nota{anotaciones.length === 1 ? '' : 's'}
                </span>
              </div>

              {errorAnotaciones && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{errorAnotaciones}</p>}

              {anotaciones.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Haz clic en cualquier clase de tu grilla para agregar una nota, recordatorio o etiqueta (Examen,
                  Entrega, Importante).
                </p>
              ) : (
                <ul className="space-y-1">
                  {anotaciones.map((anotacion) => {
                    const horarioDeLaNota = (horarios ?? []).find((h) => h.idHorario === anotacion.idHorario)
                    const tematica = horarioDeLaNota
                      ? horarioDeLaNota.resultadoCodigo ?? horarioDeLaNota.resultadoDescripcion ?? 'Clase'
                      : 'Clase'

                    return (
                      <li key={anotacion.idAnotacion}>
                        <button
                          type="button"
                          onClick={() => anotacion.idHorario != null && abrirOrganizador(anotacion.idHorario)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <span
                            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${COLOR_ETIQUETA[anotacion.etiqueta].dot}`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-700 dark:text-slate-300">{tematica}</span>
                            <span className="block truncate text-slate-500 dark:text-slate-400">{anotacion.nota}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
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

      {idHorarioSeleccionado != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
          onClick={cerrarOrganizador}
        >
          <div
            role="dialog"
            aria-label="Organizador personal de la clase"
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-800 sm:rounded-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Organizador personal
                </p>
                <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                  {horarioSeleccionado
                    ? horarioSeleccionado.resultadoCodigo ?? horarioSeleccionado.resultadoDescripcion ?? 'Clase'
                    : 'Clase'}
                </h2>
                {horarioSeleccionado && (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {horarioSeleccionado.instructorNombre ?? '—'} · {horarioSeleccionado.ambienteNombre ?? '—'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={cerrarOrganizador}
                aria-label="Cerrar organizador personal"
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {errorDrawer && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errorDrawer}</p>
            )}

            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Etiqueta</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ETIQUETAS.map((etiqueta) => (
                <button
                  key={etiqueta}
                  type="button"
                  onClick={() => setEtiquetaBorrador(etiqueta)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    etiquetaBorrador === etiqueta ? COLOR_ETIQUETA[etiqueta].badgeActiva : COLOR_ETIQUETA[etiqueta].badge
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <label htmlFor="nota-organizador" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nota
            </label>
            <textarea
              id="nota-organizador"
              value={notaBorrador}
              onChange={(evento) => setNotaBorrador(evento.target.value)}
              rows={3}
              placeholder="Ej. Traer calculadora, repasar el capítulo 3..."
              className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:outline-none focus:ring-1 focus:ring-sena-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />

            <label className="mb-4 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={recordatorioBorrador}
                onChange={(evento) => setRecordatorioBorrador(evento.target.checked)}
                className="h-4 w-4"
              />
              Recordarme antes de esta clase (guarda la preferencia; el envío del recordatorio en sí todavía no está
              implementado).
            </label>

            <div className="flex items-center justify-between gap-2">
              {anotacionSeleccionada ? (
                <button
                  type="button"
                  onClick={() => void eliminarAnotacion()}
                  disabled={guardando}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30"
                >
                  Eliminar
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cerrarOrganizador}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void guardarAnotacion()}
                  disabled={guardando || !notaBorrador.trim()}
                  className="rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
