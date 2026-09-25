import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPost, ApiError } from '../services/api'
import type { EstadoAsistencia, Horario, MarcaAsistencia, SesionAsistencia } from '../types/api'

const ESTADOS: { valor: EstadoAsistencia; etiqueta: string; activo: string; inactivo: string }[] = [
  {
    valor: 'presente',
    etiqueta: 'Presente',
    activo: 'bg-primary text-white',
    inactivo: 'text-primary hover:bg-primary-container/50',
  },
  {
    valor: 'tardanza',
    etiqueta: 'Tarde',
    activo: 'bg-tertiary text-white',
    inactivo: 'text-tertiary hover:bg-tertiary-container/50',
  },
  {
    valor: 'excusa',
    etiqueta: 'Excusa',
    activo: 'bg-surface-container-high text-on-surface',
    inactivo: 'text-on-surface-variant hover:bg-surface-container',
  },
  {
    valor: 'ausente',
    etiqueta: 'Ausente',
    activo: 'bg-error text-white',
    inactivo: 'text-error hover:bg-error-container/50',
  },
]

/** Lunes de la semana de una fecha, para movernos de semana en semana. */
function inicioDeSemana(fecha: Date): Date {
  const lunes = new Date(fecha)
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
  return lunes
}

function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

function formatFechaLarga(iso: string): string {
  // `new Date('2026-09-22')` es UTC: sin esto, en Colombia (UTC-5) se ve
  // el día anterior.
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/)
  return ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase()
}

/** El día de la semana en que se dicta un bloque, para saber qué fecha
 * ofrecer: un horario de los lunes no se puede pasar un martes. */
function fechaDeLaSesion(horario: Horario, semana: Date): string | null {
  const idDia = horario.dias?.[0]
  if (!idDia) return null

  const fecha = new Date(semana)
  fecha.setDate(fecha.getDate() + (idDia - 1))
  return aISO(fecha)
}

/**
 * "Asistencia" del Instructor — pasar lista de una de SUS clases.
 * Diseño: `asistencia_instructor_web_sihs` (Stitch, 2026-09-25).
 *
 * Backend: `GET /asistencias/sesion` y `POST /asistencias/sesion`, que
 * exigen que el bloque sea de quien pasa lista. La nómina sale de los
 * aprendices vinculados a la ficha (`ficha_usuario`), que es la única
 * lista de estudiantes que este sistema tiene — el centro los gestiona en
 * Sofía Plus. Mientras esa lista esté incompleta la pantalla lo dice, en
 * vez de aparentar un curso entero.
 *
 * Del diseño NO se toma lo que no tiene dato real: el chip "Sincronizado
 * con SOFIA Plus" (no hay integración), "Ver historial de registro" (la
 * auditoría existe pero no se expone), el "Validado" del radicado (nadie
 * valida excusas todavía) ni las etiquetas de contexto inventadas ("Sin
 * notificación"). Sí se conserva `rolEnFicha`, que sí existe.
 */
export function AsistenciaInstructor() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [idHorario, setIdHorario] = useState<number | null>(null)
  const [semana, setSemana] = useState(() => inicioDeSemana(new Date()))

  const [sesion, setSesion] = useState<SesionAsistencia | null>(null)
  const [marcas, setMarcas] = useState<Record<string, EstadoAsistencia>>({})
  const [excusas, setExcusas] = useState<Record<string, string>>({})
  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const horarioElegido = horarios.find((h) => h.idHorario === idHorario) ?? null
  const fecha = horarioElegido ? fechaDeLaSesion(horarioElegido, semana) : null

  useEffect(() => {
    apiGet<Horario[]>('/usuarios/me/horarios')
      .then((lista) => {
        setHorarios(lista)
        setIdHorario((previo) => previo ?? lista[0]?.idHorario ?? null)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus clases.')
      })
      .finally(() => setCargando(false))
  }, [])

  const cargarSesion = useCallback(() => {
    if (!idHorario || !fecha) return

    apiGet<SesionAsistencia>(`/asistencias/sesion?idHorario=${idHorario}&fecha=${fecha}`)
      .then((datos) => {
        setSesion(datos)
        setError(null)
        // Lo ya registrado entra como estado inicial: pasar lista otra vez
        // es corregir, no empezar de cero.
        const previas: Record<string, EstadoAsistencia> = {}
        const referencias: Record<string, string> = {}
        for (const aprendiz of datos.aprendices) {
          if (aprendiz.estado) previas[aprendiz.idUsuario] = aprendiz.estado
          if (aprendiz.referenciaExcusa) referencias[aprendiz.idUsuario] = aprendiz.referenciaExcusa
        }
        setMarcas(previas)
        setExcusas(referencias)
      })
      .catch((err: unknown) => {
        setSesion(null)
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la sesión.')
      })
  }, [idHorario, fecha])

  useEffect(() => {
    cargarSesion()
  }, [cargarSesion])

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    const lista = sesion?.aprendices ?? []
    if (!termino) return lista
    return lista.filter(
      (a) => a.nombre.toLowerCase().includes(termino) || (a.numeroDocumento ?? '').includes(termino),
    )
  }, [sesion, busqueda])

  const conteo = useMemo(() => {
    const valores = Object.values(marcas)
    return {
      presente: valores.filter((e) => e === 'presente').length,
      tardanza: valores.filter((e) => e === 'tardanza').length,
      excusa: valores.filter((e) => e === 'excusa').length,
      ausente: valores.filter((e) => e === 'ausente').length,
      sinMarcar: (sesion?.aprendices.length ?? 0) - valores.length,
    }
  }, [marcas, sesion])

  const computables = conteo.presente + conteo.tardanza + conteo.ausente
  const porcentaje = computables > 0 ? Math.round(((conteo.presente + conteo.tardanza) / computables) * 1000) / 10 : null

  function marcar(idUsuario: string, estado: EstadoAsistencia) {
    setMarcas((previas) => ({ ...previas, [idUsuario]: estado }))
    setMensajeExito(null)
  }

  function marcarTodosPresentes() {
    const todas: Record<string, EstadoAsistencia> = { ...marcas }
    for (const aprendiz of sesion?.aprendices ?? []) todas[aprendiz.idUsuario] = 'presente'
    setMarcas(todas)
    setMensajeExito(null)
  }

  async function guardar() {
    if (!sesion || !fecha || guardando) return

    setGuardando(true)
    setError(null)

    try {
      const lista: MarcaAsistencia[] = Object.entries(marcas).map(([idUsuarioAprendiz, estado]) => ({
        idUsuarioAprendiz,
        estado,
        referenciaExcusa: estado === 'excusa' ? (excusas[idUsuarioAprendiz] ?? null) : null,
      }))

      await apiPost('/asistencias/sesion', { idHorario: sesion.idHorario, fechaSesion: fecha, marcas: lista })
      setMensajeExito('Asistencia guardada.')
      cargarSesion()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la asistencia.')
    } finally {
      setGuardando(false)
    }
  }

  const hayCambios = Object.keys(marcas).length > 0

  return (
    <AppShell activo="Asistencia">
      <div className="mx-auto max-w-5xl pb-24">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Registro lectivo</p>
        <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Asistencia</h1>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Registro de asistencia de aprendices por sesión. Solo tú puedes registrarla o cambiarla en
          tus clases.
        </p>

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando tus clases…</p>}

        {error && (
          <p className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {!cargando && horarios.length === 0 && (
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800">
            Todavía no tienes clases publicadas. Cuando coordinación publique tu horario, vas a poder
            pasar lista acá.
          </p>
        )}

        {sesion?.registradaEn && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary-container px-4 py-3 text-sm text-on-primary-container">
            <span className="font-semibold">Sesión con asistencia registrada.</span>{' '}
            Guardada el {new Date(sesion.registradaEn).toLocaleString('es-CO')}. Puedes corregirla; el
            cambio queda registrado.
          </div>
        )}

        {horarios.length > 0 && (
          <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="min-w-[16rem] flex-1">
              <label
                htmlFor="sesion"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400"
              >
                Sesión programada
              </label>
              <select
                id="sesion"
                value={idHorario ?? ''}
                onChange={(e) => setIdHorario(Number(e.target.value))}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {horarios.map((h) => (
                  <option key={h.idHorario} value={h.idHorario}>
                    {h.resultadoDescripcion ?? 'Clase'} · Ficha {h.fichaCodigo ?? h.idFicha} ·{' '}
                    {h.horaInicio.slice(0, 5)}-{h.horaFin.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">
                Fecha de la sesión
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Semana anterior"
                  onClick={() => setSemana((s) => new Date(s.getTime() - 7 * 86400000))}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container dark:border-slate-600"
                >
                  ‹
                </button>
                <span className="min-w-[14rem] text-center text-sm font-semibold text-on-surface dark:text-slate-100">
                  {fecha ? formatFechaLarga(fecha) : 'Sin día asignado'}
                </span>
                <button
                  type="button"
                  aria-label="Semana siguiente"
                  onClick={() => setSemana((s) => new Date(s.getTime() + 7 * 86400000))}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container dark:border-slate-600"
                >
                  ›
                </button>
              </div>
            </div>

            {sesion && sesion.aprendices.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-primary-container px-2.5 py-1 text-on-primary-container">
                  Presentes: {conteo.presente}
                </span>
                <span className="rounded-full bg-error-container px-2.5 py-1 text-on-error-container">
                  Ausentes: {conteo.ausente}
                </span>
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface-variant">
                  Con excusa: {conteo.excusa}
                </span>
                {porcentaje !== null && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-white">{porcentaje}% de asistencia</span>
                )}
              </div>
            )}
          </div>
        )}

        {sesion && sesion.aprendices.length === 0 && (
          <div className="rounded-xl border border-tertiary/30 bg-tertiary-container px-4 py-8 text-center text-sm text-on-tertiary-container">
            <p className="font-semibold">Esta ficha todavía no tiene aprendices vinculados</p>
            <p className="mt-1">
              Solo aparecen los aprendices que ya vincularon su código de ficha desde «Mi horario».
              Mientras tanto no hay a quién pasarle lista.
            </p>
          </div>
        )}

        {sesion && sesion.aprendices.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar aprendiz por nombre o documento…"
                aria-label="Buscar aprendiz"
                className="min-w-[14rem] flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={marcarTodosPresentes}
                className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high dark:border-slate-600 dark:text-slate-300"
              >
                Marcar todos como presentes
              </button>
            </div>

            <ul className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
              {visibles.map((aprendiz) => (
                <li
                  key={aprendiz.idUsuario}
                  className="border-b border-outline-variant p-3 last:border-b-0 dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                      {iniciales(aprendiz.nombre)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface dark:text-slate-100">
                        {aprendiz.nombre}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant dark:text-slate-400">
                        {aprendiz.numeroDocumento ?? 'Sin documento registrado'}
                        {aprendiz.rolEnFicha ? ` · ${aprendiz.rolEnFicha}` : ''}
                        {aprendiz.horaMarcacion
                          ? ` · Marcado ${new Date(aprendiz.horaMarcacion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </p>
                    </div>

                    <div
                      role="group"
                      aria-label={`Estado de ${aprendiz.nombre}`}
                      className="flex flex-wrap gap-1"
                    >
                      {ESTADOS.map((estado) => {
                        const elegido = marcas[aprendiz.idUsuario] === estado.valor
                        return (
                          <button
                            key={estado.valor}
                            type="button"
                            aria-pressed={elegido}
                            onClick={() => marcar(aprendiz.idUsuario, estado.valor)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${elegido ? estado.activo : estado.inactivo}`}
                          >
                            {estado.etiqueta}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {marcas[aprendiz.idUsuario] === 'excusa' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2">
                      <label
                        htmlFor={`excusa-${aprendiz.idUsuario}`}
                        className="text-xs font-semibold text-on-surface-variant"
                      >
                        Número de radicado o referencia:
                      </label>
                      <input
                        id={`excusa-${aprendiz.idUsuario}`}
                        value={excusas[aprendiz.idUsuario] ?? ''}
                        onChange={(e) =>
                          setExcusas((previas) => ({ ...previas, [aprendiz.idUsuario]: e.target.value }))
                        }
                        placeholder="Ej. RAD-2026-0922-EPS-04"
                        className="min-w-[12rem] flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="fixed inset-x-0 bottom-0 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-on-surface-variant dark:text-slate-400">
                  {conteo.sinMarcar > 0
                    ? `${conteo.sinMarcar} sin marcar`
                    : 'Todos marcados'}
                  {mensajeExito && <span className="ml-2 font-semibold text-primary">{mensajeExito}</span>}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cargarSesion}
                    disabled={guardando}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50 dark:text-slate-300"
                  >
                    Descartar cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => void guardar()}
                    disabled={!hayCambios || guardando}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {guardando ? 'Guardando…' : 'Guardar asistencia'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
