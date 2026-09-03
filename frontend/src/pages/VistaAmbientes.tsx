import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { indexarPorAmbiente, opcionesFichaAmbiente, opcionesInstructor } from '../components/horario/indexarHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Ambiente, Horario } from '../types/api'

// Sin variante coordinación (a diferencia de Ambientes.tsx): esta vista solo
// necesita filtrar por ficha/instructor para encontrar el ambiente, no
// clasificarlo por coordinación — por eso indexarPorAmbiente recibe un mapa
// vacío en vez de pedir /fichas/ y /coordinaciones/ solo para esto.
const SIN_COORDINACIONES = new Map<number, number>()

/**
 * "Vista por ambientes" — simétrica a VistaFichas.tsx/VistaInstructores.tsx:
 * filtra por UN ambiente y muestra su horario semanal completo, para no
 * tener que buscarlo a mano ficha por ficha. El detalle (sede, tipo, estado,
 * coordinación) sigue viviendo en Ambientes.tsx — hay un link "Ver info" que
 * lleva para allá y abre su drawer directo (vía ?id=), y el drawer de
 * Ambientes.tsx tiene el link de vuelta ("Ver horario completo", también
 * vía ?id=) — mismo patrón bidireccional que las otras dos vistas.
 */
export function VistaAmbientes() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroFicha, setFiltroFicha] = useState('todas')
  const [filtroInstructor, setFiltroInstructor] = useState('todos')
  const [seleccionado, setSeleccionado] = useState<Ambiente | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [horarios, setHorarios] = useState<{ idAmbiente: number; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<number | null>(null)
  // Todos los horarios del sistema — para filtrar la lista de ambientes por
  // ficha/instructor (no los del ambiente seleccionado, esos son `horarios`
  // arriba, con otro propósito: alimentar el grid).
  const [todosLosHorarios, setTodosLosHorarios] = useState<Horario[]>([])

  useEffect(() => {
    apiGet<Ambiente[]>('/ambientes')
      .then((datos) => {
        setAmbientes(datos)

        // Deep link desde el drawer de Ambientes.tsx ("Ver horario completo"
        // → /vista-ambientes?id=...) — mismo patrón que el deep link
        // inverso en Ambientes.tsx: va dentro del .then, no en un efecto
        // reactivo aparte, para no reabrirse solo si el usuario limpia la
        // selección después.
        if (idDesdeUrl) {
          const encontrado = datos.find((ambiente) => ambiente.idAmbiente === Number(idDesdeUrl))
          if (encontrado) setSeleccionado(encontrado)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de ambientes.'))
      .finally(() => setCargando(false))

    apiGet<Horario[]>('/horarios/')
      .then(setTodosLosHorarios)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  useEffect(() => {
    if (!seleccionado) return

    apiGet<Horario[]>(`/ambientes/${seleccionado.idAmbiente}/horarios`)
      .then((datos) => setHorarios({ idAmbiente: seleccionado.idAmbiente, datos }))
      .catch(() => setErrorHorariosPara(seleccionado.idAmbiente))
  }, [seleccionado])

  const horariosVigentes = seleccionado && horarios?.idAmbiente === seleccionado.idAmbiente ? horarios.datos : null
  const errorHorarios = seleccionado?.idAmbiente === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionado) && horariosVigentes === null && !errorHorarios
  const { bloques, grid } = convertirHorariosAGrid(horariosVigentes ?? [])

  const indiceAsociaciones = indexarPorAmbiente(todosLosHorarios, SIN_COORDINACIONES)
  const { fichas: opcionesFicha } = opcionesFichaAmbiente(todosLosHorarios)
  const opcionesInstructores = opcionesInstructor(todosLosHorarios)
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const visibles = ambientes.filter((ambiente) => {
    const coincideTexto = !texto || `${ambiente.nombreAmbiente} ${ambiente.numeroAmbiente}`.toLocaleLowerCase('es-CO').includes(texto)
    const asociaciones = indiceAsociaciones.get(ambiente.idAmbiente)
    const coincideFicha = filtroFicha === 'todas' || (asociaciones?.fichas.has(filtroFicha) ?? false)
    const coincideInstructor = filtroInstructor === 'todos' || (asociaciones?.instructores.has(filtroInstructor) ?? false)
    return coincideTexto && coincideFicha && coincideInstructor
  })

  return (
    <AppShell activo="Vista por ambientes">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Vista por ambientes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Filtra por un ambiente y mira su horario semanal completo, sin tener que revisarlo ficha por ficha.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtro de ambientes">
          <label htmlFor="buscar-ambiente-vista" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Buscar ambiente
          </label>
          <input
            id="buscar-ambiente-vista"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Nombre o número"
            className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filtro-ficha-ambiente-vista" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Ficha
              </label>
              <select
                id="filtro-ficha-ambiente-vista"
                value={filtroFicha}
                onChange={(evento) => setFiltroFicha(evento.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="todas">Todas</option>
                {opcionesFicha.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filtro-instructor-ambiente-vista" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Instructor
              </label>
              <select
                id="filtro-instructor-ambiente-vista"
                value={filtroInstructor}
                onChange={(evento) => setFiltroInstructor(evento.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="todos">Todos</option>
                {opcionesInstructores.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          {cargando ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Cargando ambientes…</p>
          ) : (
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
              {visibles.map((ambiente) => {
                const esActivo = ambiente.idAmbiente === seleccionado?.idAmbiente
                return (
                  <li key={ambiente.idAmbiente}>
                    <button
                      type="button"
                      onClick={() => setSeleccionado(ambiente)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        esActivo
                          ? 'bg-sena-50 text-sena-700 dark:bg-sena-950/50 dark:text-sena-300'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sena-100 text-xs font-bold text-sena-700 dark:bg-sena-950/50">
                        {ambiente.nombreAmbiente.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{ambiente.nombreAmbiente}</span>
                        <span className="block truncate text-xs text-slate-400">Ambiente {ambiente.numeroAmbiente}</span>
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
          {!seleccionado ? (
            <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              Elige un ambiente de la lista para ver su horario.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sena-100 font-bold text-sena-700 dark:bg-sena-950/50">
                    {seleccionado.nombreAmbiente.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{seleccionado.nombreAmbiente}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Ambiente {seleccionado.numeroAmbiente}</p>
                  </div>
                </div>
                <Link
                  to={`/ambientes?id=${seleccionado.idAmbiente}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Ver info →
                </Link>
              </div>

              {cargandoHorarios ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Cargando horario…</p>
              ) : errorHorarios ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No se pudo cargar el horario de este ambiente.</p>
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
