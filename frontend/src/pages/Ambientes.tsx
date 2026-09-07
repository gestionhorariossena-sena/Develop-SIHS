import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { indexarPorAmbiente, opcionesFichaAmbiente, opcionesInstructor } from '../components/horario/indexarHorarios'
import { SeccionFichasAsignadas, SeccionTemasQueDicta } from '../components/relacionados/SeccionesInstructor'
import { SeccionInstructoresAsignados } from '../components/relacionados/SeccionesFicha'
import { ImportarArchivo, type ColumnaImportar } from '../components/ImportarArchivo'
import { apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { AuditoriaConflicto, Ambiente, Coordinacion, DiaSemana, Ficha, Horario, Sede, Usuario } from '../types/api'
import type { FilaCsv } from '../utils/csv'

type Orden = 'nombre'| 'sede'| 'estado'

const POR_PAGINA = 10

type AmbienteForm = { numeroAmbiente: string; nombreAmbiente: string; tipoAmbiente: Ambiente['tipoAmbiente']; estadoAmbiente: Ambiente['estadoAmbiente']; idSede: string }
const FORM_VACIO: AmbienteForm = { numeroAmbiente: '', nombreAmbiente: '', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: ''}

const COLUMNAS_IMPORTAR_AMBIENTE: ColumnaImportar[] = [
 { clave: 'numeroAmbiente', encabezado: 'numeroAmbiente'},
 { clave: 'nombreAmbiente', encabezado: 'nombreAmbiente'},
 { clave: 'tipoAmbiente', encabezado: 'tipoAmbiente'},
 { clave: 'sede', encabezado: 'sede'},
 { clave: 'estadoAmbiente', encabezado: 'estadoAmbiente', requerido: false },
]

const estiloEstado: Record<Ambiente['estadoAmbiente'], string> = {
 disponible: 'bg-primary-container text-on-primary-container',
 mantenimiento: 'bg-tertiary-container text-on-tertiary-container',
 inactivo: 'bg-surface-container text-on-surface-variant',
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
 const [perfil, setPerfil] = useState<Usuario | null>(null)
 const [modalAbierto, setModalAbierto] = useState(false)
 const [editandoId, setEditandoId] = useState<number | null>(null)
 const [form, setForm] = useState<AmbienteForm>(FORM_VACIO)
 const [guardando, setGuardando] = useState(false)
 // SCRUM-89: carga masiva por CSV — reusa la lista de sedes que la página
 // ya pide para el filtro/tabla, no hace falta pedirla de nuevo.
 const [mostrarImportar, setMostrarImportar] = useState(false)

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
 // Barrido real de cruces (GET /horarios/auditoria-cruces) — alimenta el
 // aviso "Conflicto de horario detectado" del drawer cuando el ambiente
 // seleccionado aparece en algún conflicto ya guardado. Mismo espíritu que
 // el panel "EN CONFLICTO" del mockup Stitch, pero con datos reales en vez
 // de capacidad/equipamiento inventados.
 const [conflictosAmbiente, setConflictosAmbiente] = useState<AuditoriaConflicto[]>([])

 async function cargarAmbientes() {
 const datos = await apiGet<Ambiente[]>('/ambientes')
 setAmbientes(datos)
 return datos
 }

 useEffect(() => {
 // eslint-disable-next-line react-hooks/set-state-in-effect
 cargarAmbientes()
 .then((datos) => {
 setAmbientes(datos)

 // Deep link desde VistaAmbientes.tsx ("Ver info"→ /ambientes?id=...):
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
 apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => {})
 apiGet<Coordinacion[]>('/coordinaciones/').then(setCoordinaciones).catch(() => {})
 apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
 apiGet<Horario[]>('/horarios/').then(setTodosLosHorarios).catch(() => {})
 apiGet<{ conflictos: AuditoriaConflicto[] }>('/horarios/auditoria-cruces').then((respuesta) => setConflictosAmbiente(respuesta.conflictos)).catch(() => {})

 // Sin .catch dedicado no rompe nada visible (nombresDias cae a "?"por
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

 async function importarFilaAmbiente(fila: FilaCsv) {
 const numeroTexto = fila.numeroAmbiente?.trim()
 const nombreAmbiente = fila.nombreAmbiente?.trim()
 const tipoTexto = fila.tipoAmbiente?.trim().toLocaleLowerCase('es-CO')
 const nombreSede = fila.sede?.trim()
 const estadoTexto = (fila.estadoAmbiente?.trim().toLocaleLowerCase('es-CO') || 'disponible') as Ambiente['estadoAmbiente']

 const numeroAmbiente = Number(numeroTexto)
 if (!numeroTexto || Number.isNaN(numeroAmbiente) || numeroAmbiente <= 0) throw new Error('numeroAmbiente debe ser un número mayor a 0.')
 if (!nombreAmbiente) throw new Error('Falta nombreAmbiente.')
 if (tipoTexto !== 'regular' && tipoTexto !== 'especial') throw new Error('tipoAmbiente debe ser "regular" o "especial".')
 if (!['disponible', 'mantenimiento', 'inactivo'].includes(estadoTexto)) throw new Error('estadoAmbiente debe ser "disponible", "mantenimiento" o "inactivo".')
 if (!nombreSede) throw new Error('Falta sede.')

 const sedeEncontrada = sedes.find((item) => item.nombreSede.toLocaleUpperCase('es-CO') === nombreSede.toLocaleUpperCase('es-CO'))
 if (!sedeEncontrada) throw new Error(`No existe la sede "${nombreSede}".`)

 await apiPost('/ambientes', {
 numeroAmbiente,
 nombreAmbiente,
 tipoAmbiente: tipoTexto,
 estadoAmbiente: estadoTexto,
 idSede: sedeEncontrada.idSede,
 })
 }

 function refrescarAmbientesTrasImportar() {
 apiGet<Ambiente[]>('/ambientes').then(setAmbientes).catch(() => {})
 }

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
 const coincideEstado = filtroEstado === 'todos'|| ambiente.estadoAmbiente === filtroEstado
 const asociaciones = indiceAsociaciones.get(ambiente.idAmbiente)
 const coincideFicha = filtroFicha === 'todas'|| (asociaciones?.fichas.has(filtroFicha) ?? false)
 const coincideInstructor = filtroInstructor === 'todos'|| (asociaciones?.instructores.has(filtroInstructor) ?? false)
 const coincideCoordinacion = filtroCoordinacion === 'todas'|| (asociaciones?.coordinaciones.has(Number(filtroCoordinacion)) ?? false)
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
 const puedeGestionar = perfil?.roles.some((rol) => rol.nombre === 'Administrador') ?? false

 // Tarjetas de resumen por tipo (mismo espíritu que el mockup Stitch de
 // "agrupar por categoría con % de ocupación", pero con datos reales: el
 // modelo Ambiente solo distingue regular/especial, no hay categorías
 // nombradas ("Laboratorios Software", etc.) ni capacidad física — así que
 // "ocupación" acá es disponibles/total del grupo, no aforo físico.
 const resumenPorTipo = (['regular', 'especial'] as const).map((tipo) => {
 const delTipo = ambientes.filter((item) => item.tipoAmbiente === tipo)
 const disponibles = delTipo.filter((item) => item.estadoAmbiente === 'disponible')
 const pctDisponible = delTipo.length > 0 ? Math.round((disponibles.length / delTipo.length) * 100) : 0
 return { tipo, total: delTipo.length, disponibles: disponibles.length, pctDisponible, primerDisponible: disponibles[0] }
 }).filter((item) => item.total > 0)

 // Ocupación pico de la sede (igual concepto que el badge del mockup Stitch,
 // "92.3% Ocupación Pico"): % de ambientes que NO están disponibles ahora.
 const ocupacionPico = ambientes.length > 0 ? Math.round(((ambientes.length - ambientes.filter((a) => a.estadoAmbiente === 'disponible').length) / ambientes.length) * 100) : 0

 const conflictoDelSeleccionado = seleccionado
 ? conflictosAmbiente.find((c) => c.idAmbiente === seleccionado.idAmbiente)
 : undefined

 function abrirCrear() {
 setEditandoId(null)
 setForm({ ...FORM_VACIO, idSede: sedes[0] ? String(sedes[0].idSede) : ''})
 setError(null)
 setModalAbierto(true)
 }

 function abrirEditar(ambiente: Ambiente) {
 setEditandoId(ambiente.idAmbiente)
 setForm({ numeroAmbiente: String(ambiente.numeroAmbiente), nombreAmbiente: ambiente.nombreAmbiente, tipoAmbiente: ambiente.tipoAmbiente, estadoAmbiente: ambiente.estadoAmbiente, idSede: String(ambiente.idSede) })
 setError(null)
 setModalAbierto(true)
 }

 async function guardarAmbiente(evento: FormEvent<HTMLFormElement>) {
 evento.preventDefault()
 const numeroAmbiente = Number(form.numeroAmbiente)
 const idSede = Number(form.idSede)
 if (!numeroAmbiente || !idSede || (form.tipoAmbiente === 'especial'&& !form.nombreAmbiente.trim())) {
 setError('Número, sede y nombre (para ambientes especiales) son obligatorios.')
 return
 }
 const payload = { numeroAmbiente, nombreAmbiente: form.tipoAmbiente === 'regular'? 'Ambiente': form.nombreAmbiente.trim(), tipoAmbiente: form.tipoAmbiente, estadoAmbiente: form.estadoAmbiente, idSede }
 try {
 setGuardando(true)
 setError(null)
 const respuesta = editandoId === null ? await apiPost<Ambiente>('/ambientes', payload) : await apiPut<Ambiente>(`/ambientes/${editandoId}`, payload)
 const datos = await cargarAmbientes()
 setSeleccionado(datos.find((ambiente) => ambiente.idAmbiente === respuesta.idAmbiente) ?? respuesta)
 setModalAbierto(false)
 } catch (err: unknown) {
 setError(err instanceof ApiError ? err.message : 'No se pudo guardar el ambiente.')
 } finally {
 setGuardando(false)
 }
 }

 return (
 <AppShell activo="Ambientes">
 <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
 <div>
 <nav className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
 <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
 <span>/</span>
 <span className="text-on-surface">Ambientes</span>
 </nav>
 <div className="flex flex-wrap items-center gap-2">
 <h1 className="text-2xl font-bold text-on-surface">Ambientes</h1>
 {!cargando && ambientes.length > 0 && (
 <span className="rounded-full bg-secondary-container px-2.5 py-1 text-xs font-semibold text-on-secondary-container">
 {ambientes.length} ambientes · {ocupacionPico}% ocupación
 </span>
 )}
 </div>
 <p className="mt-1 text-sm text-on-surface-variant">Ambientes de formación registrados por sede y coordinación.</p>
 </div>
 <div className="flex items-center gap-2">
 {puedeGestionar && <button type="button"onClick={abrirCrear} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container">Nuevo ambiente</button>}
 <button type="button"onClick={() => setMostrarImportar((valor) => !valor)} className="rounded-xl border border-outline px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low ">
 {mostrarImportar ? 'Ocultar carga de archivo': 'Cargar archivo'}
 </button>
 <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant ">{visibles.length} de {ambientes.length} ambientes</p>
 </div>
 </div>

 {resumenPorTipo.length > 0 && !cargando && (
 <div className="mb-4 grid gap-3 sm:grid-cols-2">
 {resumenPorTipo.map((item) => (
 <div key={item.tipo} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
 <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant capitalize">Ambientes {item.tipo}s</p>
 <div className="mt-1 flex items-baseline justify-between">
 <p className="text-2xl font-bold text-on-surface">
 {item.disponibles}<span className="text-base font-medium text-on-surface-variant">/{item.total} disponibles</span>
 </p>
 <p className="text-sm font-semibold text-primary">{item.pctDisponible}%</p>
 </div>
 <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
 <div className="h-full rounded-full bg-primary" style={{ width: `${item.pctDisponible}%` }} />
 </div>
 {item.primerDisponible && (
 <p className="mt-2 text-xs text-on-surface-variant">
 Disponible: <span className="font-semibold text-on-surface">{item.primerDisponible.nombreAmbiente} · {item.primerDisponible.numeroAmbiente}</span>
 </p>
 )}
 </div>
 ))}
 </div>
 )}

 {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato real
 del backend. Ambiente no tiene campo "piso"; estas pestañas son
 decorativas (sin onClick) para mostrar el layout del mockup, no filtran
 nada. Si algún día se agrega piso como campo real, esto pasa a ser
 interactivo de verdad en vez de solo mostrar P3 como plantilla fija. */}
 {!cargando && ambientes.length > 0 && (
 <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
 {['P1 · Talleres y Bodegas', 'P2 · Aulas Polivalentes', 'P3 · Software, 3D y Cloud', 'P4 · Auditorio y Servidores'].map((piso, indice) => (
 <span
 key={piso}
 className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
 indice === 2 ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
 }`}
 >
 {piso}
 </span>
 ))}
 <span className="ml-auto flex items-center gap-3 text-xs text-on-surface-variant">
 <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Libre</span>
 <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-on-surface-variant" />Ocupado</span>
 <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-error" />Cruce</span>
 <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-tertiary" />Mant.</span>
 </span>
 </div>
 )}

 {mostrarImportar && (
 <ImportarArchivo
 columnas={COLUMNAS_IMPORTAR_AMBIENTE}
 onImportarFila={importarFilaAmbiente}
 onTerminado={refrescarAmbientesTrasImportar}
 onCerrar={() => setMostrarImportar(false)}
 />
 )}

 <section className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 "aria-label="Filtros de ambientes">
 <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
 <div className="flex items-center gap-2">
 <p className="text-sm font-semibold text-on-surface">Filtrar ambientes</p>
 {filtrosActivos > 0 && <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-on-primary-container">{filtrosActivos} activo{filtrosActivos === 1 ? '': 's'}</span>}
 {filtrosActivos > 0 && (
 <button
 type="button"
 onClick={() => { setBusqueda(''); setFiltroFicha('todas'); setFiltroCoordinacion('todas'); setFiltroEstado('todos'); setFiltroInstructor('todos') }}
 className="text-sm font-medium text-primary hover:text-on-primary-container"
 >
 Limpiar filtros
 </button>
 )}
 </div>
 <div className="flex gap-4">
 <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Disponibles</p><p className="text-sm font-bold text-on-surface">{ambientes.filter((item) => item.estadoAmbiente === 'disponible').length}</p></div>
 <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">En mantenimiento</p><p className="text-sm font-bold text-on-surface">{ambientes.filter((item) => item.estadoAmbiente === 'mantenimiento').length}</p></div>
 <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Sedes</p><p className="text-sm font-bold text-on-surface">{new Set(ambientes.map((item) => item.idSede)).size}</p></div>
 </div>
 </div>
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
 <div className="md:col-span-2 lg:col-span-1">
 <label htmlFor="buscar-ambiente"className="mb-1.5 block text-xs font-medium text-on-surface-variant">Buscar</label>
 <input id="buscar-ambiente"value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre o número"className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none "/>
 </div>
 <div>
 <label htmlFor="filtro-ficha-ambiente"className="mb-1.5 block text-xs font-medium text-on-surface-variant">Ficha</label>
 <select id="filtro-ficha-ambiente"value={filtroFicha} onChange={(evento) => setFiltroFicha(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant ">
 <option value="todas">Todas</option>
 {opcionesFicha.map((item) => <option key={item}>{item}</option>)}
 </select>
 </div>
 <div>
 <label htmlFor="filtro-coordinacion"className="mb-1.5 block text-xs font-medium text-on-surface-variant">Coordinación</label>
 <select id="filtro-coordinacion"value={filtroCoordinacion} onChange={(evento) => setFiltroCoordinacion(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant ">
 <option value="todas">Todas</option>
 {coordinaciones.map((item) => <option key={item.idCoordinacion} value={item.idCoordinacion}>{item.nombreCoordinacion}</option>)}
 </select>
 </div>
 <div>
 <label htmlFor="filtro-estado-ambiente"className="mb-1.5 block text-xs font-medium text-on-surface-variant">Estado</label>
 <select id="filtro-estado-ambiente"value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant ">
 <option value="todos">Todos</option>
 <option value="disponible">Disponible</option>
 <option value="mantenimiento">Mantenimiento</option>
 <option value="inactivo">Inactivo</option>
 </select>
 </div>
 <div>
 <label htmlFor="filtro-instructor-ambiente"className="mb-1.5 block text-xs font-medium text-on-surface-variant">Instructor</label>
 <select id="filtro-instructor-ambiente"value={filtroInstructor} onChange={(evento) => setFiltroInstructor(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant ">
 <option value="todos">Todos</option>
 {opcionesInstructores.map((item) => <option key={item}>{item}</option>)}
 </select>
 </div>
 <div>
 <label htmlFor="orden-ambiente"className="mb-1.5 block text-xs font-medium text-on-surface-variant">Ordenar por</label>
 <select id="orden-ambiente"value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant ">
 <option value="nombre">Nombre</option>
 <option value="sede">Sede</option>
 <option value="estado">Estado</option>
 </select>
 </div>
 </div>
 </section>

 {error && <p className="mb-4 rounded-xl border border-error-container bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>}
 {cargando ? <p className="py-12 text-center text-sm text-on-surface-variant">Cargando ambientes...</p> : <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest "><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead className="bg-surface-container-low text-xs font-semibold uppercase text-on-surface-variant "><tr><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Sede</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Coordinación</th><th className="px-4 py-3">Estado</th>{puedeGestionar && <th className="px-4 py-3">Acciones</th>}</tr></thead><tbody className="divide-y divide-outline-variant">{visiblesPagina.map((ambiente) => {
 const coordinacionesAmbiente = [...(indiceAsociaciones.get(ambiente.idAmbiente)?.coordinaciones ?? [])].map((id) => coordinacionesPorId.get(id)).filter((nombre): nombre is string => Boolean(nombre))
 return (
 <tr key={ambiente.idAmbiente} onClick={() => setSeleccionado(ambiente)} className="cursor-pointer hover:bg-surface-container-high">
 <td className="px-4 py-3 font-semibold text-on-surface">{ambiente.nombreAmbiente} <span className="text-on-surface-variant">· {ambiente.numeroAmbiente}</span></td>
 <td className="px-4 py-3 text-on-surface-variant">{sedesPorId.get(ambiente.idSede) ?? 'Sin definir'}</td>
 <td className="px-4 py-3"><span className="rounded-full bg-secondary-container px-2.5 py-1 text-xs font-semibold capitalize text-on-secondary-container">{ambiente.tipoAmbiente}</span></td>
 <td className="px-4 py-3 text-on-surface-variant">{coordinacionesAmbiente.length > 0 ? coordinacionesAmbiente.join(', ') : 'Sin asignar'}</td>
 <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${estiloEstado[ambiente.estadoAmbiente]}`}>{ambiente.estadoAmbiente}</span></td>{puedeGestionar && <td className="px-4 py-3"><button type="button"onClick={(evento) => { evento.stopPropagation(); abrirEditar(ambiente) }} className="rounded-xl border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low ">Editar</button></td>}
 </tr>
 )
 })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-on-surface-variant">No hay ambientes que coincidan con los filtros.</p>}

 {visibles.length > 0 && (
 <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3 ">
 <p className="text-xs text-on-surface-variant">
 Página {paginaSegura} de {totalPaginas}
 </p>
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
 disabled={paginaSegura === 1}
 className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 "
 >
 Anterior
 </button>
 <button
 type="button"
 onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
 disabled={paginaSegura === totalPaginas}
 className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 "
 >
 Siguiente
 </button>
 </div>
 </div>
 )}
 </div>}

 {puedeGestionar && modalAbierto && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"role="presentation">
 <form onSubmit={guardarAmbiente} className="w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-2xl "role="dialog"aria-modal="true"aria-labelledby="titulo-formulario-ambiente">
 <div className="mb-5 flex items-center justify-between"><h2 id="titulo-formulario-ambiente"className="text-xl font-semibold text-on-surface">{editandoId === null ? 'Nuevo ambiente': 'Editar ambiente'}</h2><button type="button"onClick={() => setModalAbierto(false)} className="text-sm text-on-surface-variant">Cancelar</button></div>
 <div className="space-y-3"><label className="block text-sm font-medium text-on-surface-variant">Número de ambiente<input required type="number"min="1"value={form.numeroAmbiente} onChange={(evento) => setForm({ ...form, numeroAmbiente: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 "/></label><label className="block text-sm font-medium text-on-surface-variant">Nombre<input required={form.tipoAmbiente === 'especial'} value={form.nombreAmbiente} onChange={(evento) => setForm({ ...form, nombreAmbiente: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 "/></label><label className="block text-sm font-medium text-on-surface-variant">Tipo<select value={form.tipoAmbiente} onChange={(evento) => setForm({ ...form, tipoAmbiente: evento.target.value as Ambiente['tipoAmbiente'] })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 "><option value="regular">Regular</option><option value="especial">Especial</option></select></label><label className="block text-sm font-medium text-on-surface-variant">Estado<select value={form.estadoAmbiente} onChange={(evento) => setForm({ ...form, estadoAmbiente: evento.target.value as Ambiente['estadoAmbiente'] })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 "><option value="disponible">Disponible</option><option value="mantenimiento">Mantenimiento</option><option value="inactivo">Inactivo</option></select></label><label className="block text-sm font-medium text-on-surface-variant">Sede<select required value={form.idSede} onChange={(evento) => setForm({ ...form, idSede: evento.target.value })} className="mt-1 w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 "><option value="">Selecciona una sede</option>{sedes.map((sede) => <option key={sede.idSede} value={sede.idSede}>{sede.nombreSede}</option>)}</select></label></div>
 <button type="submit"disabled={guardando} className="mt-5 w-full rounded-xl bg-primary py-2.5 font-semibold text-on-primary hover:bg-on-primary-container disabled:opacity-60">{guardando ? 'Guardando...': 'Guardar ambiente'}</button>
 </form>
 </div>
 )}

 {seleccionado && (
 <DrawerRelacionados
 iniciales={seleccionado.nombreAmbiente.slice(0, 2).toUpperCase()}
 titulo={seleccionado.nombreAmbiente}
 subtitulo={sedesPorId.get(seleccionado.idSede) ?? 'Sede sin definir'}
 etiquetas={[seleccionado.tipoAmbiente, seleccionado.estadoAmbiente]}
 onCerrar={() => setSeleccionado(null)}
 >
 {puedeGestionar && <button type="button"onClick={() => abrirEditar(seleccionado)} className="mb-5 rounded-xl border border-outline px-3 py-1.5 text-sm font-semibold text-on-surface-variant ">Editar ambiente</button>}
 <dl className="space-y-4 text-sm">
 <div><dt className="text-on-surface-variant">Número</dt><dd className="mt-1 font-medium text-on-surface">{seleccionado.numeroAmbiente}</dd></div>
 <div><dt className="text-on-surface-variant">Tipo</dt><dd className="mt-1 font-medium capitalize text-on-surface">{seleccionado.tipoAmbiente}</dd></div>
 <div><dt className="text-on-surface-variant">Estado</dt><dd className="mt-1 font-medium capitalize text-on-surface">{seleccionado.estadoAmbiente}</dd></div>
 {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato real
 del backend. El modelo Ambiente no tiene capacidad ni equipamiento
 técnico hoy; no usar estos dos <dd> como si fueran dinámicos sin
 agregar antes el campo/fetch correspondiente. */}
 <div className="grid grid-cols-2 gap-4 border-t border-outline-variant pt-4">
 <div><dt className="text-on-surface-variant">Capacidad total</dt><dd className="mt-1 font-medium text-on-surface">32 aprendices</dd></div>
 <div><dt className="text-on-surface-variant">Equipamiento técnico</dt><dd className="mt-1 font-medium text-on-surface">Core i7 · 16GB RAM</dd></div>
 </div>
 </dl>

 {conflictoDelSeleccionado && (
 <div className="mb-5 rounded-xl border border-error-container bg-error-container p-4">
 <p className="flex items-center gap-1.5 text-sm font-bold text-on-error-container">
 <span className="material-symbols-outlined text-[18px]" aria-hidden="true">warning</span>
 Conflicto de horario detectado
 </p>
 <p className="mt-1 text-sm text-on-error-container">{conflictoDelSeleccionado.mensaje}</p>
 <Link to="/horarios/auditoria" className="mt-2 inline-block text-sm font-semibold text-on-error-container underline">
 Ver en Auditoría de Cruces →
 </Link>
 </div>
 )}

 {cargandoHorarios ? (
 <SeccionDrawer titulo="Horario semanal">
 <p className="text-sm text-on-surface-variant">Cargando horarios…</p>
 </SeccionDrawer>
 ) : errorHorarios ? (
 <SeccionDrawer titulo="Horario semanal">
 <p className="text-sm text-on-surface-variant">No se pudieron cargar los horarios del ambiente.</p>
 </SeccionDrawer>
 ) : (
 <>
 <SeccionDrawer titulo="Horario semanal">
 <GridHorario bloques={bloquesGrid} grid={grid} hayBloqueActivo={false} soloLectura />
 <Link
 to={`/vista-ambientes?id=${seleccionado.idAmbiente}`}
 className="mt-2 inline-block text-xs font-medium text-primary hover:text-on-primary-container"
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
