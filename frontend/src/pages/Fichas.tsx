import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Horario } from '../types/api'

type Orden = 'codigo' | 'programa' | 'trimestre'

function nivel(ficha: Ficha) {
  return ficha.programa.nivelFormacion || 'Sin definir'
}

export function Fichas() {
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [programa, setPrograma] = useState('todos')
  const [nivelFormacion, setNivelFormacion] = useState('todos')
  const [jornada, setJornada] = useState('todas')
  const [orden, setOrden] = useState<Orden>('codigo')
  const [seleccionada, setSeleccionada] = useState<Ficha | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Horarios reales de la ficha seleccionada — alimenta el grid semanal
  // del drawer (SCRUM-67, reusa GridHorario en solo-lectura). Se piden
  // solo al abrir el drawer, mismo patrón que Instructores.tsx.
  const [horariosFicha, setHorariosFicha] = useState<{ idFicha: number; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<number | null>(null)

  useEffect(() => {
    apiGet<Ficha[]>('/fichas/')
      .then(setFichas)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de fichas.'))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!seleccionada) return

    apiGet<Horario[]>(`/fichas/${seleccionada.idFicha}/horarios`)
      .then((datos) => setHorariosFicha({ idFicha: seleccionada.idFicha, datos }))
      .catch(() => setErrorHorariosPara(seleccionada.idFicha))
  }, [seleccionada])

  const horariosVigentes = seleccionada && horariosFicha?.idFicha === seleccionada.idFicha ? horariosFicha.datos : null
  const errorHorarios = seleccionada?.idFicha === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionada) && horariosVigentes === null && !errorHorarios
  const { bloques: bloquesGrid, grid } = convertirHorariosAGrid(horariosVigentes ?? [])

  const programas = [...new Set(fichas.map((ficha) => ficha.programa.nombrePrograma))].sort()
  const niveles = [...new Set(fichas.map(nivel))].sort()
  const jornadas = [...new Set(fichas.flatMap((ficha) => ficha.jornadas))].sort()
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos = Number(Boolean(busqueda.trim())) + Number(programa !== 'todos') + Number(nivelFormacion !== 'todos') + Number(jornada !== 'todas')
  const visibles = fichas.filter((ficha) => {
    const coincideTexto = !texto || `${ficha.codigoFicha} ${ficha.programa.nombrePrograma} ${ficha.programa.codigoPrograma}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideJornada = jornada === 'todas' || ficha.jornadas.includes(jornada)
    return coincideTexto && coincideJornada && (programa === 'todos' || ficha.programa.nombrePrograma === programa) && (nivelFormacion === 'todos' || nivel(ficha) === nivelFormacion)
  }).sort((primera, segunda) => {
    if (orden === 'programa') return primera.programa.nombrePrograma.localeCompare(segunda.programa.nombrePrograma, 'es-CO')
    if (orden === 'trimestre') return primera.trimestre.nombre.localeCompare(segunda.trimestre.nombre, 'es-CO')
    return primera.codigoFicha.localeCompare(segunda.codigoFicha, 'es-CO', { numeric: true })
  })

  return (
    <AppShell activo="Fichas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Fichas</h1><p className="text-sm text-slate-500 dark:text-slate-400">Fichas de formación registradas por programa y trimestre.</p></div><p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {fichas.length} fichas</p></div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Fichas activas</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{fichas.filter((ficha) => ficha.trimestre.estado === 'activo').length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Aprendices totales</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{fichas.reduce((total, ficha) => total + ficha.aprendicesTotales, 0)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Programas</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{programas.length}</p></div></div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de fichas"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtrar fichas</p>{filtrosActivos > 0 && <span className="rounded-full bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}</div>{filtrosActivos > 0 && <button type="button" onClick={() => { setBusqueda(''); setPrograma('todos'); setNivelFormacion('todos'); setJornada('todas') }} className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Limpiar filtros</button>}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_14rem_11rem_10rem_10rem]"><div className="md:col-span-2 xl:col-span-1"><label htmlFor="buscar-ficha" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label><input id="buscar-ficha" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Código o programa" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></div><div><label htmlFor="filtro-programa" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Programa</label><select id="filtro-programa" value={programa} onChange={(evento) => setPrograma(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{programas.map((item) => <option key={item}>{item}</option>)}</select></div><div><label htmlFor="filtro-nivel" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Nivel</label><select id="filtro-nivel" value={nivelFormacion} onChange={(evento) => setNivelFormacion(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{niveles.map((item) => <option key={item}>{item}</option>)}</select></div><div><label htmlFor="filtro-jornada" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Jornada</label><select id="filtro-jornada" value={jornada} onChange={(evento) => setJornada(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todas">Todas</option>{jornadas.map((item) => <option key={item}>{item}</option>)}</select></div><div><label htmlFor="orden-ficha" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Ordenar por</label><select id="orden-ficha" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="codigo">Código</option><option value="programa">Programa</option><option value="trimestre">Trimestre</option></select></div></div></section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando fichas...</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Programa</th><th className="px-4 py-3">Nivel</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Aprendices</th><th className="px-4 py-3">Trimestre</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{visibles.map((ficha) => <tr key={ficha.idFicha} onClick={() => setSeleccionada(ficha)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60"><td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{ficha.codigoFicha}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300"><p>{ficha.programa.nombrePrograma}</p><p className="text-xs text-slate-400">{ficha.programa.codigoPrograma}</p></td><td className="px-4 py-3"><span className="rounded-full bg-sena-50 px-2.5 py-1 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{nivel(ficha)}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{ficha.jornadas.length ? ficha.jornadas.map((item) => <span key={item} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{item}</span>) : <span className="text-slate-400">Sin horario</span>}</div></td><td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{ficha.aprendicesTotales}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ficha.trimestre.nombre}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{ficha.trimestre.estado}</span></td></tr>)}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hay fichas que coincidan con los filtros.</p>}</div>}

      {seleccionada && (
        <DrawerRelacionados
          iniciales={seleccionada.codigoFicha.slice(0, 2).toUpperCase()}
          titulo={seleccionada.codigoFicha}
          subtitulo="Ficha"
          onCerrar={() => setSeleccionada(null)}
        >
          <dl className="space-y-4 text-sm">
            <div><dt className="text-slate-500 dark:text-slate-400">Programa</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionada.programa.nombrePrograma}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Nivel de formación</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{nivel(seleccionada)}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Jornadas programadas</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionada.jornadas.length ? seleccionada.jornadas.join(', ') : 'Sin horario'}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Aprendices matriculados</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionada.aprendicesTotales}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Trimestre</dt><dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{seleccionada.trimestre.nombre}</dd></div>
            <div><dt className="text-slate-500 dark:text-slate-400">Estado del trimestre</dt><dd className="mt-1 font-medium capitalize text-slate-900 dark:text-slate-100">{seleccionada.trimestre.estado}</dd></div>
          </dl>

          <SeccionDrawer titulo="Horario semanal">
            {cargandoHorarios ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando horarios…</p>
            ) : errorHorarios ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No se pudieron cargar los horarios de la ficha.</p>
            ) : (
              <GridHorario bloques={bloquesGrid} grid={grid} hayBloqueActivo={false} soloLectura />
            )}
          </SeccionDrawer>
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}