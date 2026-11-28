import { useState } from 'react'
import { apiPost, ApiError } from '../services/api'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { CabeceraGestionHorarios } from '../components/horarios/CabeceraGestionHorarios'
import { DrawerHorario } from '../components/horarios/DrawerHorario'
import { GridHorario } from '../components/horario/GridHorario'
import { GridSemanalInstructor } from '../components/horario/GridSemanalInstructor'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { nombresDias } from '../components/relacionados/formatoBloque'
import { colorParaBloque } from './horario/gridLogic'
import { useGestionarHorariosData } from '../hooks/useGestionarHorariosData'
import { filtrarHorarios, jornadaDeHorario } from './horario/filtrosGestionarHorarios'
import { escribirGestionarHorariosQuery, leerGestionarHorariosQuery, normalizarRutaHorarioLegada, type GestionarHorariosQuery, type JornadaQuery } from './horario/gestionarHorariosQuery'
import type { Ambiente, AuditoriaCrucesResponse, Ficha, Usuario } from '../types/api'

const POR_PAGINA = 10

function badgeEstadoPublicacion(publicado: boolean) {
  return publicado
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
}

function PerspectivaContextual({ perspectiva, query, fichas, instructores, ambientes, horarios, auditoria, cargandoAuditoria, errorAuditoria, actualizarQuery }: { perspectiva: Exclude<GestionarHorariosQuery['perspectiva'], 'bloques'>; query: GestionarHorariosQuery; fichas: Ficha[]; instructores: Usuario[]; ambientes: Ambiente[]; horarios: import('../types/api').Horario[]; auditoria: AuditoriaCrucesResponse | null; cargandoAuditoria: boolean; errorAuditoria: string | null; actualizarQuery: (cambios: Partial<GestionarHorariosQuery>) => void }) {
  const id = perspectiva === 'ficha' ? query.idFicha : perspectiva === 'instructor' ? query.idInstructor : query.idAmbiente
  const opciones = perspectiva === 'ficha' ? fichas.map((item) => [String(item.idFicha), item.codigoFicha]) : perspectiva === 'instructor' ? instructores.map((item) => [item.idUsuario, item.nombre]) : ambientes.map((item) => [String(item.idAmbiente), item.nombreAmbiente])
  const clave = perspectiva === 'ficha' ? 'idFicha' : perspectiva === 'instructor' ? 'idInstructor' : 'idAmbiente'
  const { bloques, grid } = convertirHorariosAGrid(horarios)
  const aprendicesPorFicha = Object.fromEntries(fichas.map((ficha) => [ficha.idFicha, ficha.aprendicesTotales]))
  const idsHorarios = new Set(horarios.map((horario) => horario.idHorario))
  const conflictos = auditoria?.conflictos.filter((conflicto) => idsHorarios.has(conflicto.idHorario) || (conflicto.idHorarioExistente != null && idsHorarios.has(conflicto.idHorarioExistente))) ?? []
  return <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
    <label className="mb-2 block text-sm font-semibold text-on-surface" htmlFor="entidad-perspectiva">Seleccionar {perspectiva === 'ficha' ? 'ficha' : perspectiva === 'instructor' ? 'instructor' : 'ambiente'}</label>
    <select id="entidad-perspectiva" value={id ?? ''} onChange={(evento) => actualizarQuery({ [clave]: evento.target.value || undefined } as Partial<GestionarHorariosQuery>)} className="mb-4 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface">
      <option value="">Selecciona una opción</option>{opciones.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
    </select>
    {!id ? <p className="py-10 text-center text-sm text-on-surface-variant">Selecciona una entidad para ver su horario.</p> : <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-on-surface">{horarios.length} bloque{horarios.length === 1 ? '' : 's'} en el contexto actual</p>
        <div className="flex flex-wrap gap-2">{horarios.map((horario) => <button key={horario.idHorario} type="button" onClick={() => actualizarQuery({ idHorario: String(horario.idHorario) })} className="rounded-lg border border-outline px-2 py-1 text-xs font-semibold text-primary">Abrir bloque #{horario.idHorario}</button>)}</div>
      </div>
      {errorAuditoria ? <p role="status" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">No se pudo consultar los Conflictos: {errorAuditoria}</p> : cargandoAuditoria ? <p role="status" className="mb-4 rounded-xl border border-outline-variant p-3 text-sm text-on-surface-variant dark:border-slate-700">Cargando Conflictos del contexto…</p> : conflictos.length === 0 ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Conflictos: no hay conflictos para este contexto.</p> : <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><p className="font-semibold">Conflictos: {conflictos.length} detectado{conflictos.length === 1 ? '' : 's'}.</p>{conflictos.map((conflicto, indice) => <p key={`${conflicto.idHorario}-${conflicto.tipo}-${indice}`} className="mt-1">{conflicto.mensaje}</p>)}</div>}
      {perspectiva === 'instructor' ? <GridSemanalInstructor horarios={horarios} jornadasVisibles={['Mañana', 'Tarde', 'Noche']} aprendicesPorFicha={aprendicesPorFicha} mostrarDetalle={false} /> : <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura onClicBloqueLectura={(idBloque) => actualizarQuery({ idHorario: idBloque })} />}
    </>}
  </section>
}

function etiquetaJornada(jornada: JornadaQuery) { return jornada === 'manana' ? 'Mañana' : jornada === 'tarde' ? 'Tarde' : 'Noche' }

function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

/**
 * "Horarios completos" — a diferencia de Fichas/Instructores/Ambientes
 * (cada una centrada en UNA entidad y todo lo que tiene alrededor), acá el
 * horario mismo es la fila: cada `GET /horarios/` es un renglón. Clic en
 * una fila abre un drawer temporal a la derecha con la información
 * combinada de ficha, instructor (con carga semanal), ambiente y tema.
 * La tabla global no se comprime ni se reemplaza. Historial de horarios
 * (versionado/registro de cambios) es un módulo aparte, no se toca acá.
 */
export function HorariosCompletos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = normalizarRutaHorarioLegada('/horarios/completos', searchParams) ?? leerGestionarHorariosQuery(searchParams)
  const { horarios, fichas, instructores, ambientes, sedes, trimestres, diasSemana, auditoria, cargandoAuditoria, errorAuditoria, cargando, error, erroresCatalogos, actualizarHorario, marcarLotePublicado } = useGestionarHorariosData()
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const [periodoPublicar, setPeriodoPublicar] = useState('')
  const [instructorPublicar, setInstructorPublicar] = useState('')
  const [publicandoLote, setPublicandoLote] = useState(false)
  const [resultadoLote, setResultadoLote] = useState<string | null>(null)
  const [errorLote, setErrorLote] = useState<string | null>(null)
  function actualizarQuery(cambios: Partial<GestionarHorariosQuery>, reiniciarPagina = false) { setSearchParams(escribirGestionarHorariosQuery({ ...query, ...cambios, pagina: reiniciarPagina ? 1 : (cambios.pagina ?? query.pagina) })) }

  const fichaPorId = new Map(fichas.map((ficha) => [ficha.idFicha, ficha]))
  const instructorPorId = new Map(instructores.map((usuario) => [usuario.idUsuario, usuario]))
  const ambientePorId = new Map(ambientes.map((ambiente) => [ambiente.idAmbiente, ambiente]))
  const trimestrePorId = new Map(trimestres.map((trimestre) => [trimestre.idTrimestre, trimestre]))
  const diasPorId = Object.fromEntries(diasSemana.map((dia) => [dia.idDia, dia.nombreDia]))

  const programaPorFicha = new Map(fichas.map((ficha) => [ficha.idFicha, ficha.programa.nombrePrograma]))
  const filtrosActivos = Number(Boolean(query.q)) + Number(Boolean(query.jornada)) + Number(Boolean(query.idTrimestre)) + Number(Boolean(query.estado))
  const visibles = filtrarHorarios(horarios, query, programaPorFicha)

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(query.pagina, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)
  // Publicación por período completo, independiente de la paginación y los filtros.
  const trimestreLote = Number(periodoPublicar || query.idTrimestre || trimestres.find((t) => t.estado === 'activo')?.idTrimestre || 0)
  const instructorLote = query.perspectiva === 'instructor' && query.idInstructor ? query.idInstructor : instructorPublicar
  const instructorElegido = instructores.find((i) => i.idUsuario === instructorLote)
  const borradoresLote = horarios.filter((h) => h.idTrimestre === trimestreLote && h.activo && !h.publicado && (!instructorLote || h.idInstructor === instructorLote))

  async function publicarHorarioCompleto() {
    if (!trimestreLote || borradoresLote.length === 0 || publicandoLote) return
    const destino = instructorLote ? 'de ' + (instructorElegido?.nombre ?? 'este instructor') : 'de TODOS los instructores'
    if (!window.confirm('¿Publicar ' + borradoresLote.length + ' bloques ' + destino + ' del período seleccionado? Los instructores y aprendices podrán consultarlos.')) return
    setPublicandoLote(true)
    setErrorLote(null)
    setResultadoLote(null)
    try {
      const resultado = await apiPost<{ publicados: number; instructores: number; fichas: number }>('/horarios/publicar-lote', {
        idTrimestre: trimestreLote,
        ...(instructorLote ? { idInstructor: instructorLote } : {}),
      })
      marcarLotePublicado(trimestreLote, instructorLote || undefined)
      setResultadoLote('Se publicaron ' + resultado.publicados + ' bloques de ' + resultado.instructores + ' instructor(es) en ' + resultado.fichas + ' ficha(s).')
    } catch (error) {
      setErrorLote(error instanceof ApiError ? error.message : 'No se pudo publicar el lote. No se modificaron los horarios.')
    } finally {
      setPublicandoLote(false)
    }
  }

  const horarioSeleccionado = query.idHorario ? horarios.find((horario) => horario.idHorario === Number(query.idHorario)) : undefined

  return (
    <AppShell activo="Gestionar horarios">
      <CabeceraGestionHorarios vista="lista" descripcion="Revisa, ajusta y publica bloques sin salir de la programación." />
      <p className="mb-2 text-xs tabular-nums text-on-surface-variant">{visibles.length} de {horarios.length} horarios</p>

      <section aria-label="Publicación de horarios completos" className="mb-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 className="text-base font-semibold text-on-surface">Publicar horarios completos</h2>
        <p className="mb-3 text-sm text-on-surface-variant">Publica todos los borradores activos de un instructor o de todo un período en una sola operación. No depende de los bloques visibles en esta página.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-col gap-1 text-sm text-on-surface">Período académico
            <select aria-label="Período para publicar" value={trimestreLote || ''} onChange={(e) => setPeriodoPublicar(e.target.value)} className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-2">
              <option value="">Selecciona período</option>
              {trimestres.map((t) => <option key={t.idTrimestre} value={t.idTrimestre}>{t.nombre}</option>)}
            </select>
          </label>
          <label className="flex min-w-52 flex-col gap-1 text-sm text-on-surface">Alcance
            <select aria-label="Instructor para publicar" value={instructorLote} disabled={query.perspectiva === 'instructor' && Boolean(query.idInstructor)} onChange={(e) => setInstructorPublicar(e.target.value)} className="rounded-lg border border-outline bg-surface-container-lowest px-3 py-2">
              <option value="">Todos los instructores del período</option>
              {instructores.map((i) => <option key={i.idUsuario} value={i.idUsuario}>{i.nombre}</option>)}
            </select>
          </label>
          <button type="button" disabled={!trimestreLote || borradoresLote.length === 0 || publicandoLote || cargando} onClick={() => void publicarHorarioCompleto()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50">
            {publicandoLote ? 'Publicando…' : 'Publicar horario completo (' + borradoresLote.length + ')'}
          </button>
        </div>
        {resultadoLote && <p role="status" className="mt-3 text-sm text-emerald-700">{resultadoLote}</p>}
        {errorLote && <p role="alert" className="mt-3 text-sm text-red-700">{errorLote}</p>}
      </section>

      <nav aria-label="Perspectiva de horarios" className="mb-4 flex flex-wrap gap-1 border-b border-outline-variant dark:border-slate-700">
        {([['bloques', 'Bloques'], ['ficha', 'Por ficha'], ['instructor', 'Por instructor'], ['ambiente', 'Por ambiente']] as const).map(([perspectiva, etiqueta]) => <button key={perspectiva} type="button" aria-pressed={query.perspectiva === perspectiva} onClick={() => actualizarQuery({ perspectiva })} className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${query.perspectiva === perspectiva ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface dark:text-slate-400'}`}>{etiqueta}</button>)}
      </nav>

      <div className="min-w-0">
      <section className="mb-4 border-y border-outline-variant py-4 dark:border-slate-700" aria-label="Filtros de horarios">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-on-surface dark:text-slate-100">Filtrar horarios</p>
            {filtrosActivos > 0 && <span className="rounded-md bg-primary-container px-1.5 py-0.5 font-mono text-xs tabular-nums text-on-primary-container">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && (
              <button type="button" onClick={() => actualizarQuery({ q: undefined, jornada: undefined, idTrimestre: undefined, estado: undefined }, true)} className="text-sm font-medium text-primary hover:text-on-primary-container dark:text-sena-400">
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[11px] text-on-surface-variant">Horarios</p><p className="font-mono text-sm font-medium tabular-nums text-on-surface dark:text-slate-100">{horarios.length}</p></div>
            <div className="text-right"><p className="text-[11px] text-on-surface-variant">Fichas</p><p className="font-mono text-sm font-medium tabular-nums text-on-surface dark:text-slate-100">{new Set(horarios.map((h) => h.idFicha)).size}</p></div>
            <div className="text-right"><p className="text-[11px] text-on-surface-variant">Instructores</p><p className="font-mono text-sm font-medium tabular-nums text-on-surface dark:text-slate-100">{new Set(horarios.map((h) => h.idInstructor)).size}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label htmlFor="buscar-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Buscar</label>
            <input id="buscar-horario" value={query.q ?? ''} onChange={(evento) => actualizarQuery({ q: evento.target.value || undefined }, true)} placeholder="Ficha, programa, instructor o ambiente" className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-jornada-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Jornada</label>
            <select id="filtro-jornada-horario" value={query.jornada ?? 'todas'} onChange={(evento) => actualizarQuery({ jornada: evento.target.value === 'todas' ? undefined : evento.target.value as JornadaQuery }, true)} className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todas">Todas</option>
              <option value="manana">Mañana</option><option value="tarde">Tarde</option><option value="noche">Noche</option>
            </select>
          </div>
        </div>
        <button type="button" aria-expanded={mostrarFiltrosAvanzados} onClick={() => setMostrarFiltrosAvanzados((abiertos) => !abiertos)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-on-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">tune</span>
          {mostrarFiltrosAvanzados ? 'Ocultar filtros avanzados' : 'Más filtros'}
        </button>
        {!mostrarFiltrosAvanzados && (query.idTrimestre || query.estado) && (
          <p className="mt-1 text-xs text-on-surface-variant" role="status">
            Filtros avanzados activos: {[
              query.idTrimestre ? trimestres.find((item) => String(item.idTrimestre) === query.idTrimestre)?.nombre ?? `Período académico ${query.idTrimestre}` : null,
              query.estado ? `Estado ${query.estado}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        {mostrarFiltrosAvanzados && <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="filtro-trimestre-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Período académico</label>
            <select id="filtro-trimestre-horario" value={query.idTrimestre ?? 'todos'} onChange={(evento) => actualizarQuery({ idTrimestre: evento.target.value === 'todos' ? undefined : evento.target.value }, true)} className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {trimestres.map((trimestre) => <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Estado</label>
            <select id="filtro-estado-horario" value={query.estado ?? 'todos'} onChange={(evento) => actualizarQuery({ estado: evento.target.value === 'todos' ? undefined : evento.target.value as GestionarHorariosQuery['estado'] }, true)} className="w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              <option value="publicado">Publicado</option>
              <option value="borrador">Borrador</option>
            </select>
          </div>
        </div>}
      </section>

      {erroresCatalogos.length > 0 && <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">La tabla se muestra, pero no se pudieron cargar: {erroresCatalogos.join(', ')}. Los datos relacionados pueden aparecer como “Sin definir”.</p>}
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando horarios…</p> : query.perspectiva !== 'bloques' ? <PerspectivaContextual perspectiva={query.perspectiva} query={query} fichas={fichas} instructores={instructores} ambientes={ambientes} horarios={visibles} auditoria={auditoria} cargandoAuditoria={cargandoAuditoria} errorAuditoria={errorAuditoria} actualizarQuery={actualizarQuery} /> : <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full text-left text-sm md:min-w-[820px]"><thead className="bg-surface text-xs text-on-surface-variant dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3 font-medium">Ficha</th><th className="hidden px-4 py-3 font-medium md:table-cell">Instructor</th><th className="hidden px-4 py-3 font-medium md:table-cell">Ambiente</th><th className="hidden px-4 py-3 font-medium md:table-cell">Jornada</th><th className="hidden px-4 py-3 font-medium md:table-cell">Días</th><th className="hidden px-4 py-3 font-medium md:table-cell">Hora</th><th className="hidden px-4 py-3 font-medium md:table-cell">Período académico</th><th className="px-4 py-3 font-medium">Estado</th></tr></thead><tbody className="divide-y divide-outline-variant dark:divide-slate-700">{visiblesPagina.map((horario) => {
        const color = colorParaBloque(String(horario.idHorario))
        const expandido = horario.idHorario === Number(query.idHorario)
        const jornada = jornadaDeHorario(horario)
        return (
            <tr key={horario.idHorario} onClick={() => actualizarQuery({ idHorario: expandido ? undefined : String(horario.idHorario) })} className="cursor-pointer transition-colors hover:bg-surface-container-low dark:hover:bg-slate-700/60">
              <td className={`border-l-4 px-4 py-3 font-medium text-on-surface dark:text-slate-100 ${color.borde}`}>
                <button type="button" aria-expanded={expandido} aria-haspopup="dialog" aria-label={`${expandido ? 'Ocultar' : 'Ver'} detalle del horario de la ficha ${horario.fichaCodigo}`} onClick={(evento) => { evento.stopPropagation(); actualizarQuery({ idHorario: expandido ? undefined : String(horario.idHorario) }) }} className="rounded text-left font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                  {horario.fichaCodigo}
                </button>
                <p className="mt-1 text-xs font-normal leading-relaxed text-on-surface-variant md:hidden">
                  {nombresDias(horario.dias, diasPorId)} · {formatoHora(horario.horaInicio)}–{formatoHora(horario.horaFin)}
                  <br />{horario.instructorNombre ?? 'Instructor sin definir'} · {horario.ambienteNombre ?? 'Ambiente sin definir'}
                </p>
              </td>
              <td className="hidden px-4 py-3 text-on-surface-variant dark:text-slate-300 md:table-cell">{horario.instructorNombre ?? 'Sin definir'}</td>
              <td className="hidden px-4 py-3 text-on-surface-variant dark:text-slate-300 md:table-cell">{horario.ambienteNombre ?? 'Sin definir'}</td>
              <td className="hidden px-4 py-3 md:table-cell"><span className={`rounded-md px-2 py-1 text-xs font-medium ${color.fondo} ${color.texto}`}>{etiquetaJornada(jornada)}</span></td>
              <td className="hidden px-4 py-3 text-on-surface-variant dark:text-slate-300 md:table-cell">{nombresDias(horario.dias, diasPorId)}</td>
              <td className="hidden px-4 py-3 font-mono text-xs tabular-nums text-on-surface-variant dark:text-slate-300 md:table-cell">{formatoHora(horario.horaInicio)}-{formatoHora(horario.horaFin)}</td>
              <td className="hidden px-4 py-3 text-on-surface-variant dark:text-slate-300 md:table-cell">{trimestrePorId.get(horario.idTrimestre)?.nombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${badgeEstadoPublicacion(horario.publicado)}`}>
                  {horario.publicado ? 'Publicado' : 'Borrador'}
                </span>
              </td>
            </tr>
        )
      })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">No hay horarios que coincidan con los filtros.</p>}

        {visibles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-on-surface-variant dark:text-slate-400">
              Página {paginaSegura} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => actualizarQuery({ pagina: Math.max(1, paginaSegura - 1) })}
                disabled={paginaSegura === 1}
                className="rounded-lg border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => actualizarQuery({ pagina: Math.min(totalPaginas, paginaSegura + 1) })}
                disabled={paginaSegura === totalPaginas}
                className="rounded-lg border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>}
      </div>

      {horarioSeleccionado && (
        <DrawerHorario
          key={horarioSeleccionado.idHorario}
          horario={horarioSeleccionado}
          ficha={fichaPorId.get(horarioSeleccionado.idFicha)}
          instructor={instructorPorId.get(horarioSeleccionado.idInstructor)}
          ambiente={ambientePorId.get(horarioSeleccionado.idAmbiente)}
          sede={ambientePorId.get(horarioSeleccionado.idAmbiente) ? sedes.find((sede) => sede.idSede === ambientePorId.get(horarioSeleccionado.idAmbiente)?.idSede) : undefined}
          trimestre={trimestrePorId.get(horarioSeleccionado.idTrimestre)}
          diasPorId={diasPorId}
          diasSemana={diasSemana}
          jornada={etiquetaJornada(jornadaDeHorario(horarioSeleccionado))}
          conflictos={auditoria ? auditoria.conflictos : null}
          cargandoConflictos={cargandoAuditoria}
          errorConflictos={errorAuditoria}
          onActualizar={actualizarHorario}
          onCerrar={() => actualizarQuery({ idHorario: undefined })}
        />
      )}
    </AppShell>
  )
}
