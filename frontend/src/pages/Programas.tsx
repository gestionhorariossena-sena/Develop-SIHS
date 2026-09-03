import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Programa } from '../types/api'

type Orden = 'codigo' | 'nombre' | 'nivel'
type Estado = 'todos' | 'activo' | 'inactivo'

const POR_PAGINA = 10

export function Programas() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [programas, setProgramas] = useState<Programa[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [nivelFormacion, setNivelFormacion] = useState('todos')
  const [estado, setEstado] = useState<Estado>('todos')
  const [orden, setOrden] = useState<Orden>('codigo')
  const [paginaActual, setPaginaActual] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Programa | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Programa[]>('/programas/')
      .then((datos) => {
        setProgramas(datos)

        // Deep link (ej. desde Fichas.tsx → "Ver programa"): abre el
        // drawer de ese programa directo — mismo patrón que Fichas.tsx.
        if (idDesdeUrl) {
          const encontrado = datos.find((programa) => programa.idPrograma === Number(idDesdeUrl))
          if (encontrado) setSeleccionado(encontrado)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de programas.'))
      .finally(() => setCargando(false))

    // Sin .catch dedicado no rompe nada visible (el conteo de fichas cae a
    // 0 si falla), pero deja una unhandled rejection en tests — mismo
    // patrón que Fichas.tsx/Ambientes.tsx con /horarios/.
    apiGet<Ficha[]>('/fichas/')
      .then(setFichas)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  const fichasPorPrograma = useMemo(() => {
    const mapa = new Map<number, Ficha[]>()
    for (const ficha of fichas) {
      const actuales = mapa.get(ficha.idPrograma) ?? []
      actuales.push(ficha)
      mapa.set(ficha.idPrograma, actuales)
    }
    return mapa
  }, [fichas])

  const fichasDelSeleccionado = seleccionado ? fichasPorPrograma.get(seleccionado.idPrograma) ?? [] : []

  const niveles = [...new Set(programas.map((programa) => programa.nivelFormacion || 'Sin definir'))].sort()
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos =
    Number(Boolean(busqueda.trim())) + Number(nivelFormacion !== 'todos') + Number(estado !== 'todos')
  const visibles = programas.filter((programa) => {
    const coincideTexto = !texto || `${programa.codigoPrograma} ${programa.nombrePrograma}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideNivel = nivelFormacion === 'todos' || (programa.nivelFormacion || 'Sin definir') === nivelFormacion
    const coincideEstado = estado === 'todos' || (estado === 'activo') === programa.activo
    return coincideTexto && coincideNivel && coincideEstado
  }).sort((primero, segundo) => {
    if (orden === 'nombre') return primero.nombrePrograma.localeCompare(segundo.nombrePrograma, 'es-CO')
    if (orden === 'nivel') return (primero.nivelFormacion || '').localeCompare(segundo.nivelFormacion || '', 'es-CO')
    return primero.codigoPrograma.localeCompare(segundo.codigoPrograma, 'es-CO', { numeric: true })
  })

  // Mismo patrón clamped que Fichas.tsx: sin useEffect de reseteo.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)

  return (
    <AppShell activo="Programas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Programas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Programas de formación registrados, con sus fichas y trimestre.</p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {programas.length} programas</p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de programas">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtrar programas</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && <button type="button" onClick={() => { setBusqueda(''); setNivelFormacion('todos'); setEstado('todos') }} className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Limpiar filtros</button>}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Activos</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{programas.filter((programa) => programa.activo).length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Fichas totales</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{fichas.length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Niveles</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{niveles.length}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="buscar-programa" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label>
            <input id="buscar-programa" value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setPaginaActual(1) }} placeholder="Código o nombre" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-nivel-programa" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Nivel</label>
            <select id="filtro-nivel-programa" value={nivelFormacion} onChange={(evento) => { setNivelFormacion(evento.target.value); setPaginaActual(1) }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {niveles.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado-programa" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Estado</label>
            <select id="filtro-estado-programa" value={estado} onChange={(evento) => { setEstado(evento.target.value as Estado); setPaginaActual(1) }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div>
            <label htmlFor="orden-programa" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Ordenar por</label>
            <select id="orden-programa" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="codigo">Código</option>
              <option value="nombre">Nombre</option>
              <option value="nivel">Nivel</option>
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando programas...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Programa</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Fichas</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visiblesPagina.map((programa) => (
                  <tr key={programa.idPrograma} onClick={() => setSeleccionado(programa)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{programa.codigoPrograma}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{programa.nombrePrograma}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-sena-50 px-2.5 py-1 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{programa.nivelFormacion || 'Sin definir'}</span></td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{(fichasPorPrograma.get(programa.idPrograma) ?? []).length}</td>
                    <td className="px-4 py-3">
                      <span className={programa.activo ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300'}>
                        {programa.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hay programas que coincidan con los filtros.</p>}

          {visibles.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Página {paginaSegura} de {totalPaginas}</p>
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
        </div>
      )}

      {seleccionado && (
        <DrawerRelacionados
          iniciales={seleccionado.codigoPrograma.slice(0, 2).toUpperCase()}
          titulo={seleccionado.nombrePrograma}
          subtitulo={seleccionado.codigoPrograma}
          onCerrar={() => setSeleccionado(null)}
        >
          <dl className="space-y-4 text-sm">
            <div><dt className="text-slate-500 dark:text-slate-400">Código del programa</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.codigoPrograma}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Nivel de formación</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.nivelFormacion || 'Sin definir'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Estado</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionado.activo ? 'Activo' : 'Inactivo'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Fichas asociadas</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{fichasDelSeleccionado.length}</dd></div>
          </dl>

          <SeccionDrawer titulo="Fichas y trimestres">
            {fichasDelSeleccionado.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Este programa todavía no tiene fichas asociadas.</p>
            ) : (
              <div className="space-y-3">
                {fichasDelSeleccionado.map((ficha) => (
                  <div key={ficha.idFicha} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{ficha.codigoFicha}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Trimestre: {ficha.trimestre.nombre}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{ficha.trimestre.estado}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SeccionDrawer>
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}
