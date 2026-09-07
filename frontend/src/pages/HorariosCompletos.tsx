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
import type { Ambiente, AuditoriaCrucesResponse, CargaSemanal, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../types/api'

// Mismos 4 "modos" que el mockup de Stitch (Vista General/Por Instructor/
// Por Ficha/Por Ambiente), pero acá son links reales a las rutas que YA
// existen (VistaInstructores/VistaFichas/VistaAmbientes) en vez de tabs que
// cambian de contenido en el mismo componente — evita duplicar esas 3
// pantallas dentro de esta.
const MODOS_VISTA = [
  { etiqueta: 'Vista General', ruta: '/horarios/completos', icono: 'grid_view' },
  { etiqueta: 'Por Instructor', ruta: '/vista-instructores', icono: 'person' },
  { etiqueta: 'Por Ficha', ruta: '/vista-fichas', icono: 'groups' },
  { etiqueta: 'Por Ambiente', ruta: '/vista-ambientes', icono: 'meeting_room' },
] as const

type FiltroJornada = 'todas' | Jornada
type FiltroEstado = 'todos' | 'publicado' | 'borrador'
const POR_PAGINA = 10

function badgeEstadoPublicacion(publicado: boolean) {
  return publicado
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
}

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
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-slate-700 dark:text-slate-300">Jornada {jornada ?? 'sin definir'}</span>
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-slate-700 dark:text-slate-300">{trimestre?.nombre ?? 'Sin trimestre'}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeEstadoPublicacion(horario.publicado)}`}>
            {horario.publicado ? 'Publicado' : 'Borrador'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void alternarPublicado()}
            disabled={publicando}
            title={horario.publicado ? 'Deja de mostrarse en "Mi horario" para el instructor' : 'A partir de ahora el instructor lo ve en "Mi horario"'}
            className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {publicando ? 'Guardando…' : horario.publicado ? 'Despublicar' : 'Publicar'}
          </button>
          <Link
            to={`/horarios/historial?id=${horario.idHorario}`}
            title="El historial todavía no distingue horarios individuales — se está rediseñando como registro de cambios, por ahora esto abre el listado general."
            className="text-sm font-medium text-primary hover:text-on-primary-container dark:text-sena-400"
          >
            Detalles de creación / Modificar →
          </Link>
          <button type="button" onClick={onCerrar} className="text-sm font-medium text-on-surface-variant hover:text-on-surface dark:text-slate-400 dark:hover:text-slate-100">
            Cerrar
          </button>
        </div>
      </div>

      <SeccionDrawer titulo="Horario semanal — igual que en el creador de horarios">
        <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
      </SeccionDrawer>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Ficha</p>
          <p className="text-sm font-semibold text-on-surface dark:text-slate-100">{horario.fichaCodigo ?? 'Sin definir'}</p>
          {ficha ? (
            <dl className="mt-1.5 space-y-1 text-xs text-on-surface-variant dark:text-slate-300">
              <div>{ficha.programa.nombrePrograma} ({ficha.programa.codigoPrograma})</div>
              <div>Nivel: {ficha.programa.nivelFormacion ?? 'Sin definir'}</div>
              <div>Trimestre: {ficha.trimestre.nombre} ({ficha.trimestre.fechaInicio} a {ficha.trimestre.fechaFin})</div>
              <div>Aprendices: {ficha.aprendicesTotales}</div>
              <div>Jornadas de la ficha: {ficha.jornadas.length ? ficha.jornadas.join(', ') : 'Sin horario'}</div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-on-surface-variant dark:text-slate-400">Sin más datos disponibles.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-outline-variant pt-2 dark:border-slate-700">
            <Link to={`/fichas?id=${horario.idFicha}`} className="text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Más info →</Link>
            <Link to={`/vista-fichas?id=${horario.idFicha}`} className="text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Ver horario por ficha →</Link>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Instructor</p>
          <p className="text-sm font-semibold text-on-surface dark:text-slate-100">{horario.instructorNombre ?? 'Sin definir'}</p>
          {instructor ? (
            <dl className="mt-1.5 space-y-1 text-xs text-on-surface-variant dark:text-slate-300">
              <div>{instructor.email}</div>
              <div>Contrato: {instructor.tipoContrato?.trim() || 'Sin definir'}</div>
              <div>Especialidades: {instructor.especialidades.length ? instructor.especialidades.map((item) => item.nombre).join(', ') : 'Sin asignar'}</div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-on-surface-variant dark:text-slate-400">Sin más datos disponibles.</p>
          )}

          <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-on-surface-variant dark:text-slate-400">Carga semanal</p>
            {errorCarga ? (
              <p className="text-xs text-on-surface-variant dark:text-slate-400">No se pudo calcular.</p>
            ) : !cargaSemanal ? (
              <p className="text-xs text-on-surface-variant dark:text-slate-400">Calculando…</p>
            ) : cargaSemanal.horasMaximas == null ? (
              <p className="text-xs text-on-surface-variant dark:text-slate-400">Sin tope definido (falta tipo de contrato).</p>
            ) : (
              <>
                <p className="mb-1 text-xs font-medium text-on-surface dark:text-slate-300">{cargaSemanal.horasAsignadas}h / {cargaSemanal.horasMaximas}h</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${colorBarraCarga(cargaSemanal.horasAsignadas, cargaSemanal.horasMaximas)}`}
                    style={{ width: `${Math.min(100, Math.round((cargaSemanal.horasAsignadas / cargaSemanal.horasMaximas) * 100))}%` }}
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-outline-variant pt-2 dark:border-slate-700">
            <Link to={`/instructores?id=${horario.idInstructor}`} className="text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Más info →</Link>
            <Link to={`/vista-instructores?id=${horario.idInstructor}`} className="text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Ver horario por instructor →</Link>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Ambiente</p>
          <p className="text-sm font-semibold text-on-surface dark:text-slate-100">{horario.ambienteNombre ?? 'Sin definir'}</p>
          {ambiente ? (
            <dl className="mt-1.5 space-y-1 text-xs text-on-surface-variant dark:text-slate-300">
              <div>Número: {ambiente.numeroAmbiente}</div>
              <div>Tipo: {ambiente.tipoAmbiente}</div>
              <div>Estado: {ambiente.estadoAmbiente}</div>
              <div>Sede: {sedeNombre ?? 'Sin definir'}</div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-on-surface-variant dark:text-slate-400">Sin más datos disponibles.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-outline-variant pt-2 dark:border-slate-700">
            <Link to={`/ambientes?id=${horario.idAmbiente}`} className="text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Más info →</Link>
            <Link to={`/vista-ambientes?id=${horario.idAmbiente}`} className="text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Ver horario por ambiente →</Link>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">Tema</p>
          <p className="text-sm font-semibold text-on-surface dark:text-slate-100">{horario.resultadoCodigo ?? 'Sin definir'}</p>
          <p className="mt-1.5 text-xs text-on-surface-variant dark:text-slate-300">{horario.resultadoDescripcion ?? 'Sin descripción.'}</p>
          <dl className="mt-2 space-y-1 text-xs text-on-surface-variant dark:text-slate-300">
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
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [paginaActual, setPaginaActual] = useState(1)
  const [idExpandido, setIdExpandido] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Resumen real de conflictos (mismo endpoint que AuditoriaCruces.tsx) para
  // el panel lateral "Auditoría" del mockup — no es un dato nuevo inventado,
  // es el mismo GET /horarios/auditoria-cruces ya construido.
  const [auditoria, setAuditoria] = useState<AuditoriaCrucesResponse | null>(null)

  useEffect(() => {
    apiGet<AuditoriaCrucesResponse>('/horarios/auditoria-cruces').then(setAuditoria).catch(() => {})
  }, [])

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
          <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Vistas de Horarios — Coordinación Académica</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">Cada horario con su ficha, instructor, ambiente y tema en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" aria-hidden="true" />
            Auditoría de Malla Activa
          </span>
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {horarios.length} horarios</p>
        </div>
      </div>

      {/* Selector de perspectiva — mismos 4 modos del mockup, como links
       * reales a las vistas que ya existen (evita duplicar Vista por
       * fichas/instructores/ambientes dentro de esta pantalla). */}
      <nav aria-label="Cambiar vista de horarios" className="mb-4 inline-flex items-center gap-1 rounded-full bg-surface-container-low p-1 dark:bg-slate-900">
        {MODOS_VISTA.map((modo) => (
          <Link
            key={modo.ruta}
            to={modo.ruta}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              modo.etiqueta === 'Vista General'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-on-surface-variant hover:text-on-surface dark:text-slate-400'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{modo.icono}</span>
            {modo.etiqueta}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
          <div>
            <label htmlFor="filtro-trimestre-horario" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Trimestre</label>
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
        </div>
      </section>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando horarios...</p> : <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-surface text-xs font-semibold uppercase text-on-surface-variant dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Días</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Trimestre</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-outline-variant dark:divide-slate-700">{visiblesPagina.map((horario) => {
        const color = colorParaBloque(String(horario.idHorario))
        const expandido = horario.idHorario === idExpandido
        const jornada = jornadaDeHorario(horario)
        const ambiente = ambientePorId.get(horario.idAmbiente)
        return (
          <Fragment key={horario.idHorario}>
            <tr onClick={() => setIdExpandido(expandido ? null : horario.idHorario)} className="cursor-pointer hover:bg-surface-container-low dark:hover:bg-slate-700/60">
              <td className={`border-l-4 px-4 py-3 font-semibold text-on-surface dark:text-slate-100 ${color.borde}`}>{horario.fichaCodigo}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{horario.instructorNombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{horario.ambienteNombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color.fondo} ${color.texto}`}>{jornada ?? 'Sin definir'}</span></td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{nombresDias(horario.dias, diasPorId)}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{formatoHora(horario.horaInicio)}-{formatoHora(horario.horaFin)}</td>
              <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{trimestrePorId.get(horario.idTrimestre)?.nombre ?? 'Sin definir'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeEstadoPublicacion(horario.publicado)}`}>
                  {horario.publicado ? 'Publicado' : 'Borrador'}
                </span>
              </td>
            </tr>
            {expandido && (
              <tr>
                <td colSpan={8} className="bg-surface dark:bg-slate-900/40">
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

      <aside className="space-y-4">
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface dark:text-slate-100">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">insights</span>
              Auditoría de cruces
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              (auditoria?.conflictos.length ?? 0) > 0 ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
            }`}>
              {auditoria === null ? '…' : auditoria.conflictos.length}
            </span>
          </div>
          {auditoria === null ? (
            <p className="text-xs text-on-surface-variant dark:text-slate-400">Auditando horarios…</p>
          ) : auditoria.conflictos.length === 0 ? (
            <p className="text-xs text-on-surface-variant dark:text-slate-400">Sin conflictos activos entre los horarios guardados.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-on-surface-variant dark:text-slate-400">
                {auditoria.conflictos.length} conflicto{auditoria.conflictos.length === 1 ? '' : 's'} activo{auditoria.conflictos.length === 1 ? '' : 's'} entre horarios ya guardados.
              </p>
              <div className="space-y-1.5">
                {auditoria.resumen.tipos.map((tipo) => (
                  <div key={tipo} className="flex items-center justify-between rounded-lg bg-surface-container-low px-2.5 py-1.5 text-xs dark:bg-slate-900">
                    <span className="text-on-surface-variant dark:text-slate-300">{tipo}</span>
                    <span className="font-semibold text-on-surface dark:text-slate-100">{auditoria.conflictos.filter((c) => c.tipo === tipo).length}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <Link
            to="/horarios/auditoria"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-on-primary-container dark:text-sena-400"
          >
            Ver auditoría completa →
          </Link>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-1 text-sm font-bold text-on-surface dark:text-slate-100">Resolución en Constructor Ágil</h2>
          <p className="mb-3 text-xs text-on-surface-variant dark:text-slate-400">
            Para ajustar ambientes, reasignar fichas o corregir cruces, use el módulo Constructor.
          </p>
          <Link
            to="/horarios/nuevo"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit_calendar</span>
            Abrir Constructor
          </Link>
        </section>
      </aside>
      </div>
    </AppShell>
  )
}
