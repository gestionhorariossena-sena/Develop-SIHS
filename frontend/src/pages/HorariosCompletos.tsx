import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerHorario } from '../components/horarios/DrawerHorario'
import { nombresDias } from '../components/relacionados/formatoBloque'
import type { Jornada } from './horario/tipos'
import { colorParaBloque } from './horario/gridLogic'
import { apiGet, ApiError } from '../services/api'
import type { Ambiente, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

// Las tres entradas de gestión conservan la misma fuente de bloques. Las
// perspectivas por ficha, instructor y ambiente se abren desde el detalle
// contextual de cada bloque, no se duplican como tabs de la lista global.
const MODOS_VISTA = [
  { etiqueta: 'Lista', ruta: '/horarios/completos', icono: 'format_list_bulleted' },
  { etiqueta: 'Calendario', ruta: '/calendario', icono: 'calendar_month' },
  { etiqueta: 'Conflictos', ruta: '/horarios/auditoria', icono: 'warning' },
] as const

type FiltroJornada = 'todas' | Jornada
type FiltroEstado = 'todos' | 'publicado' | 'borrador'
const POR_PAGINA = 10

function badgeEstadoPublicacion(publicado: boolean) {
  return publicado
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
}

// Por RANGO de hora (< 12 Mañana, < 18 Tarde, si no Noche), no por
// coincidencia exacta con las 2 franjas institucionales fijas -- mismo
// criterio que ya usa GridSemanalInstructor.tsx (Mi Horario del
// instructor). Antes, esto solo reconocía las horas de BLOQUES
// (06:15/09:00/12:00/15:00/18:00/20:00): cualquier horario creado por el
// Asistente de Programación (franjas propias: 07:00/09:00/11:00/13:00/
// 15:00/17:00, ver GridAsistente.tsx) devolvía `null` y se mostraba como
// "Sin definir" en la tabla -- encontrado en vivo el 2026-09-14.
function jornadaDeHorario(horario: Horario): Jornada {
  const hora = Number(horario.horaInicio.split(':')[0])
  if (hora < 12) return 'Mañana'
  if (hora < 18) return 'Tarde'
  return 'Noche'
}

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
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [instructores, setInstructores] = useState<Usuario[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [filtroJornada, setFiltroJornada] = useState<FiltroJornada>('todas')
  const [filtroTrimestre, setFiltroTrimestre] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const [paginaActual, setPaginaActual] = useState(1)
  const [idExpandido, setIdExpandido] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    apiGet<Horario[]>('/horarios/')
      .then((datos) => {
        setHorarios(datos)

        // Deep link desde el link "Ver horario completo" (Calendario
        // general) — expande esta fila directo, dentro del .then, mismo
        // patrón que Fichas.tsx/Instructores.tsx/Ambientes.tsx.
        if (idDesdeUrl) {
          const encontrado = datos.find((horario) => horario.idHorario === Number(idDesdeUrl))
          if (encontrado) setIdExpandido(encontrado.idHorario)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de horarios.'))
      .finally(() => setCargando(false))

    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
    apiGet<Usuario[]>('/usuarios/').then(setInstructores).catch(() => {})
    apiGet<Ambiente[]>('/ambientes').then(setAmbientes).catch(() => {})
    apiGet<Sede[]>('/sedes').then(setSedes).catch(() => {})
    apiGet<Trimestre[]>('/trimestres/')
      .then(setTrimestres)
      .catch(() => {})
    apiGet<DiaSemana[]>('/dias-semana/').then(setDiasSemana).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  const fichaPorId = new Map(fichas.map((ficha) => [ficha.idFicha, ficha]))
  const instructorPorId = new Map(instructores.map((usuario) => [usuario.idUsuario, usuario]))
  const ambientePorId = new Map(ambientes.map((ambiente) => [ambiente.idAmbiente, ambiente]))
  const trimestrePorId = new Map(trimestres.map((trimestre) => [trimestre.idTrimestre, trimestre]))
  const diasPorId = Object.fromEntries(diasSemana.map((dia) => [dia.idDia, dia.nombreDia]))

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos = Number(Boolean(busqueda.trim())) + Number(filtroJornada !== 'todas') + Number(filtroTrimestre !== 'todos') + Number(filtroEstado !== 'todos')
  const visibles = horarios.filter((horario) => {
    const programa = fichaPorId.get(horario.idFicha)?.programa.nombrePrograma ?? ''
    const coincideTexto =
      !texto ||
      `${horario.fichaCodigo} ${programa} ${horario.instructorNombre} ${horario.ambienteNombre}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideJornada = filtroJornada === 'todas' || jornadaDeHorario(horario) === filtroJornada
    const coincideTrimestre = filtroTrimestre === 'todos' || horario.idTrimestre === Number(filtroTrimestre)
    const coincideEstado =
      filtroEstado === 'todos' ||
      (filtroEstado === 'publicado' ? horario.publicado : !horario.publicado)
    return coincideTexto && coincideJornada && coincideTrimestre && coincideEstado
  })

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)
  const horarioSeleccionado = idExpandido === null ? undefined : horarios.find((horario) => horario.idHorario === idExpandido)

  return (
    <AppShell activo="Horarios completos">
      <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant dark:text-slate-400">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span className="text-outline">/</span>
        <span className="font-semibold text-primary">Vistas de Horarios</span>
        <span className="text-outline">/</span>
        <span>Coordinación Académica</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Gestionar horarios</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">Cada horario con su ficha, instructor, ambiente y tema en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/horarios/nuevo" className="rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container">Guardar borrador</Link>
          <Link to="/horarios/publicaciones-programadas" className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary">Publicaciones programadas</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" aria-hidden="true" />
            Auditoría de Malla Activa
          </span>
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {horarios.length} horarios</p>
        </div>
      </div>

      {/* Las entradas globales no sustituyen las perspectivas por entidad. */}
      <div className="mb-4 max-w-full overflow-x-auto">
      <nav aria-label="Cambiar vista de horarios" className="inline-flex w-max items-center gap-1 rounded-full bg-surface-container-low p-1 dark:bg-slate-900">
        {MODOS_VISTA.map((modo) => (
          <Link
            key={modo.ruta}
            to={modo.ruta}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              modo.etiqueta === 'Lista'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-on-surface-variant hover:text-on-surface dark:text-slate-400'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{modo.icono}</span>
            {modo.etiqueta}
          </Link>
        ))}
      </nav>
      </div>

      <div className="min-w-0">
      <section className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de horarios">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Filtrar horarios</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-on-primary-container">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && (
              <button type="button" onClick={() => { setBusqueda(''); setFiltroJornada('todas'); setFiltroTrimestre('todos'); setFiltroEstado('todos') }} className="text-sm font-medium text-primary hover:text-on-primary-container dark:text-sena-400">
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Horarios</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{horarios.length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Fichas</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{new Set(horarios.map((h) => h.idFicha)).size}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Instructores</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{new Set(horarios.map((h) => h.idInstructor)).size}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label htmlFor="buscar-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Buscar</label>
            <input id="buscar-horario" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Ficha, programa, instructor o ambiente" className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-jornada-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Jornada</label>
            <select id="filtro-jornada-horario" value={filtroJornada} onChange={(evento) => setFiltroJornada(evento.target.value as FiltroJornada)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todas">Todas</option>
              <option value="Mañana">Mañana</option>
              <option value="Tarde">Tarde</option>
              <option value="Noche">Noche</option>
            </select>
          </div>
        </div>
        <button type="button" aria-expanded={mostrarFiltrosAvanzados} onClick={() => setMostrarFiltrosAvanzados((abiertos) => !abiertos)} className="mt-3 text-sm font-semibold text-primary hover:text-on-primary-container">
          {mostrarFiltrosAvanzados ? 'Ocultar filtros avanzados' : 'Más filtros'}
        </button>
        {!mostrarFiltrosAvanzados && (filtroTrimestre !== 'todos' || filtroEstado !== 'todos') && (
          <p className="mt-1 text-xs text-on-surface-variant" role="status">
            Filtros avanzados activos: {[
              filtroTrimestre !== 'todos' ? trimestres.find((item) => String(item.idTrimestre) === filtroTrimestre)?.nombre ?? `Período académico ${filtroTrimestre}` : null,
              filtroEstado !== 'todos' ? `Estado ${filtroEstado}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        {mostrarFiltrosAvanzados && <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="filtro-trimestre-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Período académico</label>
            <select id="filtro-trimestre-horario" value={filtroTrimestre} onChange={(evento) => setFiltroTrimestre(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {trimestres.map((trimestre) => <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Estado</label>
            <select id="filtro-estado-horario" value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value as FiltroEstado)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              <option value="publicado">Publicado</option>
              <option value="borrador">Borrador</option>
            </select>
          </div>
        </div>}
      </section>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando horarios…</p> : <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-surface text-xs font-semibold uppercase text-on-surface-variant dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Días</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Período académico</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-outline-variant dark:divide-slate-700">{visiblesPagina.map((horario) => {
        const color = colorParaBloque(String(horario.idHorario))
        const expandido = horario.idHorario === idExpandido
        const jornada = jornadaDeHorario(horario)
        return (
            <tr key={horario.idHorario} onClick={() => setIdExpandido(expandido ? null : horario.idHorario)} className="cursor-pointer hover:bg-surface-container-low dark:hover:bg-slate-700/60">
              <td className={`border-l-4 px-4 py-3 font-semibold text-on-surface dark:text-slate-100 ${color.borde}`}>
                <button type="button" aria-expanded={expandido} aria-haspopup="dialog" aria-label={`${expandido ? 'Ocultar' : 'Ver'} detalle del horario de la ficha ${horario.fichaCodigo}`} onClick={(evento) => { evento.stopPropagation(); setIdExpandido(expandido ? null : horario.idHorario) }} className="rounded text-left font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                  {horario.fichaCodigo}
                </button>
              </td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{horario.instructorNombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{horario.ambienteNombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color.fondo} ${color.texto}`}>{jornada}</span></td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{nombresDias(horario.dias, diasPorId)}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{formatoHora(horario.horaInicio)}-{formatoHora(horario.horaFin)}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{trimestrePorId.get(horario.idTrimestre)?.nombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeEstadoPublicacion(horario.publicado)}`}>
                  {horario.publicado ? 'Publicado' : 'Borrador'}
                </span>
              </td>
            </tr>
        )
      })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">No hay horarios que coincidan con los filtros.</p>}

        {visibles.length > 0 && (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-on-surface-variant dark:text-slate-400">
              Página {paginaSegura} de {totalPaginas}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaSegura === 1}
                className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
                disabled={paginaSegura === totalPaginas}
                className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
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
          horario={horarioSeleccionado}
          ficha={fichaPorId.get(horarioSeleccionado.idFicha)}
          instructor={instructorPorId.get(horarioSeleccionado.idInstructor)}
          ambiente={ambientePorId.get(horarioSeleccionado.idAmbiente)}
          sede={ambientePorId.get(horarioSeleccionado.idAmbiente) ? sedes.find((sede) => sede.idSede === ambientePorId.get(horarioSeleccionado.idAmbiente)?.idSede) : undefined}
          trimestre={trimestrePorId.get(horarioSeleccionado.idTrimestre)}
          diasPorId={diasPorId}
          jornada={jornadaDeHorario(horarioSeleccionado)}
          onCerrar={() => setIdExpandido(null)}
          onActualizar={(actualizado) => setHorarios((anterior) => anterior.map((horario) => (horario.idHorario === actualizado.idHorario ? actualizado : horario)))}
        />
      )}
    </AppShell>
  )
}
