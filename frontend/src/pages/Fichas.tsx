import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { indexarPorFicha, opcionesInstructor } from '../components/horario/indexarHorarios'
import { SeccionAmbientesAsignados, SeccionTemasQueDicta } from '../components/relacionados/SeccionesInstructor'
import { SeccionInstructoresAsignados } from '../components/relacionados/SeccionesFicha'
import { ImportarArchivo, type ColumnaImportar } from '../components/ImportarArchivo'
import { apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { DiaSemana, Ficha, Horario, Programa, Sede, Trimestre, Usuario } from '../types/api'
import type { FilaCsv } from '../utils/csv'

const COLUMNAS_IMPORTAR_FICHA: ColumnaImportar[] = [
  { clave: 'codigoFicha', encabezado: 'codigoFicha' },
  { clave: 'codigoPrograma', encabezado: 'codigoPrograma' },
  { clave: 'trimestre', encabezado: 'trimestre' },
  { clave: 'sede', encabezado: 'sede', requerido: false },
]

type Orden = 'codigo' | 'programa' | 'trimestre'

const POR_PAGINA = 10

type FichaForm = { codigoFicha: string; idPrograma: string; idTrimestre: string; idSede: string; fechaInicioLectiva: string; fechaFinLectiva: string; fechaInicioProductiva: string; fechaFinProductiva: string; faseActual: string }
const FORM_VACIO: FichaForm = { codigoFicha: '', idPrograma: '', idTrimestre: '', idSede: '', fechaInicioLectiva: '', fechaFinLectiva: '', fechaInicioProductiva: '', fechaFinProductiva: '', faseActual: '' }

function nivel(ficha: Ficha) {
  return ficha.programa.nivelFormacion || 'Sin definir'
}

type Etapa = 'Lectiva' | 'Productiva' | 'Por iniciar' | 'Finalizada' | 'Sin definir'

const ETAPA_BADGE: Record<Etapa, string> = {
  Lectiva: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  Productiva: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  'Por iniciar': 'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300',
  Finalizada: 'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300',
  'Sin definir': 'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300',
}

// Deriva la etapa (Lectiva/Productiva) a partir de las 4 fechas reales de
// la ficha (fechaInicioLectiva/fechaFinLectiva/fechaInicioProductiva/
// fechaFinProductiva) — el backend no tiene una columna "estado" para
// esto, solo las fechas, así que se calcula contra la fecha de hoy.
function etapaFicha(ficha: Ficha): Etapa {
  const hoy = new Date().toISOString().slice(0, 10)
  const { fechaInicioLectiva, fechaFinLectiva, fechaInicioProductiva, fechaFinProductiva } = ficha

  if (!fechaInicioLectiva && !fechaInicioProductiva) return 'Sin definir'
  if (fechaInicioProductiva && fechaFinProductiva && hoy >= fechaInicioProductiva && hoy <= fechaFinProductiva) return 'Productiva'
  if (fechaInicioLectiva && fechaFinLectiva && hoy >= fechaInicioLectiva && hoy <= fechaFinLectiva) return 'Lectiva'
  if (fechaInicioLectiva && hoy < fechaInicioLectiva) return 'Por iniciar'
  if (fechaFinProductiva && hoy > fechaFinProductiva) return 'Finalizada'
  return 'Sin definir'
}

function formatFecha(fecha: string | null | undefined) {
  if (!fecha) return null
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function Fichas() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [programa, setPrograma] = useState('todos')
  const [nivelFormacion, setNivelFormacion] = useState('todos')
  const [jornada, setJornada] = useState('todas')
  const [instructor, setInstructor] = useState('todos')
  const [etapa, setEtapa] = useState('todas')
  const [orden, setOrden] = useState<Orden>('codigo')
  const [paginaActual, setPaginaActual] = useState(1)
  const [seleccionada, setSeleccionada] = useState<Ficha | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FichaForm>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  // SCRUM-89: carga masiva por CSV. El catálogo completo (no solo lo que
  // ya tiene fichas creadas) se pide recién al abrir el panel, para
  // resolver codigoPrograma/trimestre/sede del archivo a los ids que pide
  // POST /fichas/.
  const [mostrarImportar, setMostrarImportar] = useState(false)
  const [catalogoProgramas, setCatalogoProgramas] = useState<Programa[] | null>(null)
  const [catalogoTrimestres, setCatalogoTrimestres] = useState<Trimestre[] | null>(null)
  const [catalogoSedes, setCatalogoSedes] = useState<Sede[] | null>(null)

  // Horarios reales de la ficha seleccionada — alimenta el grid semanal
  // del drawer (SCRUM-67, reusa GridHorario en solo-lectura). Se piden
  // solo al abrir el drawer, mismo patrón que Instructores.tsx.
  const [horariosFicha, setHorariosFicha] = useState<{ idFicha: number; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<number | null>(null)
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})
  // Todos los horarios del sistema — para filtrar la lista de fichas por
  // instructor sin pedir los horarios de cada ficha uno por uno (mismo
  // patrón que Instructores.tsx con ficha/ambiente).
  const [todosLosHorarios, setTodosLosHorarios] = useState<Horario[]>([])

  async function cargarFichas() {
    const datos = await apiGet<Ficha[]>('/fichas/')
    setFichas(datos)
    return datos
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarFichas()
      .then((datos) => {
        setFichas(datos)

        // Deep link desde VistaFichas.tsx ("Ver info" → /fichas?id=...):
        // abre el drawer de esa ficha directo — mismo patrón que
        // Instructores.tsx con VistaInstructores.tsx.
        if (idDesdeUrl) {
          const encontrada = datos.find((ficha) => ficha.idFicha === Number(idDesdeUrl))
          if (encontrada) setSeleccionada(encontrada)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de fichas.'))
      .finally(() => setCargando(false))
    // Sin .catch dedicado no rompe nada visible (nombresDias cae a "?" por
    // día si falta el mapa), pero deja una unhandled rejection en tests —
    // mismo patrón que Instructores.tsx.
    apiGet<DiaSemana[]>('/dias-semana/')
      .then((dias) => setDiasPorId(Object.fromEntries(dias.map((d) => [d.idDia, d.nombreDia]))))
      .catch(() => {})

    apiGet<Horario[]>('/horarios/')
      .then(setTodosLosHorarios)
      .catch(() => {})
    apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  useEffect(() => {
    if (!seleccionada) return

    apiGet<Horario[]>(`/fichas/${seleccionada.idFicha}/horarios`)
      .then((datos) => setHorariosFicha({ idFicha: seleccionada.idFicha, datos }))
      .catch(() => setErrorHorariosPara(seleccionada.idFicha))
  }, [seleccionada])

  useEffect(() => {
    if (!mostrarImportar || catalogoProgramas) return

    Promise.all([apiGet<Programa[]>('/programas/'), apiGet<Trimestre[]>('/trimestres/'), apiGet<Sede[]>('/sedes')])
      .then(([programas, trimestres, sedes]) => {
        setCatalogoProgramas(programas)
        setCatalogoTrimestres(trimestres)
        setCatalogoSedes(sedes)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo para importar.'))
  }, [mostrarImportar, catalogoProgramas])

  async function importarFilaFicha(fila: FilaCsv) {
    const codigoFicha = fila.codigoFicha?.trim()
    const codigoPrograma = fila.codigoPrograma?.trim()
    const nombreTrimestre = fila.trimestre?.trim()
    const nombreSede = fila.sede?.trim()

    if (!codigoFicha) throw new Error('Falta codigoFicha.')
    if (!codigoPrograma) throw new Error('Falta codigoPrograma.')
    if (!nombreTrimestre) throw new Error('Falta trimestre.')

    const programaEncontrado = catalogoProgramas?.find((item) => item.codigoPrograma.toLocaleUpperCase('es-CO') === codigoPrograma.toLocaleUpperCase('es-CO'))
    if (!programaEncontrado) throw new Error(`No existe el programa "${codigoPrograma}".`)

    const trimestreEncontrado = catalogoTrimestres?.find((item) => item.nombre.toLocaleUpperCase('es-CO') === nombreTrimestre.toLocaleUpperCase('es-CO'))
    if (!trimestreEncontrado) throw new Error(`No existe el trimestre "${nombreTrimestre}".`)

    const sedeEncontrada = nombreSede ? catalogoSedes?.find((item) => item.nombreSede.toLocaleUpperCase('es-CO') === nombreSede.toLocaleUpperCase('es-CO')) : undefined
    if (nombreSede && !sedeEncontrada) throw new Error(`No existe la sede "${nombreSede}".`)

    await apiPost('/fichas/', {
      codigoFicha,
      idPrograma: programaEncontrado.idPrograma,
      idTrimestre: trimestreEncontrado.idTrimestre,
      idSede: sedeEncontrada ? sedeEncontrada.idSede : null,
    })
  }

  function refrescarFichasTrasImportar() {
    apiGet<Ficha[]>('/fichas/')
      .then(setFichas)
      .catch(() => {})
  }

  const horariosVigentes = seleccionada && horariosFicha?.idFicha === seleccionada.idFicha ? horariosFicha.datos : null
  const errorHorarios = seleccionada?.idFicha === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionada) && horariosVigentes === null && !errorHorarios
  const { bloques: bloquesGrid, grid } = convertirHorariosAGrid(horariosVigentes ?? [])

  const programas = [...new Set(fichas.map((ficha) => ficha.programa.nombrePrograma))].sort()
  const niveles = [...new Set(fichas.map(nivel))].sort()
  const jornadas = [...new Set(fichas.flatMap((ficha) => ficha.jornadas))].sort()
  const indiceInstructoresPorFicha = indexarPorFicha(todosLosHorarios)
  // Ambiente(s) reales asignados a cada ficha — derivado de los horarios ya
  // cargados (mismo patrón que indiceInstructoresPorFicha), para la columna
  // "Ambiente" de la tabla (sección del mockup Directorio de Fichas).
  const ambientesPorFicha = new Map<number, string[]>()
  for (const horario of todosLosHorarios) {
    if (!horario.ambienteNombre) continue
    const lista = ambientesPorFicha.get(horario.idFicha) ?? []
    if (!lista.includes(horario.ambienteNombre)) lista.push(horario.ambienteNombre)
    ambientesPorFicha.set(horario.idFicha, lista)
  }
  const instructores = opcionesInstructor(todosLosHorarios)
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos =
    Number(Boolean(busqueda.trim())) + Number(programa !== 'todos') + Number(nivelFormacion !== 'todos') + Number(jornada !== 'todas') + Number(instructor !== 'todos') + Number(etapa !== 'todas')
  const visibles = fichas.filter((ficha) => {
    const coincideTexto = !texto || `${ficha.codigoFicha} ${ficha.programa.nombrePrograma} ${ficha.programa.codigoPrograma}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideJornada = jornada === 'todas' || ficha.jornadas.includes(jornada)
    const coincideInstructor = instructor === 'todos' || (indiceInstructoresPorFicha.get(ficha.idFicha)?.has(instructor) ?? false)
    const coincideEtapa = etapa === 'todas' || etapaFicha(ficha) === etapa
    return coincideTexto && coincideJornada && coincideInstructor && coincideEtapa && (programa === 'todos' || ficha.programa.nombrePrograma === programa) && (nivelFormacion === 'todos' || nivel(ficha) === nivelFormacion)
  }).sort((primera, segunda) => {
    if (orden === 'programa') return primera.programa.nombrePrograma.localeCompare(segunda.programa.nombrePrograma, 'es-CO')
    if (orden === 'trimestre') return primera.trimestre.nombre.localeCompare(segunda.trimestre.nombre, 'es-CO')
    return primera.codigoFicha.localeCompare(segunda.codigoFicha, 'es-CO', { numeric: true })
  })

  // Mismo patrón clamped que Instructores.tsx: sin useEffect de reseteo.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)
  const puedeGestionar = perfil?.roles.some((rol) => rol.nombre === 'Administrador') ?? false

  function abrirCrear() {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError(null)
    setModalAbierto(true)
  }

  function abrirEditar(ficha: Ficha) {
    setEditandoId(ficha.idFicha)
    setForm({ codigoFicha: ficha.codigoFicha, idPrograma: String(ficha.idPrograma), idTrimestre: String(ficha.idTrimestre), idSede: ficha.idSede == null ? '' : String(ficha.idSede), fechaInicioLectiva: ficha.fechaInicioLectiva ?? '', fechaFinLectiva: ficha.fechaFinLectiva ?? '', fechaInicioProductiva: ficha.fechaInicioProductiva ?? '', fechaFinProductiva: ficha.fechaFinProductiva ?? '', faseActual: ficha.faseActual == null ? '' : String(ficha.faseActual) })
    setError(null)
    setModalAbierto(true)
  }

  async function guardarFicha(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const codigoFicha = form.codigoFicha.trim()
    const idPrograma = Number(form.idPrograma)
    const idTrimestre = Number(form.idTrimestre)
    if (!codigoFicha || !idPrograma || !idTrimestre) {
      setError('Código, programa y trimestre son obligatorios.')
      return
    }
    const payload = { codigoFicha, idPrograma, idTrimestre, idSede: form.idSede ? Number(form.idSede) : null, fechaInicioLectiva: form.fechaInicioLectiva || null, fechaFinLectiva: form.fechaFinLectiva || null, fechaInicioProductiva: form.fechaInicioProductiva || null, fechaFinProductiva: form.fechaFinProductiva || null, faseActual: form.faseActual ? Number(form.faseActual) : null }
    try {
      setGuardando(true)
      setError(null)
      const respuesta = editandoId === null ? await apiPost<Ficha>('/fichas/', payload) : await apiPut<Ficha>(`/fichas/${editandoId}`, payload)
      const datos = await cargarFichas()
      setSeleccionada(datos.find((ficha) => ficha.idFicha === respuesta.idFicha) ?? respuesta)
      setModalAbierto(false)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la ficha.')
    } finally {
      setGuardando(false)
    }
  }

  const totalLectiva = fichas.filter((ficha) => etapaFicha(ficha) === 'Lectiva').length
  // "Franjas pendientes" del mockup: fichas sin ninguna jornada programada
  // todavía (dato real, derivado de ficha.jornadas — no de un endpoint
  // agregado que no existe).
  const fichasSinJornada = fichas.filter((ficha) => ficha.jornadas.length === 0).length

  const chips: { etiqueta: string; quitar: () => void }[] = []
  if (busqueda.trim()) chips.push({ etiqueta: `"${busqueda.trim()}"`, quitar: () => setBusqueda('') })
  if (programa !== 'todos') chips.push({ etiqueta: programa, quitar: () => setPrograma('todos') })
  if (nivelFormacion !== 'todos') chips.push({ etiqueta: nivelFormacion, quitar: () => setNivelFormacion('todos') })
  if (jornada !== 'todas') chips.push({ etiqueta: jornada, quitar: () => setJornada('todas') })
  if (instructor !== 'todos') chips.push({ etiqueta: instructor, quitar: () => setInstructor('todos') })
  if (etapa !== 'todas') chips.push({ etiqueta: etapa, quitar: () => setEtapa('todas') })

  return (
    <AppShell activo="Fichas">
      <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant dark:text-slate-400">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span className="text-outline">/</span>
        <span className="text-primary">Fichas</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-on-surface dark:text-slate-100">Directorio de Fichas de Caracterización</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary-container dark:bg-sena-950/50">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {fichas.length} fichas activas
            </span>
          </div>
          <p className="max-w-2xl text-sm text-on-surface-variant dark:text-slate-400">Fichas de formación registradas por programa y trimestre — monitoreo de cupos, asignación horaria y ambientes asignados.</p>
        </div>
        <div className="flex items-center gap-2">
          {puedeGestionar && <button type="button" onClick={abrirCrear} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-on-primary-container">+ Nueva ficha</button>}
          <button type="button" onClick={() => setMostrarImportar((valor) => !valor)} className="rounded-xl border border-outline px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">{mostrarImportar ? 'Ocultar carga de archivo' : 'Cargar archivo'}</button>
          <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {fichas.length} fichas</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-on-surface-variant dark:text-slate-400">Total de fichas</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{fichas.length}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant/70">{visibles.length} coinciden con los filtros</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-on-surface-variant dark:text-slate-400">Fichas en etapa lectiva</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{totalLectiva}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant/70">{fichas.length ? Math.round((totalLectiva / fichas.length) * 100) : 0}% del total</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-on-surface-variant dark:text-slate-400">Franjas pendientes</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{fichasSinJornada}</p>
          <p className="mt-0.5 text-xs text-tertiary">{fichasSinJornada > 0 ? 'Requieren asignación' : 'Todas programadas'}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium text-on-surface-variant dark:text-slate-400">Programas formativos</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{programas.length}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant/70">Distintos en este listado</p>
        </div>
      </div>

      {mostrarImportar && (
        <ImportarArchivo
          columnas={COLUMNAS_IMPORTAR_FICHA}
          onImportarFila={importarFilaFicha}
          onTerminado={refrescarFichasTrasImportar}
          onCerrar={() => setMostrarImportar(false)}
        />
      )}

      <section className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de fichas">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Filtrar fichas</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-primary dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && <button type="button" onClick={() => { setBusqueda(''); setPrograma('todos'); setNivelFormacion('todos'); setJornada('todas'); setInstructor('todos'); setEtapa('todas') }} className="text-sm font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Limpiar filtros</button>}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">Activas</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{fichas.filter((ficha) => ficha.trimestre.estado === 'activo').length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">Aprendices</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{fichas.reduce((total, ficha) => total + ficha.aprendicesTotales, 0)}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">Programas</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{programas.length}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <div className="md:col-span-2 lg:col-span-1"><label htmlFor="buscar-ficha" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Buscar</label><input id="buscar-ficha" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Código o programa" className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></div>
          <div><label htmlFor="filtro-programa" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Programa</label><select id="filtro-programa" value={programa} onChange={(evento) => setPrograma(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{programas.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-nivel" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Nivel</label><select id="filtro-nivel" value={nivelFormacion} onChange={(evento) => setNivelFormacion(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{niveles.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-jornada" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Jornada</label><select id="filtro-jornada" value={jornada} onChange={(evento) => setJornada(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todas">Todas</option>{jornadas.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-instructor" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Instructor</label><select id="filtro-instructor" value={instructor} onChange={(evento) => setInstructor(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{instructores.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-etapa" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Etapa</label><select id="filtro-etapa" value={etapa} onChange={(evento) => setEtapa(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todas">Todas</option><option value="Lectiva">Lectiva</option><option value="Productiva">Productiva</option><option value="Por iniciar">Por iniciar</option><option value="Finalizada">Finalizada</option><option value="Sin definir">Sin definir</option></select></div>
          <div><label htmlFor="orden-ficha" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Ordenar por</label><select id="orden-ficha" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="codigo">Código</option><option value="programa">Programa</option><option value="trimestre">Trimestre</option></select></div>
        </div>
      </section>

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant/70">Filtros activos:</span>
          {chips.map((chip) => (
            <button
              key={chip.etiqueta}
              type="button"
              onClick={chip.quitar}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high dark:bg-slate-700 dark:text-slate-300"
            >
              {chip.etiqueta}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setBusqueda(''); setPrograma('todos'); setNivelFormacion('todos'); setJornada('todas'); setInstructor('todos'); setEtapa('todas') }}
            className="text-xs font-semibold text-primary hover:text-on-primary-container dark:text-sena-400"
          >
            Restablecer todo
          </button>
        </div>
      )}

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando fichas...</p> : <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-surface text-xs font-semibold uppercase text-on-surface-variant dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Programa</th><th className="px-4 py-3">Nivel</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Etapa</th><th className="px-4 py-3">Sede</th><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Aprendices</th><th className="px-4 py-3">Trimestre</th><th className="px-4 py-3">Estado</th>{puedeGestionar && <th className="px-4 py-3">Acciones</th>}</tr></thead><tbody className="divide-y divide-outline-variant dark:divide-slate-700">{visiblesPagina.map((ficha) => <tr key={ficha.idFicha} onClick={() => setSeleccionada(ficha)} className="cursor-pointer border-l-4 border-l-transparent hover:border-l-primary hover:bg-surface dark:hover:bg-slate-700/60"><td className="px-4 py-3 font-semibold text-on-surface dark:text-slate-100">{ficha.codigoFicha}</td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300"><p>{ficha.programa.nombrePrograma}</p><p className="text-xs text-on-surface-variant/70">{ficha.programa.codigoPrograma}</p></td><td className="px-4 py-3"><span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-primary dark:bg-sena-950/50">{nivel(ficha)}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{ficha.jornadas.length ? ficha.jornadas.map((item) => <span key={item} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{item}</span>) : <span className="text-on-surface-variant/70">Sin horario</span>}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ETAPA_BADGE[etapaFicha(ficha)]}`}>{etapaFicha(ficha)}</span></td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{ficha.sede?.nombreSede ?? 'Sin sede'}</td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{(ambientesPorFicha.get(ficha.idFicha) ?? []).join(', ') || 'Sin asignar'}</td><td className="px-4 py-3 font-medium text-on-surface dark:text-slate-300">{ficha.aprendicesTotales}</td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{ficha.trimestre.nombre}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{ficha.trimestre.estado}</span></td>{puedeGestionar && <td className="px-4 py-3"><button type="button" onClick={(evento) => { evento.stopPropagation(); abrirEditar(ficha) }} className="rounded-xl border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Editar</button></td>}</tr>)}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">No hay fichas que coincidan con los filtros.</p>}

        {visibles.length > 0 && (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-on-surface-variant dark:text-slate-400">
              Mostrando {visiblesPagina.length} de {visibles.length} registros
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
                disabled={paginaSegura === 1}
                aria-label="Página anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
              </button>
              {Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
                .filter((numero) => numero === 1 || numero === totalPaginas || Math.abs(numero - paginaSegura) <= 1)
                .map((numero, indice, lista) => (
                  <span key={numero} className="flex items-center gap-1.5">
                    {indice > 0 && lista[indice - 1] !== numero - 1 && <span className="px-1 text-on-surface-variant/70">…</span>}
                    <button
                      type="button"
                      onClick={() => setPaginaActual(numero)}
                      aria-current={numero === paginaSegura ? 'page' : undefined}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                        numero === paginaSegura
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {numero}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
                disabled={paginaSegura === totalPaginas}
                aria-label="Página siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>}

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
        <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">info</span>
        <p className="text-sm text-on-surface-variant dark:text-slate-400">
          Las fichas sin franja asignada o con cruces de horario se resuelven desde el{' '}
          <Link to="/horarios/nuevo" className="font-semibold text-primary hover:text-on-primary-container dark:text-sena-400">Constructor Ágil</Link>.
        </p>
      </div>

      {puedeGestionar && modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4" role="presentation">
          <form onSubmit={guardarFicha} className="w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-2xl dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="titulo-formulario-ficha">
            <div className="mb-5 flex items-center justify-between"><h2 id="titulo-formulario-ficha" className="text-xl font-semibold text-on-surface dark:text-slate-100">{editandoId === null ? 'Nueva ficha' : 'Editar ficha'}</h2><button type="button" onClick={() => setModalAbierto(false)} className="text-sm text-on-surface-variant">Cancelar</button></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-on-surface dark:text-slate-300">Código de ficha<input required value={form.codigoFicha} onChange={(evento) => setForm({ ...form, codigoFicha: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">ID del programa<input required type="number" min="1" value={form.idPrograma} onChange={(evento) => setForm({ ...form, idPrograma: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">ID del trimestre<input required type="number" min="1" value={form.idTrimestre} onChange={(evento) => setForm({ ...form, idTrimestre: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">ID de sede (opcional)<input type="number" min="1" value={form.idSede} onChange={(evento) => setForm({ ...form, idSede: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">Inicio lectivo<input type="date" value={form.fechaInicioLectiva} onChange={(evento) => setForm({ ...form, fechaInicioLectiva: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">Fin lectivo<input type="date" value={form.fechaFinLectiva} onChange={(evento) => setForm({ ...form, fechaFinLectiva: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">Inicio productivo<input type="date" value={form.fechaInicioProductiva} onChange={(evento) => setForm({ ...form, fechaInicioProductiva: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-700 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">Fin productivo<input type="date" value={form.fechaFinProductiva} onChange={(evento) => setForm({ ...form, fechaFinProductiva: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-900 dark:text-slate-100" /></label><label className="block text-sm font-medium text-on-surface dark:text-slate-300">Fase actual del pénsum (opcional)<select value={form.faseActual} onChange={(evento) => setForm({ ...form, faseActual: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"><option value="">Sin definir</option><option value="1">TRIM I</option><option value="2">TRIM II</option><option value="3">TRIM III</option><option value="4">TRIM IV</option></select></label></div>
            <p className="mt-3 text-xs text-on-surface-variant dark:text-slate-400">La fase le dice al Asistente IA qué resultados de aprendizaje tocan programar ahora (si el currículo del programa ya viene dividido por trimestre) -- sin definir, se programan todos los pendientes.</p>
            <button type="submit" disabled={guardando} className="mt-5 w-full rounded-xl bg-primary py-2.5 font-semibold text-white hover:bg-on-primary-container disabled:opacity-60">{guardando ? 'Guardando...' : 'Guardar ficha'}</button>
          </form>
        </div>
      )}

      {seleccionada && (
        <DrawerRelacionados
          iniciales={seleccionada.codigoFicha.slice(0, 2).toUpperCase()}
          titulo={seleccionada.codigoFicha}
          subtitulo="Ficha"
          onCerrar={() => setSeleccionada(null)}
        >
          {puedeGestionar && <button type="button" onClick={() => abrirEditar(seleccionada)} className="mb-5 rounded-xl border border-outline px-3 py-1.5 text-sm font-semibold text-on-surface dark:border-slate-700 dark:text-slate-300">Editar ficha</button>}

          {/* Contenido de mockup (Stitch, directorio_de_fichas_sihs_sena) —
              pendiente de conectar a un dato real del backend. Capacidad de
              ambiente, vocero aprendiz e historial de cambios son valores
              fijos de vitrina, no vienen de ningún fetch. No usar como si
              fuera dinámico sin agregar el campo/endpoint real primero
              (Ambiente no tiene columna de capacidad; Ficha no tiene vocero;
              Auditoria no está conectada a cambios de ficha todavía). */}
          <div className="mb-5 overflow-hidden rounded-xl border border-outline-variant dark:border-slate-700">
            <div className="relative flex h-28 items-end bg-gradient-to-br from-primary-container to-secondary-container p-3">
              <span className="material-symbols-outlined absolute right-3 top-3 text-[28px] text-on-primary-container/40" aria-hidden="true">school</span>
              <span className="rounded-lg bg-inverse-surface/80 px-2 py-1 text-xs font-medium text-inverse-on-surface">
                {(ambientesPorFicha.get(seleccionada.idFicha) ?? [])[0] ?? 'Ambiente sin asignar'} · Capacidad: 32 Aprendices
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-surface-container-lowest p-3 dark:bg-slate-800">
              <div><dt className="text-xs text-on-surface-variant dark:text-slate-400">Vocero Aprendiz</dt><dd className="mt-0.5 text-sm font-semibold text-on-surface dark:text-slate-100">Andrés David Rocha</dd></div>
              <div><dt className="text-xs text-on-surface-variant dark:text-slate-400">Trimestre formativo</dt><dd className="mt-0.5 text-sm font-semibold text-on-surface dark:text-slate-100">{seleccionada.trimestre.nombre} ({etapaFicha(seleccionada)})</dd></div>
            </div>
          </div>

          <SeccionDrawer titulo="Historial de cambios recientes">
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><div><p className="text-on-surface dark:text-slate-100">Reasignación de ambiente a {(ambientesPorFicha.get(seleccionada.idFicha) ?? [])[0] ?? 'nuevo ambiente'}</p><p className="text-xs text-on-surface-variant/70">Ayer, 16:45 por Coordinación Académica</p></div></li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant/40" /><div><p className="text-on-surface dark:text-slate-100">Ajuste de bloque transversal viernes</p><p className="text-xs text-on-surface-variant/70">14 may., 10:20 por Lic. Pedro Silva</p></div></li>
            </ul>
          </SeccionDrawer>

          <div className="mb-5 flex items-center justify-between gap-2 text-sm">
            <button type="button" disabled title="Aún no implementado en el backend" className="font-semibold text-on-surface-variant/50">Ver plan de estudios</button>
            <button type="button" disabled title="Aún no implementado en el backend" className="font-semibold text-on-surface-variant/50">Notificar ficha</button>
          </div>

          <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">contact_mail</span>
              <div><p className="font-semibold text-on-surface dark:text-slate-100">Contacto vocero</p><p className="text-xs text-on-surface-variant/70">ad_rocha@soy.sena.edu.co</p></div>
            </div>
            <button type="button" disabled title="Aún no implementado en el backend" className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant/40">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
            </button>
          </div>

          <Link
            to="/horarios/nuevo"
            className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:bg-on-primary-container"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit_calendar</span>
            Abrir en Constructor
          </Link>

          <dl className="space-y-4 text-sm">
            <div><dt className="text-on-surface-variant dark:text-slate-400">Programa</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionada.programa.nombrePrograma}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Nivel de formación</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{nivel(seleccionada)}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Sede</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionada.sede?.nombreSede ?? 'Sin sede asignada'}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Jornadas programadas</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionada.jornadas.length ? seleccionada.jornadas.join(', ') : 'Sin horario'}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Aprendices matriculados</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionada.aprendicesTotales}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Trimestre</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionada.trimestre.nombre}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Fase actual del pénsum</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionada.faseActual ? `TRIM ${['I', 'II', 'III', 'IV'][seleccionada.faseActual - 1] ?? seleccionada.faseActual}` : 'Sin definir'}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Estado del trimestre</dt><dd className="mt-1 font-medium capitalize text-on-surface dark:text-slate-100">{seleccionada.trimestre.estado}</dd></div>
            <div>
              <dt className="text-on-surface-variant dark:text-slate-400">Etapa actual</dt>
              <dd className="mt-1"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ETAPA_BADGE[etapaFicha(seleccionada)]}`}>{etapaFicha(seleccionada)}</span></dd>
            </div>
            {(seleccionada.fechaInicioLectiva || seleccionada.fechaInicioProductiva) && (
              <div>
                <dt className="text-on-surface-variant dark:text-slate-400">Fechas</dt>
                <dd className="mt-1 space-y-0.5 font-medium text-on-surface dark:text-slate-100">
                  {seleccionada.fechaInicioLectiva && (
                    <p>Lectiva: {formatFecha(seleccionada.fechaInicioLectiva)} — {formatFecha(seleccionada.fechaFinLectiva) ?? 'sin fin definido'}</p>
                  )}
                  {seleccionada.fechaInicioProductiva && (
                    <p>Productiva: {formatFecha(seleccionada.fechaInicioProductiva)} — {formatFecha(seleccionada.fechaFinProductiva) ?? 'sin fin definido'}</p>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {cargandoHorarios ? (
            <SeccionDrawer titulo="Horario semanal">
              <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando horarios…</p>
            </SeccionDrawer>
          ) : errorHorarios ? (
            <SeccionDrawer titulo="Horario semanal">
              <p className="text-sm text-on-surface-variant dark:text-slate-400">No se pudieron cargar los horarios de la ficha.</p>
            </SeccionDrawer>
          ) : (
            <>
              <SeccionDrawer titulo="Horario semanal">
                <GridHorario bloques={bloquesGrid} grid={grid} hayBloqueActivo={false} soloLectura />
                <Link
                  to={`/vista-fichas?id=${seleccionada.idFicha}`}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:text-on-primary-container dark:text-sena-400"
                >
                  Ver horario completo →
                </Link>
              </SeccionDrawer>
              <SeccionInstructoresAsignados horarios={horariosVigentes ?? []} diasPorId={diasPorId} />
              <SeccionTemasQueDicta horarios={horariosVigentes ?? []} />
              <SeccionAmbientesAsignados horarios={horariosVigentes ?? []} />
            </>
          )}
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}