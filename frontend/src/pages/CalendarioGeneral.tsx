import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados } from '../components/relacionados/DrawerRelacionados'
import { formatoHora } from '../components/relacionados/formatoBloque'
import { apiGet, ApiError } from '../services/api'
import { BLOQUES } from './horario/tipos'
import type { Jornada } from './horario/tipos'
import type { DiaSemana, Ficha, Horario, Trimestre } from '../types/api'

const NOMBRES_DIA_JS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const ENCABEZADOS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MAX_CHIPS_POR_DIA = 3

// Mismo criterio de color que GridHorario.tsx (Mañana/Noche en verde, Tarde
// en azul) — acá es un punto pequeño, no una celda con texto encima, así
// que Noche sí puede tener su propio tono sin problema de contraste.
const colorJornada: Record<Jornada, { punto: string; texto: string }> = {
  Mañana: { punto: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400' },
  Tarde: { punto: 'bg-blue-500', texto: 'text-blue-700 dark:text-blue-400' },
  Noche: { punto: 'bg-slate-600', texto: 'text-slate-700 dark:text-slate-300' },
}

interface ClaseDelDia {
  idFicha: number
  programa: string
  jornada: Jornada
  horarios: Horario[]
}

function inicioDeMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

function formatoFechaISO(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

function mismaFecha(a: Date, b: Date) {
  return formatoFechaISO(a) === formatoFechaISO(b)
}

/** Bloque horario institucional al que pertenece el horario (por su hora de
 * inicio) — de ahí se saca la jornada, ya que `Horario` no la trae directo. */
function jornadaDeHorario(horario: Horario): Jornada | null {
  return BLOQUES.find((bloque) => bloque.horaInicio24 === horario.horaInicio)?.jornada ?? null
}

function fechaDentroDeTrimestre(fechaISO: string, trimestre: Trimestre | undefined) {
  if (!trimestre) return false
  return fechaISO >= trimestre.fechaInicio && fechaISO <= trimestre.fechaFin
}

/** Celdas del grid del mes: siempre semanas completas (Lunes a Domingo),
 * incluyendo los días de relleno del mes anterior/siguiente para no dejar
 * huecos — igual que cualquier calendario mensual estándar. */
function construirCeldasMes(mes: Date): { fecha: Date; delMes: boolean }[] {
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const offsetLunes = (primerDia.getDay() + 6) % 7
  const diasEnMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const totalCeldas = Math.ceil((offsetLunes + diasEnMes) / 7) * 7

  const inicioGrid = new Date(primerDia)
  inicioGrid.setDate(primerDia.getDate() - offsetLunes)

  return Array.from({ length: totalCeldas }, (_, i) => {
    const fecha = new Date(inicioGrid)
    fecha.setDate(inicioGrid.getDate() + i)
    return { fecha, delMes: fecha.getMonth() === mes.getMonth() }
  })
}

const HOY = new Date()

/**
 * "Calendario general" (backlog sidebar.png, grupo Programación) — vista
 * panorámica de TODAS las clases de la institución mes a mes, derivada de
 * `GET /horarios/` (igual que Vista por instructores/fichas/ambientes): un
 * horario es una plantilla semanal recurrente, así que una clase aparece en
 * un día del calendario si ese día cae dentro de las fechas del trimestre
 * del horario Y su día de la semana coincide con `horario.dias`. Clic en un
 * día abre el detalle completo; el botón "Ver historial de horarios" lleva
 * a HistorialHorarios.tsx (versiones guardadas), que es otro módulo.
 */
export function CalendarioGeneral() {
  const [todosLosHorarios, setTodosLosHorarios] = useState<Horario[]>([])
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mesActual, setMesActual] = useState(() => inicioDeMes(HOY))
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null)
  const [selAno, setSelAno] = useState(HOY.getFullYear())
  const [selMes, setSelMes] = useState(HOY.getMonth())
  const [selDia, setSelDia] = useState(HOY.getDate())

  useEffect(() => {
    apiGet<Horario[]>('/horarios/')
      .then(setTodosLosHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el calendario.'))
      .finally(() => setCargando(false))

    apiGet<DiaSemana[]>('/dias-semana/').then(setDiasSemana).catch(() => {})
    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
    apiGet<Trimestre[]>('/trimestres/').then(setTrimestres).catch(() => {})
  }, [])

  const idDiaPorNombreJs = new Map(diasSemana.map((dia) => [dia.nombreDia, dia.idDia]))
  const programaPorFicha = new Map(fichas.map((ficha) => [ficha.idFicha, ficha.programa.nombrePrograma]))
  const trimestrePorId = new Map(trimestres.map((trimestre) => [trimestre.idTrimestre, trimestre]))

  function clasesDeFecha(fecha: Date): ClaseDelDia[] {
    const idDia = idDiaPorNombreJs.get(NOMBRES_DIA_JS[fecha.getDay()])
    if (idDia == null) return []

    const fechaISO = formatoFechaISO(fecha)
    const grupos = new Map<string, ClaseDelDia>()
    for (const horario of todosLosHorarios) {
      if (!horario.dias.includes(idDia)) continue
      if (!fechaDentroDeTrimestre(fechaISO, trimestrePorId.get(horario.idTrimestre))) continue
      const jornada = jornadaDeHorario(horario)
      if (!jornada) continue

      const clave = `${horario.idFicha}-${jornada}`
      const entrada = grupos.get(clave) ?? {
        idFicha: horario.idFicha,
        programa: programaPorFicha.get(horario.idFicha) ?? horario.fichaCodigo ?? `Ficha ${horario.idFicha}`,
        jornada,
        horarios: [],
      }
      entrada.horarios.push(horario)
      grupos.set(clave, entrada)
    }
    return [...grupos.values()]
  }

  function navegarA(ano: number, mes: number, dia: number) {
    const diasDelMes = new Date(ano, mes + 1, 0).getDate()
    const fecha = new Date(ano, mes, Math.min(dia, diasDelMes))
    setMesActual(inicioDeMes(fecha))
    setFechaSeleccionada(fecha)
  }

  function alCambiarAno(nuevoAno: number) {
    setSelAno(nuevoAno)
    navegarA(nuevoAno, selMes, selDia)
  }

  function alCambiarMes(nuevoMes: number) {
    setSelMes(nuevoMes)
    navegarA(selAno, nuevoMes, selDia)
  }

  function alCambiarDia(nuevoDia: number) {
    setSelDia(nuevoDia)
    navegarA(selAno, selMes, nuevoDia)
  }

  function irAHoy() {
    setSelAno(HOY.getFullYear())
    setSelMes(HOY.getMonth())
    setSelDia(HOY.getDate())
    navegarA(HOY.getFullYear(), HOY.getMonth(), HOY.getDate())
  }

  function mesAnterior() {
    const nuevo = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1)
    setMesActual(nuevo)
    setSelAno(nuevo.getFullYear())
    setSelMes(nuevo.getMonth())
  }

  function mesSiguiente() {
    const nuevo = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1)
    setMesActual(nuevo)
    setSelAno(nuevo.getFullYear())
    setSelMes(nuevo.getMonth())
  }

  const diasEnMesSeleccionado = new Date(selAno, selMes + 1, 0).getDate()
  const añosTrimestres = trimestres.flatMap((t) => [Number(t.fechaInicio.slice(0, 4)), Number(t.fechaFin.slice(0, 4))])
  const añosDisponibles = [...new Set([HOY.getFullYear() - 1, HOY.getFullYear(), HOY.getFullYear() + 1, ...añosTrimestres])].sort((a, b) => a - b)

  const celdas = construirCeldasMes(mesActual)

  return (
    <AppShell activo="Calendario general">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Calendario general</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Todas las clases programadas de la institución, mes a mes.</p>
        </div>
        <Link
          to="/horarios/historial"
          className="rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700"
        >
          Ver historial de horarios
        </Link>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            <span className="rounded-md bg-sena-50 px-3 py-1.5 text-sm font-semibold text-sena-700 dark:bg-sena-950/50 dark:text-sena-300">Mes</span>
            <span
              title="Vista semanal — aún no implementada"
              className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm font-medium text-slate-400 dark:text-slate-500"
            >
              Semana
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={mesAnterior}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Hoy
            </button>
            <p className="w-36 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              {NOMBRES_MES[mesActual.getMonth()]} {mesActual.getFullYear()}
            </p>
            <button
              type="button"
              onClick={mesSiguiente}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            {(Object.keys(colorJornada) as Jornada[]).map((jornada) => (
              <span key={jornada} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className={`h-2 w-2 rounded-full ${colorJornada[jornada].punto}`} />
                Jornada {jornada}
              </span>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="ir-fecha-dia" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Día</label>
              <select
                id="ir-fecha-dia"
                value={selDia}
                onChange={(evento) => alCambiarDia(Number(evento.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {Array.from({ length: diasEnMesSeleccionado }, (_, i) => i + 1).map((dia) => (
                  <option key={dia} value={dia}>{dia}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ir-fecha-mes" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Mes</label>
              <select
                id="ir-fecha-mes"
                value={selMes}
                onChange={(evento) => alCambiarMes(Number(evento.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {NOMBRES_MES.map((nombre, indice) => (
                  <option key={nombre} value={indice}>{nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ir-fecha-ano" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Año</label>
              <select
                id="ir-fecha-ano"
                value={selAno}
                onChange={(evento) => alCambiarAno(Number(evento.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {añosDisponibles.map((año) => (
                  <option key={año} value={año}>{año}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {cargando ? (
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando calendario...</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-7 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              {ENCABEZADOS_SEMANA.map((nombre) => (
                <div key={nombre} className="px-2 py-2 text-center">{nombre}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map(({ fecha, delMes }) => {
                const clases = clasesDeFecha(fecha)
                const visibles = clases.slice(0, MAX_CHIPS_POR_DIA)
                const restantes = clases.length - visibles.length
                const esHoy = mismaFecha(fecha, HOY)

                return (
                  <button
                    key={formatoFechaISO(fecha)}
                    type="button"
                    onClick={() => setFechaSeleccionada(fecha)}
                    aria-label={fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    className={`min-h-24 border-b border-r border-slate-100 p-1.5 text-left align-top last:border-r-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40 ${
                      delMes ? '' : 'bg-slate-50/60 dark:bg-slate-900/40'
                    }`}
                  >
                    <span
                      className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                        esHoy
                          ? 'bg-sena-600 text-white'
                          : delMes
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {fecha.getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {visibles.map((clase) => (
                        <p
                          key={`${clase.idFicha}-${clase.jornada}`}
                          className={`flex items-center gap-1 truncate text-[11px] font-medium ${colorJornada[clase.jornada].texto}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorJornada[clase.jornada].punto}`} />
                          <span className="truncate">{clase.programa}</span>
                        </p>
                      ))}
                      {restantes > 0 && (
                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">+{restantes} más</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {fechaSeleccionada && (
        <DrawerRelacionados
          iniciales={String(fechaSeleccionada.getDate())}
          titulo={fechaSeleccionada.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          subtitulo={NOMBRES_DIA_JS[fechaSeleccionada.getDay()]}
          onCerrar={() => setFechaSeleccionada(null)}
        >
          {clasesDeFecha(fechaSeleccionada).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin clases programadas este día.</p>
          ) : (
            <ul className="space-y-2">
              {clasesDeFecha(fechaSeleccionada).map((clase) => (
                <li key={`${clase.idFicha}-${clase.jornada}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${colorJornada[clase.jornada].punto}`} />
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{clase.programa}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Jornada {clase.jornada} · {clase.horarios.map((h) => `${formatoHora(h.horaInicio)}-${formatoHora(h.horaFin)}`).join(', ')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[...new Set(clase.horarios.map((h) => h.instructorNombre).filter(Boolean))].join(', ') || 'Sin instructor'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[...new Set(clase.horarios.map((h) => h.ambienteNombre).filter(Boolean))].join(', ') || 'Sin ambiente'}
                  </p>
                  <Link
                    to={`/fichas?id=${clase.idFicha}`}
                    className="mt-2 inline-block text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400"
                  >
                    Ver ficha →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}
