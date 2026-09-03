import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { indexarPorAmbiente, opcionesFichaAmbiente, opcionesInstructor } from '../components/horario/indexarHorarios'
import { SeccionFichasAsignadas, SeccionTemasQueDicta } from '../components/relacionados/SeccionesInstructor'
import { SeccionInstructoresAsignados } from '../components/relacionados/SeccionesFicha'
import { apiGet, ApiError } from '../services/api'
import type { Ambiente, Coordinacion, DiaSemana, Ficha, Horario, Sede } from '../types/api'

type Orden = 'nombre' | 'sede' | 'estado'

const POR_PAGINA = 10

const estiloEstado: Record<Ambiente['estadoAmbiente'], string> = {
  disponible: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  mantenimiento: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  inactivo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

export function Ambientes() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [coordinaciones, setCoordinaciones] = useState<Coordinacion[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroFicha, setFiltroFicha] = useState('todas')
  const [filtroCoordinacion, setFiltroCoordinacion] = useState('todas')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroInstructor, setFiltroInstructor] = useState('todos')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [paginaActual, setPaginaActual] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Ambiente | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Horarios reales del ambiente seleccionado — alimenta el grid semanal y
  // las secciones del drawer (fichas/instructores/temas), mismo patrón que
  // Fichas.tsx/Instructores.tsx: se piden solo al abrir el drawer.
  const [horariosAmbiente, setHorariosAmbiente] = useState<{ idAmbiente: number; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<number | null>(null)
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})
  // Todos los horarios del sistema — para filtrar la lista de ambientes por
  // ficha/coordinación/instructor sin pedir los horarios de cada ambiente
  // uno por uno (mismo patrón que Instructores.tsx/Fichas.tsx).
  const [todosLosHorarios, setTodosLosHorarios] = useState<Horario[]>([])

  useEffect(() => {
    apiGet<Ambiente[]>('/ambientes')
      .then((datos) => {
        setAmbientes(datos)

        // Deep link desde VistaAmbientes.tsx ("Ver info" → /ambientes?id=...):
        // abre el drawer de ese ambiente directo — mismo patrón que
        // Instructores.tsx/Fichas.tsx con sus respectivas vistas.
        if (idDesdeUrl) {
          const encontrado = datos.find((ambiente) => ambiente.idAmbiente === Number(idDesdeUrl))
          if (encontrado) setSeleccionado(encontrado)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de ambientes.'))
      .finally(() => setCargando(false))

    apiGet<Sede[]>('/sedes').then(setSedes).catch(() => {})
    apiGet<Coordinacion[]>('/coordinaciones/').then(setCoordinaciones).catch(() => {})
    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
    apiGet<Horario[]>('/horarios/').then(setTodosLosHorarios).catch(() => {})

    // Sin .catch dedicado no rompe nada visible (nombresDias cae a "?" por
    // día si falta el mapa), pero deja una unhandled rejection en tests —
    // mismo patrón que Instructores.tsx/Fichas.tsx.
    apiGet<DiaSemana[]>('/dias-semana/')
      .then((dias) => setDiasPorId(Object.fromEntries(dias.map((d) => [d.idDia, d.nombreDia]))))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  useEffect(() => {
    if (!seleccionado) return

    apiGet<Horario[]>(`/ambientes/${seleccionado.idAmbiente}/horarios`)
      .then((datos) => setHorariosAmbiente({ idAmbiente: seleccionado.idAmbiente, datos }))
      .catch(() => setErrorHorariosPara(seleccionado.idAmbiente))
  }, [seleccionado])

  const horariosVigentes = seleccionado && horariosAmbiente?.idAmbiente === seleccionado.idAmbiente ? horariosAmbiente.datos : null
  const errorHorarios = seleccionado?.idAmbiente === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionado) && horariosVigentes === null && !errorHorarios
  const { bloques: bloquesGrid, grid } = convertirHorariosAGrid(horariosVigentes ?? [])

  const sedesPorId = new Map(sedes.map((sede) => [sede.idSede, sede.nombreSede]))
  const coordinacionesPorId = new Map(coordinaciones.map((item) => [item.idCoordinacion, item.nombreCoordinacion]))
  const coordinacionPorFicha = new Map(fichas.map((ficha) => [ficha.idFicha, ficha.programa.idCoordinacion]))
  const indiceAsociaciones = indexarPorAmbiente(todosLosHorarios, coordinacionPorFicha)
  const { fichas: opcionesFicha } = opcionesFichaAmbiente(todosLosHorarios)
  const opcionesInstructores = opcionesInstructor(todosLosHorarios)

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos =
    Number(Boolean(busqueda.trim())) + Number(filtroFicha !== 'todas') + Number(filtroCoordinacion !== 'todas') + Number(filtroEstado !== 'todos') + Number(filtroInstructor !== 'todos')
  const visibles = ambientes.filter((ambiente) => {
    const coincideTexto = !texto || `${ambiente.nombreAmbiente} ${ambiente.numeroAmbiente}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideEstado = filtroEstado === 'todos' || ambiente.estadoAmbiente === filtroEstado
    const asociaciones = indiceAsociaciones.get(ambiente.idAmbiente)
    const coincideFicha = filtroFicha === 'todas' || (asociaciones?.fichas.has(filtroFicha) ?? false)
    const coincideInstructor = filtroInstructor === 'todos' || (asociaciones?.instructores.has(filtroInstructor) ?? false)
    const coincideCoordinacion = filtroCoordinacion === 'todas' || (asociaciones?.coordinaciones.has(Number(filtroCoordinacion)) ?? false)
    return coincideTexto && coincideEstado && coincideFicha && coincideInstructor && coincideCoordinacion
  }).sort((primero, segundo) => {
    if (orden === 'sede') return (sedesPorId.get(primero.idSede) ?? '').localeCompare(sedesPorId.get(segundo.idSede) ?? '', 'es-CO')
    if (orden === 'estado') return primero.estadoAmbiente.localeCompare(segundo.estadoAmbiente, 'es-CO')
    return primero.nombreAmbiente.localeCompare(segundo.nombreAmbiente, 'es-CO', { numeric: true })
  })

  // Mismo patrón clamped que Instructores.tsx/Fichas.tsx: sin useEffect de reseteo.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)

  return (
    <AppShell activo="Ambientes">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Ambientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ambientes de formación registrados por sede y coordinación.</p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {ambientes.length} ambientes</p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de ambientes">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtrar ambientes</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && (
              <button
                type="button"
                onClick={() => { setBusqueda(''); setFiltroFicha('todas'); setFiltroCoordinacion('todas'); setFiltroEstado('todos'); setFiltroInstructor('todos') }}
                className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Disponibles</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ambientes.filter((item) => item.estadoAmbiente === 'disponible').length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">En mantenimiento</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ambientes.filter((item) => item.estadoAmbiente === 'mantenimiento').length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sedes</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{new Set(ambientes.map((item) => item.idSede)).size}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="md:col-span-2 lg:col-span-1">
            <label htmlFor="buscar-ambiente" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label>
            <input id="buscar-ambiente" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre o número" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-ficha-ambiente" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Ficha</label>
            <select id="filtro-ficha-ambiente" value={filtroFicha} onChange={(evento) => setFiltroFicha(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todas">Todas</option>
              {opcionesFicha.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-coordinacion" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Coordinación</label>
            <select id="filtro-coordinacion" value={filtroCoordinacion} onChange={(evento) => setFiltroCoordinacion(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todas">Todas</option>
              {coordinaciones.map((item) => <option key={item.idCoordinacion} value={item.idCoordinacion}>{item.nombreCoordinacion}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado-ambiente" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Estado</label>
            <select id="filtro-estado-ambiente" value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div>
            <label htmlFor="filtro-instructor-ambiente" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Instructor</label>
            <select id="filtro-instructor-ambiente" value={filtroInstructor} onChange={(evento) => setFiltroInstructor(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {opcionesInstructores.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="orden-ambiente" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Ordenar por</label>
            <select id="orden-ambiente" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="nombre">Nombre</option>
              <option value="sede">Sede</option>
              <option value="estado">Estado</option>
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando ambientes...</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Sede</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Coordinación</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{visiblesPagina.map((ambiente) => {
        const coordinacionesAmbiente = [...(indiceAsociaciones.get(ambiente.idAmbiente)?.coordinaciones ?? [])].map((id) => coordinacionesPorId.get(id)).filter((nombre): nombre is string => Boolean(nombre))
        return (
          <tr key={ambiente.idAmbiente} onClick={() => setSeleccionado(ambiente)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60">
            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{ambiente.nombreAmbiente} <span className="text-slate-400">· {ambiente.numeroAmbiente}</span></td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{sedesPorId.get(ambiente.idSede) ?? 'Sin definir'}</td>
            <td className="px-4 py-3"><span className="rounded-full bg-sena-50 px-2.5 py-1 text-xs font-semibold capitalize text-sena-700 dark:bg-sena-950/50">{ambiente.tipoAmbiente}</span></td>
            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{coordinacionesAmbiente.length > 0 ? coordinacionesAmbiente.join(', ') : 'Sin asignar'}</td>
            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${estiloEstado[ambiente.estadoAmbiente]}`}>{ambiente.estadoAmbiente}</span></td>
          </tr>
        )
      })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hay ambientes que coincidan con los filtros.</p>}

        {visibles.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Página {paginaSegura} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaSegura === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
                disabled={paginaSegura === totalPaginas}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>}

      {seleccionado && (
        <DrawerRelacionados
          iniciales={seleccionado.nombreAmbiente.slice(0, 2).toUpperCase()}
          titulo={seleccionado.nombreAmbiente}
          subtitulo={sedesPorId.get(seleccionado.idSede) ?? 'Sede sin definir'}
          etiquetas={[seleccionado.tipoAmbiente, seleccionado.estadoAmbiente]}
          onCerrar={() => setSeleccionado(null)}
        >
          <dl className="space-y-4 text-sm">
            <div><dt className="text-slate-500 dark:text-slate-400">Número</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.numeroAmbiente}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Tipo</dt><dd className="mt-1 font-medium capitalize text-slate-900 dark:text-slate-100">{seleccionado.tipoAmbiente}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Estado</dt><dd className="mt-1 font-medium capitalize text-slate-900 dark:text-slate-100">{seleccionado.estadoAmbiente}</dd></div>
          </dl>

          {cargandoHorarios ? (
            <SeccionDrawer titulo="Horario semanal">
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando horarios…</p>
            </SeccionDrawer>
          ) : errorHorarios ? (
            <SeccionDrawer titulo="Horario semanal">
              <p className="text-sm text-slate-500 dark:text-slate-400">No se pudieron cargar los horarios del ambiente.</p>
            </SeccionDrawer>
          ) : (
            <>
              <SeccionDrawer titulo="Horario semanal">
                <GridHorario bloques={bloquesGrid} grid={grid} hayBloqueActivo={false} soloLectura />
                <Link
                  to={`/vista-ambientes?id=${seleccionado.idAmbiente}`}
                  className="mt-2 inline-block text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400"
                >
                  Ver horario completo →
                </Link>
              </SeccionDrawer>
              <SeccionFichasAsignadas horarios={horariosVigentes ?? []} diasPorId={diasPorId} />
              <SeccionInstructoresAsignados horarios={horariosVigentes ?? []} diasPorId={diasPorId} />
              <SeccionTemasQueDicta horarios={horariosVigentes ?? []} />
            </>
          )}
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}
