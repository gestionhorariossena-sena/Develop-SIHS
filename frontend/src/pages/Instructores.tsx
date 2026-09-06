import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { SeccionAmbientesAsignados, SeccionFichasAsignadas, SeccionTemasQueDicta } from '../components/relacionados/SeccionesInstructor'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { indexarPorInstructor, opcionesFichaAmbiente } from '../components/horario/indexarHorarios'
import { apiGet, ApiError } from '../services/api'
import type { CargaSemanal, DiaSemana, Horario, Usuario } from '../types/api'

type Orden = 'nombre' | 'especialidad' | 'contrato'

const POR_PAGINA = 10

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join('')
}

function contrato(instructor: Usuario) {
  return instructor.tipoContrato?.trim() || 'Sin definir'
}

function colorBarraCarga(horasAsignadas: number, horasMaximas: number) {
  if (horasAsignadas > horasMaximas) return 'bg-red-600 dark:bg-red-500'
  if (horasAsignadas / horasMaximas >= 0.8) return 'bg-amber-500 dark:bg-amber-400'
  return 'bg-emerald-600 dark:bg-emerald-500'
}

/** Tope semanal por tipo de contrato (RF-011: 32h planta / 40h contrato —
 * mismo umbral que HORAS_MAX_PLANTA/HORAS_MAX_CONTRATO en
 * backend/app/services/horario_service.py). Se replica acá SOLO para
 * poder pintar la barra de carga en cada fila de la tabla sin pedir
 * /usuarios/{id}/carga-semanal 92 veces (esa llamada real sigue siendo la
 * fuente de verdad y es la que se usa en el drawer). */
function horasMaximasPara(instructor: Usuario) {
  return instructor.tipoContrato?.trim().toLocaleLowerCase('es-CO') === 'planta' ? 32 : 40
}

/** Horas ya asignadas por semana, derivadas de los mismos `todosLosHorarios`
 * que la página ya carga para los filtros de ficha/ambiente — mismo cálculo
 * que `_duracion_horas` del backend (horaFin - horaInicio, por cada día que
 * se repite), sin pedir nada nuevo al backend. */
function horasAsignadasPara(idInstructor: string, horarios: Horario[]) {
  let total = 0
  for (const horario of horarios) {
    if (horario.idInstructor !== idInstructor) continue
    const [hi, mi] = horario.horaInicio.split(':').map(Number)
    const [hf, mf] = horario.horaFin.split(':').map(Number)
    total += ((hf * 60 + mf) - (hi * 60 + mi)) / 60 * horario.dias.length
  }
  return total
}

export function Instructores() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [instructores, setInstructores] = useState<Usuario[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [especialidad, setEspecialidad] = useState('todas')
  const [tipoContrato, setTipoContrato] = useState('todos')
  const [ficha, setFicha] = useState('todas')
  const [ambiente, setAmbiente] = useState('todos')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [todosLosHorarios, setTodosLosHorarios] = useState<Horario[]>([])
  const [paginaActual, setPaginaActual] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cargaSemanal, setCargaSemanal] = useState<CargaSemanal | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)

  // Fichas asignadas/temas que dicta/ambientes asignados (SCRUM-62/63/64)
  // se derivan todos de los mismos horarios del instructor — un solo fetch.
  // Guarda idUsuario junto con los datos (mismo patrón que cargaSemanal más
  // abajo) para poder derivar "vigente" sin un setState síncrono en el
  // efecto — eslint react-hooks/set-state-in-effect lo prohíbe.
  const [horariosInstructor, setHorariosInstructor] = useState<{ idUsuario: string; datos: Horario[] } | null>(null)
  const [errorHorariosPara, setErrorHorariosPara] = useState<string | null>(null)
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})

  useEffect(() => {
    apiGet<Usuario[]>('/usuarios/')
      .then((usuarios) => {
        const soloInstructores = usuarios.filter((usuario) => usuario.roles.some((rol) => rol.nombre === 'Instructor'))
        setInstructores(soloInstructores)

        // Deep link desde VistaInstructores.tsx ("Ver info" →
        // /instructores?id=...): abre el drawer de ese instructor directo,
        // sin que el usuario tenga que buscarlo de nuevo en la tabla. Va
        // acá (dentro del .then) y no en un efecto reactivo aparte para no
        // reabrirse solo si el usuario cierra el drawer manualmente
        // después.
        if (idDesdeUrl) {
          const encontrado = soloInstructores.find((instructor) => instructor.idUsuario === idDesdeUrl)
          if (encontrado) setSeleccionado(encontrado)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de instructores.'))
      .finally(() => setCargando(false))

    // Sin .catch dedicado no rompe nada visible (nombresDias cae a "?" por
    // día si falta el mapa), pero deja una unhandled rejection en tests.
    apiGet<DiaSemana[]>('/dias-semana/')
      .then((dias) => setDiasPorId(Object.fromEntries(dias.map((d) => [d.idDia, d.nombreDia]))))
      .catch(() => {})

    // Todos los horarios del sistema (no solo los del instructor abierto en
    // el drawer) — para poder filtrar la lista por ficha/ambiente sin pedir
    // los horarios de cada instructor uno por uno. Sin .catch dedicado los
    // filtros de ficha/ambiente simplemente quedan vacíos si esto falla.
    apiGet<Horario[]>('/horarios/')
      .then(setTodosLosHorarios)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, igual que el resto del archivo; idDesdeUrl no cambia en la vida del componente.
  }, [])

  // La carga semanal (horas asignadas vs. tope de RF-011) y los horarios
  // reales requieren consultar /usuarios/{id}/... aparte — no vienen en
  // /usuarios/, se piden solo cuando se abre el drawer de ese instructor.
  useEffect(() => {
    if (!seleccionado) return

    apiGet<CargaSemanal>(`/usuarios/${seleccionado.idUsuario}/carga-semanal`)
      .then((datos) => {
        setCargaSemanal(datos)
        setErrorCarga(false)
      })
      .catch(() => setErrorCarga(true))

    apiGet<Horario[]>(`/usuarios/${seleccionado.idUsuario}/horarios`)
      .then((datos) => setHorariosInstructor({ idUsuario: seleccionado.idUsuario, datos }))
      .catch(() => setErrorHorariosPara(seleccionado.idUsuario))
  }, [seleccionado])

  // Derivado en vez de un estado "cargando" aparte: comparar el
  // idUsuario evita mostrar la carga del instructor anterior mientras se
  // pide la del nuevo (y evita un setState síncrono en el cuerpo del
  // efecto, que React desaconseja — ver react-hooks/set-state-in-effect).
  const cargaVigente = seleccionado && cargaSemanal?.idUsuario === seleccionado.idUsuario ? cargaSemanal : null
  const cargandoCarga = Boolean(seleccionado) && !cargaVigente && !errorCarga

  const horariosVigentes = seleccionado && horariosInstructor?.idUsuario === seleccionado.idUsuario ? horariosInstructor.datos : null
  const errorHorarios = seleccionado?.idUsuario === errorHorariosPara
  const cargandoHorarios = Boolean(seleccionado) && horariosVigentes === null && !errorHorarios
  const { bloques: bloquesGridInstructor, grid: gridInstructor } = convertirHorariosAGrid(horariosVigentes ?? [])

  const especialidades = [...new Set(instructores.flatMap((instructor) => instructor.especialidades.map((item) => item.nombre)))].sort()
  const contratos = [...new Set(instructores.map(contrato))].sort()
  const indiceAsociaciones = indexarPorInstructor(todosLosHorarios)
  const { fichas: opcionesFicha, ambientes: opcionesAmbiente } = opcionesFichaAmbiente(todosLosHorarios)
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos =
    Number(Boolean(busqueda.trim())) + Number(especialidad !== 'todas') + Number(tipoContrato !== 'todos') + Number(ficha !== 'todas') + Number(ambiente !== 'todos')
  const visibles = instructores.filter((instructor) => {
    const coincideTexto = !texto || [instructor.nombre, instructor.email, ...instructor.especialidades.map((item) => item.nombre)].join(' ').toLocaleLowerCase('es-CO').includes(texto)
    const coincideEspecialidad = especialidad === 'todas' || instructor.especialidades.some((item) => item.nombre === especialidad)
    const asociaciones = indiceAsociaciones.get(instructor.idUsuario)
    const coincideFicha = ficha === 'todas' || (asociaciones?.fichas.has(ficha) ?? false)
    const coincideAmbiente = ambiente === 'todos' || (asociaciones?.ambientes.has(ambiente) ?? false)
    return coincideTexto && coincideEspecialidad && coincideFicha && coincideAmbiente && (tipoContrato === 'todos' || contrato(instructor) === tipoContrato)
  }).sort((primero, segundo) => {
    if (orden === 'especialidad') return (primero.especialidades[0]?.nombre ?? '').localeCompare(segundo.especialidades[0]?.nombre ?? '', 'es-CO')
    if (orden === 'contrato') return contrato(primero).localeCompare(contrato(segundo), 'es-CO')
    return primero.nombre.localeCompare(segundo.nombre, 'es-CO')
  })

  // Clamped en vez de reseteado con un efecto: si un filtro deja menos
  // páginas de las que había, la página actual "cae" a la última válida
  // sola, sin necesitar un useEffect que resetee paginaActual (y sin el
  // problema de set-state-en-efecto que eso traería).
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)

  const activos = instructores.filter((item) => item.estado === 'activo').length
  const horasContratadasTotales = instructores.reduce((suma, item) => suma + (item.horasContratadasSemana ?? 0), 0)

  // Carga real derivada de todosLosHorarios (ya cargado para los filtros),
  // igual que el mockup "Directorio y Disponibilidad" — sin pedir
  // carga-semanal de cada instructor una por una.
  const cargaPorInstructor = instructores.map((item) => ({
    idUsuario: item.idUsuario,
    asignadas: horasAsignadasPara(item.idUsuario, todosLosHorarios),
    maximas: horasMaximasPara(item),
  }))
  const conCargaCompleta = cargaPorInstructor.filter((item) => item.asignadas >= item.maximas).length
  const disponibles = cargaPorInstructor.filter((item) => item.asignadas === 0).length
  const horasAsignadasTotales = cargaPorInstructor.reduce((suma, item) => suma + item.asignadas, 0)
  const horasMaximasTotales = cargaPorInstructor.reduce((suma, item) => suma + item.maximas, 0)

  return (
    <AppShell activo="Instructores">
      <nav className="mb-2 text-xs text-on-surface-variant">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span className="mx-1.5 text-outline">/</span>
        <span className="font-semibold text-on-surface">Instructores</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">
            Directorio y Disponibilidad <span className="font-normal text-on-surface-variant">| CGMLTI Calle 52</span>
          </h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">Planta de instructores y especialidades asignadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="Aún no implementado en el backend"
            className="cursor-not-allowed rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant opacity-60 dark:border-slate-700"
          >
            Exportar carga docente
          </button>
          <button
            type="button"
            disabled
            title="Aún no implementado en el backend"
            className="cursor-not-allowed rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary opacity-60"
          >
            + Registrar instructor
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Total instructores</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{instructores.length}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{activos} activos</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Con carga completa</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{conCargaCompleta}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{instructores.length ? Math.round((conCargaCompleta / instructores.length) * 100) : 0}% asignados</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Disponibles asignación</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{disponibles}</p>
          <p className="mt-1 text-xs text-on-surface-variant">sin horario asignado este trimestre</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Horas semanales totales</p>
          <p className="mt-1 text-2xl font-bold text-on-surface dark:text-slate-100">{horasAsignadasTotales.toLocaleString('es-CO')} h</p>
          <p className="mt-1 text-xs text-on-surface-variant">Capacidad {horasMaximasTotales.toLocaleString('es-CO')} h · contratadas {horasContratadasTotales.toLocaleString('es-CO')} h</p>
        </div>
      </div>

      <p className="mb-3 text-sm text-on-surface-variant">{visibles.length} de {instructores.length} instructores</p>

      <section className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de instructores">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Filtrar instructores</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-on-primary-container">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && <button type="button" onClick={() => { setBusqueda(''); setEspecialidad('todas'); setTipoContrato('todos'); setFicha('todas'); setAmbiente('todos') }} className="text-sm font-medium text-primary hover:text-on-primary-container">Limpiar filtros</button>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="md:col-span-2 lg:col-span-1"><label htmlFor="buscar-instructor" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Buscar</label><input id="buscar-instructor" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre, correo o especialidad" className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></div>
          <div><label htmlFor="filtro-especialidad" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Especialidad</label><select id="filtro-especialidad" value={especialidad} onChange={(evento) => setEspecialidad(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todas">Todas</option>{especialidades.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-contrato" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Tipo de contrato</label><select id="filtro-contrato" value={tipoContrato} onChange={(evento) => setTipoContrato(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{contratos.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-ficha" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Ficha</label><select id="filtro-ficha" value={ficha} onChange={(evento) => setFicha(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todas">Todas</option>{opcionesFicha.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-ambiente" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Ambiente</label><select id="filtro-ambiente" value={ambiente} onChange={(evento) => setAmbiente(evento.target.value)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{opcionesAmbiente.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="orden-instructor" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Ordenar por</label><select id="orden-instructor" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="nombre">Nombre</option><option value="especialidad">Especialidad</option><option value="contrato">Contrato</option></select></div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando instructores...</p> : <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-surface text-xs font-semibold uppercase text-on-surface-variant dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Especialidades</th><th className="px-4 py-3">Carga horaria</th><th className="px-4 py-3">Contrato</th><th className="px-4 py-3">Horas contratadas</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-outline-variant dark:divide-slate-700">{visiblesPagina.map((item) => { const asignadas = horasAsignadasPara(item.idUsuario, todosLosHorarios); const maximas = horasMaximasPara(item); return <tr key={item.idUsuario} onClick={() => setSeleccionado(item)} className="cursor-pointer hover:bg-surface dark:hover:bg-slate-700/60"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sena-100 text-xs font-bold text-sena-700 dark:bg-sena-950/50">{iniciales(item.nombre)}</span><div><p className="font-semibold text-on-surface dark:text-slate-100">{item.nombre}</p><p className="text-xs text-on-surface-variant dark:text-slate-400">{item.email}</p></div></div></td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{item.especialidades.length ? item.especialidades.map((especialidad) => especialidad.nombre).join(', ') : 'Sin asignar'}</td><td className="min-w-[140px] px-4 py-3"><div className="mb-1 flex items-center justify-between text-xs font-medium text-on-surface-variant dark:text-slate-300"><span>{asignadas}h / {maximas}h</span><span>{Math.round((asignadas / maximas) * 100)}%</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high dark:bg-slate-700"><div className={`h-full rounded-full ${colorBarraCarga(asignadas, maximas)}`} style={{ width: `${Math.min(100, Math.round((asignadas / maximas) * 100))}%` }} /></div></td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{contrato(item)}</td><td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{item.horasContratadasSemana ? `${item.horasContratadasSemana} h` : 'Sin definir'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'}`}>{item.estado}</span></td></tr> })}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">No hay instructores que coincidan con los filtros.</p>}

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

      {seleccionado && (
        <DrawerRelacionados
          iniciales={iniciales(seleccionado.nombre)}
          titulo={seleccionado.nombre}
          subtitulo={seleccionado.email}
          etiquetas={[contrato(seleccionado), ...seleccionado.especialidades.map((item) => item.nombre)]}
          onCerrar={() => setSeleccionado(null)}
        >
          <SeccionDrawer titulo="Carga semanal">
            <div className="mb-1.5 flex items-center justify-between">
              {cargaVigente?.horasMaximas != null && (
                <p className="text-xs font-medium text-on-surface-variant dark:text-slate-300">
                  {cargaVigente.horasAsignadas}h / {cargaVigente.horasMaximas}h
                </p>
              )}
            </div>
            {cargandoCarga ? (
              <p className="text-xs text-on-surface-variant dark:text-slate-400">Calculando…</p>
            ) : errorCarga ? (
              <p className="text-xs text-on-surface-variant dark:text-slate-400">No se pudo calcular la carga semanal.</p>
            ) : cargaVigente?.horasMaximas != null ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${colorBarraCarga(cargaVigente.horasAsignadas, cargaVigente.horasMaximas)}`}
                    style={{ width: `${Math.min(100, Math.round((cargaVigente.horasAsignadas / cargaVigente.horasMaximas) * 100))}%` }}
                  />
                </div>
                {cargaVigente.horasAsignadas > cargaVigente.horasMaximas && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Supera el máximo de RF-011.</p>
                )}
              </>
            ) : (
              <p className="text-xs text-on-surface-variant dark:text-slate-400">Sin tipo de contrato definido — no se puede calcular el tope de RF-011.</p>
            )}
          </SeccionDrawer>

          {cargandoHorarios ? (
            <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando horarios…</p>
          ) : errorHorarios ? (
            <p className="text-sm text-on-surface-variant dark:text-slate-400">No se pudieron cargar los horarios del instructor.</p>
          ) : (
            <>
              <SeccionDrawer titulo="Horario semanal">
                {bloquesGridInstructor.length === 0 ? (
                  <p className="text-sm text-on-surface-variant dark:text-slate-400">Sin horario asignado en el trimestre actual.</p>
                ) : (
                  <div className="text-[10px]">
                    <GridHorario bloques={bloquesGridInstructor} grid={gridInstructor} hayBloqueActivo={false} soloLectura ocultarFilasVacias />
                  </div>
                )}
                <Link
                  to={`/vista-instructores?id=${seleccionado.idUsuario}`}
                  className="mt-2 inline-block text-xs font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400"
                >
                  Ver horario completo →
                </Link>
              </SeccionDrawer>
              <SeccionFichasAsignadas horarios={horariosVigentes ?? []} diasPorId={diasPorId} />
              <SeccionTemasQueDicta horarios={horariosVigentes ?? []} />
              <SeccionAmbientesAsignados horarios={horariosVigentes ?? []} />
            </>
          )}
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}