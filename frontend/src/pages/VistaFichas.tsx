import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { indexarPorFicha, opcionesInstructor } from '../components/horario/indexarHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Horario } from '../types/api'

/**
 * "Vista por fichas" — simétrica a VistaInstructores.tsx: filtra por UNA
 * ficha y muestra su horario semanal completo, para no tener que buscarla
 * a mano instructor por instructor. El detalle (programa, aprendices,
 * jornadas) sigue viviendo en Fichas.tsx — hay un link "Ver info" que
 * lleva para allá y abre su drawer directo (vía ?id=), y el drawer de
 * Fichas.tsx tiene el link de vuelta ("Ver horario completo", también vía
 * ?id=) — mismo patrón bidireccional que Instructores ↔ Vista por
 * instructores, "todo conectado con todo".
 */
export function VistaFichas() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroInstructor, setFiltroInstructor] = useState('todos')
  const [seleccionada, setSeleccionada] = useState<Ficha | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [horarios, setHorarios] = useState<{ idFicha: number; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<number | null>(null)
  // Todos los horarios del sistema — para filtrar la lista de fichas por
  // instructor (no los de la ficha seleccionada, esos son `horarios`
  // arriba, con otro propósito: alimentar el grid).
  const [todosLosHorarios, setTodosLosHorarios] = useState<Horario[]>([])

  useEffect(() => {
    apiGet<Ficha[]>('/fichas/')
      .then((datos) => {
        setFichas(datos)

        // Deep link desde el drawer de Fichas.tsx ("Ver horario completo"
        // → /vista-fichas?id=...) — mismo patrón que el deep link inverso
        // en Fichas.tsx: va dentro del .then, no en un efecto reactivo
        // aparte, para no reabrirse solo si el usuario limpia la
        // selección después.
        if (idDesdeUrl) {
          const encontrada = datos.find((ficha) => ficha.idFicha === Number(idDesdeUrl))
          if (encontrada) setSeleccionada(encontrada)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de fichas.'))
      .finally(() => setCargando(false))

    apiGet<Horario[]>('/horarios/')
      .then(setTodosLosHorarios)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  useEffect(() => {
    if (!seleccionada) return

    apiGet<Horario[]>(`/fichas/${seleccionada.idFicha}/horarios`)
      .then((datos) => setHorarios({ idFicha: seleccionada.idFicha, datos }))
      .catch(() => setErrorHorariosPara(seleccionada.idFicha))
  }, [seleccionada])

  const horariosVigentes = seleccionada && horarios?.idFicha === seleccionada.idFicha ? horarios.datos : null
  const errorHorarios = seleccionada?.idFicha === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionada) && horariosVigentes === null && !errorHorarios
  const { bloques, grid } = convertirHorariosAGrid(horariosVigentes ?? [])

  const indiceInstructoresPorFicha = indexarPorFicha(todosLosHorarios)
  const instructores = opcionesInstructor(todosLosHorarios)
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const visibles = fichas.filter((ficha) => {
    const coincideTexto =
      !texto || `${ficha.codigoFicha} ${ficha.programa.nombrePrograma} ${ficha.programa.codigoPrograma}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideInstructor = filtroInstructor === 'todos' || (indiceInstructoresPorFicha.get(ficha.idFicha)?.has(filtroInstructor) ?? false)
    return coincideTexto && coincideInstructor
  })

  return (
    <AppShell activo="Vista por fichas">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Vista por fichas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Filtra por una ficha y mira su horario semanal completo, sin tener que revisarlo instructor por instructor.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtro de fichas">
          <label htmlFor="buscar-ficha-vista" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Buscar ficha
          </label>
          <input
            id="buscar-ficha-vista"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Código o programa"
            className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="mb-3">
            <label htmlFor="filtro-instructor-vista" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Instructor
            </label>
            <select
              id="filtro-instructor-vista"
              value={filtroInstructor}
              onChange={(evento) => setFiltroInstructor(evento.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="todos">Todos</option>
              {instructores.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          {cargando ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Cargando fichas…</p>
          ) : (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
              {visibles.map((ficha) => {
                const esActivo = ficha.idFicha === seleccionada?.idFicha
                return (
                  <li key={ficha.idFicha}>
                    <button
                      type="button"
                      onClick={() => setSeleccionada(ficha)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        esActivo
                          ? 'bg-sena-50 text-sena-700 dark:bg-sena-950/50 dark:text-sena-300'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sena-100 text-xs font-bold text-sena-700 dark:bg-sena-950/50">
                        {ficha.codigoFicha.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{ficha.codigoFicha}</span>
                        <span className="block truncate text-xs text-slate-400">{ficha.programa.nombrePrograma}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
              {visibles.length === 0 && (
                <p className="px-2.5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Sin resultados.</p>
              )}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {!seleccionada ? (
            <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              Elige una ficha de la lista para ver su horario.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sena-100 font-bold text-sena-700 dark:bg-sena-950/50">
                    {seleccionada.codigoFicha.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{seleccionada.codigoFicha}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{seleccionada.programa.nombrePrograma}</p>
                  </div>
                </div>
                <Link
                  to={`/fichas?id=${seleccionada.idFicha}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Ver info →
                </Link>
              </div>

              {cargandoHorarios ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Cargando horario…</p>
              ) : errorHorarios ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No se pudo cargar el horario de esta ficha.</p>
              ) : bloques.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Sin horario asignado en el trimestre actual.</p>
              ) : (
                <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
              )}
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
