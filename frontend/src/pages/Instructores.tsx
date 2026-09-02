import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { SeccionAmbientesAsignados, SeccionFichasAsignadas, SeccionTemasQueDicta } from '../components/relacionados/SeccionesInstructor'
import { apiGet, ApiError } from '../services/api'
import type { CargaSemanal, DiaSemana, Horario, Usuario } from '../types/api'

type Orden = 'nombre' | 'especialidad' | 'contrato'

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

export function Instructores() {
  const [instructores, setInstructores] = useState<Usuario[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [especialidad, setEspecialidad] = useState('todas')
  const [tipoContrato, setTipoContrato] = useState('todos')
  const [orden, setOrden] = useState<Orden>('nombre')
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
      .then((usuarios) => setInstructores(usuarios.filter((usuario) => usuario.roles.some((rol) => rol.nombre === 'Instructor'))))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de instructores.'))
      .finally(() => setCargando(false))

    // Sin .catch dedicado no rompe nada visible (nombresDias cae a "?" por
    // día si falta el mapa), pero deja una unhandled rejection en tests.
    apiGet<DiaSemana[]>('/dias-semana/')
      .then((dias) => setDiasPorId(Object.fromEntries(dias.map((d) => [d.idDia, d.nombreDia]))))
      .catch(() => {})
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

  const especialidades = [...new Set(instructores.flatMap((instructor) => instructor.especialidades.map((item) => item.nombre)))].sort()
  const contratos = [...new Set(instructores.map(contrato))].sort()
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos = Number(Boolean(busqueda.trim())) + Number(especialidad !== 'todas') + Number(tipoContrato !== 'todos')
  const visibles = instructores.filter((instructor) => {
    const coincideTexto = !texto || [instructor.nombre, instructor.email, ...instructor.especialidades.map((item) => item.nombre)].join(' ').toLocaleLowerCase('es-CO').includes(texto)
    const coincideEspecialidad = especialidad === 'todas' || instructor.especialidades.some((item) => item.nombre === especialidad)
    return coincideTexto && coincideEspecialidad && (tipoContrato === 'todos' || contrato(instructor) === tipoContrato)
  }).sort((primero, segundo) => {
    if (orden === 'especialidad') return (primero.especialidades[0]?.nombre ?? '').localeCompare(segundo.especialidades[0]?.nombre ?? '', 'es-CO')
    if (orden === 'contrato') return contrato(primero).localeCompare(contrato(segundo), 'es-CO')
    return primero.nombre.localeCompare(segundo.nombre, 'es-CO')
  })

  return (
    <AppShell activo="Instructores">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Instructores</h1><p className="text-sm text-slate-500 dark:text-slate-400">Planta de instructores y especialidades asignadas.</p></div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {instructores.length} instructores</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Instructores activos</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{instructores.filter((item) => item.estado === 'activo').length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Con especialidad</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{instructores.filter((item) => item.especialidades.length > 0).length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Especialidades</p><p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{especialidades.length}</p></div>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de instructores">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtrar instructores</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-sena-50 px-2 py-0.5 text-xs font-semibold text-sena-700 dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
          </div>
          {filtrosActivos > 0 && <button type="button" onClick={() => { setBusqueda(''); setEspecialidad('todas'); setTipoContrato('todos') }} className="text-sm font-medium text-sena-700 hover:text-sena-600 dark:text-sena-400">Limpiar filtros</button>}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_12rem_11rem_10rem]">
          <div className="md:col-span-2 xl:col-span-1"><label htmlFor="buscar-instructor" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label><input id="buscar-instructor" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Nombre, correo o especialidad" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" /></div>
          <div><label htmlFor="filtro-especialidad" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Especialidad</label><select id="filtro-especialidad" value={especialidad} onChange={(evento) => setEspecialidad(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todas">Todas</option>{especialidades.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="filtro-contrato" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Tipo de contrato</label><select id="filtro-contrato" value={tipoContrato} onChange={(evento) => setTipoContrato(evento.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="todos">Todos</option>{contratos.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label htmlFor="orden-instructor" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Ordenar por</label><select id="orden-instructor" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><option value="nombre">Nombre</option><option value="especialidad">Especialidad</option><option value="contrato">Contrato</option></select></div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando instructores...</p> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Especialidades</th><th className="px-4 py-3">Contrato</th><th className="px-4 py-3">Carga semanal</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{visibles.map((item) => <tr key={item.idUsuario} onClick={() => setSeleccionado(item)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sena-100 text-xs font-bold text-sena-700 dark:bg-sena-950/50">{iniciales(item.nombre)}</span><div><p className="font-semibold text-slate-900 dark:text-slate-100">{item.nombre}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.email}</p></div></div></td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.especialidades.length ? item.especialidades.map((especialidad) => especialidad.nombre).join(', ') : 'Sin asignar'}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{contrato(item)}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.horasContratadasSemana ? `${item.horasContratadasSemana} h` : 'Sin definir'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{item.estado}</span></td></tr>)}</tbody></table></div>{visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No hay instructores que coincidan con los filtros.</p>}</div>}

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
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {cargaVigente.horasAsignadas}h / {cargaVigente.horasMaximas}h
                </p>
              )}
            </div>
            {cargandoCarga ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Calculando…</p>
            ) : errorCarga ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No se pudo calcular la carga semanal.</p>
            ) : cargaVigente?.horasMaximas != null ? (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
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
              <p className="text-xs text-slate-500 dark:text-slate-400">Sin tipo de contrato definido — no se puede calcular el tope de RF-011.</p>
            )}
          </SeccionDrawer>

          {cargandoHorarios ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando horarios…</p>
          ) : errorHorarios ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No se pudieron cargar los horarios del instructor.</p>
          ) : (
            <>
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