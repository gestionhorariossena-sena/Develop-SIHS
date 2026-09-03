import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { nombresDias } from '../components/relacionados/formatoBloque'
import { BLOQUES } from './horario/tipos'
import type { Jornada } from './horario/tipos'
import { colorParaBloque } from './horario/gridLogic'
import type { ColorBloque } from './horario/gridLogic'
import { apiGet, apiPatch, ApiError } from '../services/api'
import type { Ambiente, CargaSemanal, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

type FiltroJornada = 'todas' | Jornada
const POR_PAGINA = 10

function jornadaDeHorario(horario: Horario): Jornada | null {
  return BLOQUES.find((bloque) => bloque.horaInicio24 === horario.horaInicio)?.jornada ?? null
}

function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

function colorBarraCarga(horasAsignadas: number, horasMaximas: number) {
  if (horasAsignadas > horasMaximas) return 'bg-red-600 dark:bg-red-500'
  if (horasAsignadas / horasMaximas >= 0.8) return 'bg-amber-500 dark:bg-amber-400'
  return 'bg-emerald-600 dark:bg-emerald-500'
}

interface DetalleHorarioProps {
  horario: Horario
  ficha: Ficha | undefined
  instructor: Usuario | undefined
  ambiente: Ambiente | undefined
  sedeNombre: string | undefined
  trimestre: Trimestre | undefined
  jornada: Jornada | null
  color: ColorBloque
  diasPorId: Record<number, string>
  onCerrar: () => void
  onCambiarPublicado: (horario: Horario) => void
}

/**
 * La caja que se expande bajo la fila — junta TODO lo que hoy está
 * repartido entre Fichas.tsx/Instructores.tsx/Ambientes.tsx (más la carga
 * semanal, que solo vivía en el drawer de instructor) en un solo lugar, en
 * vez de un resumen con links hacia allá. Componente aparte (no un bloque
 * inline en el .map de la tabla) para que la carga semanal se pida sola al
 * montar/desmontar con la fila — sin tener que comparar "instructor
 * anterior vs. actual" a mano como hace Instructores.tsx.
 */
function DetalleHorario({ horario, ficha, instructor, ambiente, sedeNombre, trimestre, jornada, color, diasPorId, onCerrar, onCambiarPublicado }: DetalleHorarioProps) {
  const [cargaSemanal, setCargaSemanal] = useState<CargaSemanal | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const [publicando, setPublicando] = useState(false)

  async function alternarPublicado() {
    setPublicando(true)
    try {
      const actualizado = await apiPatch<Horario>(`/horarios/${horario.idHorario}/estado`, { publicado: !horario.publicado })
      onCambiarPublicado(actualizado)
    } catch {
      // Error no fatal — el botón simplemente no cambia de estado; el
      // usuario puede reintentar. No hay un lugar de error dedicado acá
      // (esta caja no tiene su propia zona de mensajes de error).
    } finally {
      setPublicando(false)
    }
  }

  useEffect(() => {
    apiGet<CargaSemanal>(`/usuarios/${horario.idInstructor}/carga-semanal`)
      .then(setCargaSemanal)
      .catch(() => setErrorCarga(true))
  }, [horario.idInstructor])

  // Sin ocultarFilasVacias a propósito: el pedido fue mostrar el horario
  // "tal como se ve en el creador" (NuevoHorario.tsx), o sea la plantilla
  // institucional completa (las 3 jornadas, los 6 bloques, Receso incluido)
  // con la única celda asignada resaltada, no un recorte a lo mínimo.
  const { bloques, grid } = convertirHorariosAGrid([horario])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-1 text-xs font-semibold ${color.fondo} ${color.texto}`}>Horario #{horario.idHorario}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">Jornada {jornada ?? 'sin definir'}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{trimestre?.nombre ?? 'Sin trimestre'}</span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              horario.publicado
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
            }`}
          >
            {horario.publicado ? 'Publicado' : 'Borrador'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void alternarPublicado()}
            disabled={publicando}
            title={horario.publicado ? 'Deja de mostrarse en "Mi horario" para el instructor' : 'A partir de ahora el instructor lo ve en "Mi horario"'}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {publicando ? 'Guardando…' : horario.publicado ? 'Despublicar' : 'Publicar'}
          </button>
          <Link
            to={`/horarios/historial?id=${horario.idHorario}`}
            title="El historial todavía no distingue horarios individuales — se está rediseñando como registro de cambios, por ahora esto abre el listado general."
            className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400"
          >
            Detalles de creación / Modificar →
          </Link>
          <button type="button" onClick={onCerrar} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            Cerrar
          </button>
        </div>
      </div>

      <SeccionDrawer titulo="Horario semanal — igual que en el creador de horarios">
        <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
      </SeccionDrawer>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ficha</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{horario.fichaCodigo ?? 'Sin definir'}</p>
          {ficha ? (
            <dl className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div>{ficha.programa.nombrePrograma} ({ficha.programa.codigoPrograma})</div>
              <div>Nivel: {ficha.programa.nivelFormacion ?? 'Sin definir'}</div>
              <div>Trimestre: {ficha.trimestre.nombre} ({ficha.trimestre.fechaInicio} a {ficha.trimestre.fechaFin})</div>
              <div>Aprendices: {ficha.aprendicesTotales}</div>
              <div>Jornadas de la ficha: {ficha.jornadas.length ? ficha.jornadas.join(', ') : 'Sin horario'}</div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Sin más datos disponibles.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 dark:border-slate-700">
            <Link to={`/fichas?id=${horario.idFicha}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Más info →</Link>
            <Link to={`/vista-fichas?id=${horario.idFicha}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Ver horario por ficha →</Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Instructor</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{horario.instructorNombre ?? 'Sin definir'}</p>
          {instructor ? (
            <dl className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div>{instructor.email}</div>
              <div>Contrato: {instructor.tipoContrato?.trim() || 'Sin definir'}</div>
              <div>Especialidades: {instructor.especialidades.length ? instructor.especialidades.map((item) => item.nombre).join(', ') : 'Sin asignar'}</div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Sin más datos disponibles.</p>
          )}

          <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Carga semanal</p>
            {errorCarga ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No se pudo calcular.</p>
            ) : !cargaSemanal ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Calculando…</p>
            ) : cargaSemanal.horasMaximas == null ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Sin tope definido (falta tipo de contrato).</p>
            ) : (
              <>
                <p className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-300">{cargaSemanal.horasAsignadas}h / {cargaSemanal.horasMaximas}h</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${colorBarraCarga(cargaSemanal.horasAsignadas, cargaSemanal.horasMaximas)}`}
                    style={{ width: `${Math.min(100, Math.round((cargaSemanal.horasAsignadas / cargaSemanal.horasMaximas) * 100))}%` }}
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 dark:border-slate-700">
            <Link to={`/instructores?id=${horario.idInstructor}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Más info →</Link>
            <Link to={`/vista-instructores?id=${horario.idInstructor}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Ver horario por instructor →</Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ambiente</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{horario.ambienteNombre ?? 'Sin definir'}</p>
          {ambiente ? (
            <dl className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div>Número: {ambiente.numeroAmbiente}</div>
              <div>Tipo: {ambiente.tipoAmbiente}</div>
              <div>Estado: {ambiente.estadoAmbiente}</div>
              <div>Sede: {sedeNombre ?? 'Sin definir'}</div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Sin más datos disponibles.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 dark:border-slate-700">
            <Link to={`/ambientes?id=${horario.idAmbiente}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Más info →</Link>
            <Link to={`/vista-ambientes?id=${horario.idAmbiente}`} className="text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Ver horario por ambiente →</Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tema</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{horario.resultadoCodigo ?? 'Sin definir'}</p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{horario.resultadoDescripcion ?? 'Sin descripción.'}</p>
          <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <div>Días: {nombresDias(horario.dias, diasPorId)}</div>
            <div>Hora: {formatoHora(horario.horaInicio)}-{formatoHora(horario.horaFin)}</div>
          </dl>
        </div>
      </div>
    </div>
  )
}

/**
 * "Horarios completos" — a diferencia de Fichas/Instructores/Ambientes
 * (cada una centrada en UNA entidad y todo lo que tiene alrededor), acá el
 * horario mismo es la fila: cada `GET /horarios/` es un renglón. Clic en
 * una fila expande hacia abajo (no un drawer/panel lateral) una caja con
 * TODA la info combinada — ficha, instructor (con carga semanal), ambiente
 * y tema — igual que se ve repartida entre las otras tres pantallas, más
 * el horario en el mismo formato de grid que usa el creador
 * (`NuevoHorario.tsx`). Historial de horarios (versionado/registro de
 * cambios) es un módulo aparte, no se toca acá.
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
    apiGet<Trimestre[]>('/trimestres/').then(setTrimestres).catch(() => {})
    apiGet<DiaSemana[]>('/dias-semana/').then(setDiasSemana).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  const fichaPorId = new Map(fichas.map((ficha) => [ficha.idFicha, ficha]))
  const instructorPorId = new Map(instructores.map((usuario) => [usuario.idUsuario, usuario]))
  const ambientePorId = new Map(ambientes.map((ambiente) => [ambiente.idAmbiente, ambiente]))
  const sedePorId = new Map(sedes.map((sede) => [sede.idSede, sede.nombreSede]))
  const trimestrePorId = new Map(trimestres.map((trimestre) => [trimestre.idTrimestre, trimestre]))
  const diasPorId = Object.fromEntries(diasSemana.map((dia) => [dia.idDia, dia.nombreDia]))

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos = Number(Boolean(busqueda.trim())) + Number(filtroJornada !== 'todas') + Number(filtroTrimestre !== 'todos')
  const visibles = horarios.filter((horario) => {
    const programa = fichaPorId.get(horario.idFicha)?.programa.nombrePrograma ?? ''
    const coincideTexto =
      !texto ||
      `${horario.fichaCodigo} ${programa} ${horario.instructorNombre} ${horario.ambienteNombre}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideJornada = filtroJornada === 'todas' || jornadaDeHorario(horario) === filtroJornada
    const coincideTrimestre = filtroTrimestre === 'todos' || horario.idTrimestre === Number(filtroTrimestre)
    return coincideTexto && coincideJornada && coincideTrimestre
  })

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)

  return (
    <AppShell activo="Horarios completos">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Horarios completos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cada horario con su ficha, instructor, ambiente y tema en un solo lugar.</p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {horarios.length} horarios</p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de horarios">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtrar horarios</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && (
              <button type="button" onClick={() => { setBusqueda(''); setFiltroJornada('todas'); setFiltroTrimestre('todos') }} className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Horarios</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{horarios.length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Fichas</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{new Set(horarios.map((h) => h.idFicha)).size}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Instructores</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{new Set(horarios.map((h) => h.idInstructor)).size}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="buscar-horario" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label>
            <input id="buscar-horario" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Ficha, programa, instructor o ambiente" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-jornada-horario" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Jornada</label>
            <select id="filtro-jornada-horario" value={filtroJornada} onChange={(evento) => setFiltroJornada(evento.target.value as FiltroJornada)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todas">Todas</option>
              <option value="Mañana">Mañana</option>
              <option value="Tarde">Tarde</option>
              <option value="Noche">Noche</option>
            </select>
          </div>
          <div>
            <label htmlFor="filtro-trimestre-horario" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Trimestre</label>
            <select id="filtro-trimestre-horario" value={filtroTrimestre} onChange={(evento) => setFiltroTrimestre(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {trimestres.map((trimestre) => <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre}</option>)}
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando horarios...</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Días</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Trimestre</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{visiblesPagina.map((horario) => {
        const color = colorParaBloque(String(horario.idHorario))
        const expandido = horario.idHorario === idExpandido
        const jornada = jornadaDeHorario(horario)
        const ambiente = ambientePorId.get(horario.idAmbiente)
        return (
          <Fragment key={horario.idHorario}>
            <tr onClick={() => setIdExpandido(expandido ? null : horario.idHorario)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60">
              <td className={`border-l-4 px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 ${color.borde}`}>{horario.fichaCodigo}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{horario.instructorNombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{horario.ambienteNombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color.fondo} ${color.texto}`}>{jornada ?? 'Sin definir'}</span></td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{nombresDias(horario.dias, diasPorId)}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatoHora(horario.horaInicio)}-{formatoHora(horario.horaFin)}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{trimestrePorId.get(horario.idTrimestre)?.nombre ?? 'Sin definir'}</td>
            </tr>
            {expandido && (
              <tr>
                <td colSpan={7} className="bg-slate-50 dark:bg-slate-900/40">
                  <DetalleHorario
                    horario={horario}
                    ficha={fichaPorId.get(horario.idFicha)}
                    instructor={instructorPorId.get(horario.idInstructor)}
                    ambiente={ambiente}
                    sedeNombre={ambiente ? sedePorId.get(ambiente.idSede) : undefined}
                    trimestre={trimestrePorId.get(horario.idTrimestre)}
                    jornada={jornada}
                    color={color}
                    diasPorId={diasPorId}
                    onCerrar={() => setIdExpandido(null)}
                    onCambiarPublicado={(actualizado) =>
                      setHorarios((anterior) => anterior.map((h) => (h.idHorario === actualizado.idHorario ? actualizado : h)))
                    }
                  />
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hay horarios que coincidan con los filtros.</p>}

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
    </AppShell>
  )
}
