import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet } from '../services/api'
import { ocupacionSemanalPorHora } from './horario/ocupacionSemanal'
import type { AuditoriaConflicto, Ambiente, AuditoriaCrucesResponse, DiaSemana, Ficha, Horario, Jornada, Usuario } from '../types/api'

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'Mañana', etiqueta: 'Mañana' },
  { id: 'Tarde', etiqueta: 'Tarde' },
  { id: 'Noche', etiqueta: 'Noche' },
] as const

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Lunes a sábado de la semana de `hoy` — no hay Domingo en diasDeLaSemana
// (ver database/02_datos_prueba.sql), así que la semana real del sistema
// tiene 6 días, no 7.
function semanaDe(hoy: Date) {
  const diaSemanaJs = hoy.getDay()
  const offsetALunes = diaSemanaJs === 0 ? -6 : 1 - diaSemanaJs
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() + offsetALunes)

  return Array.from({ length: 6 }, (_, i) => {
    const dia = new Date(lunes)
    dia.setDate(lunes.getDate() + i)
    return dia
  })
}

const fechaHoy = (() => {
  const texto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return capitalizar(texto)
})()

export function Dashboard({ esAdministrador = false }: { esAdministrador?: boolean }) {
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([])
  const [auditoria, setAuditoria] = useState<AuditoriaCrucesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('todos')

  useEffect(() => {
    apiGet<Horario[]>('/horarios/').then(setHorarios).catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudo cargar la programación.'))
    apiGet<Usuario[]>('/usuarios/').then(setUsuarios).catch(() => {})
    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
    apiGet<Jornada[]>('/jornadas/').then(setJornadas).catch(() => {})
    apiGet<Ambiente[]>('/ambientes').then(setAmbientes).catch(() => {})
    apiGet<DiaSemana[]>('/dias-semana/').then(setDiasSemana).catch(() => {})
    apiGet<AuditoriaCrucesResponse>('/horarios/auditoria-cruces').then(setAuditoria).catch(() => {})
  }, [])

  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.idUsuario, u])), [usuarios])
  const fichasPorId = useMemo(() => new Map(fichas.map((f) => [f.idFicha, f])), [fichas])
  const jornadasPorId = useMemo(() => new Map(jornadas.map((j) => [j.idJornada, j.nombreJornada])), [jornadas])

  const idDiaHoy = useMemo(() => {
    const nombreHoy = capitalizar(new Date().toLocaleDateString('es-CO', { weekday: 'long' }))
    return diasSemana.find((d) => d.nombreDia === nombreHoy)?.idDia ?? null
  }, [diasSemana])

  const horariosActivos = useMemo(() => (horarios ?? []).filter((h) => h.activo), [horarios])

  const horariosHoy = useMemo(() => {
    if (idDiaHoy === null) return []
    return horariosActivos
      .filter((h) => h.dias.includes(idDiaHoy))
      .slice()
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  }, [horariosActivos, idDiaHoy])

  // Si hoy no hay formación, mostrar el próximo día con sesiones en lugar
  // de presentar un tablero vacío pese a tener programación registrada.
  const proximoDiaProgramado = useMemo(() => {
    if (horariosHoy.length > 0 || horariosActivos.length === 0) return null
    for (let desplazamiento = 1; desplazamiento <= 7; desplazamiento++) {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() + desplazamiento)
      const nombreDia = capitalizar(fecha.toLocaleDateString('es-CO', { weekday: 'long' }))
      const idDia = diasSemana.find((dia) => dia.nombreDia === nombreDia)?.idDia
      if (idDia == null) continue
      const sesiones = horariosActivos.filter((horario) => horario.dias.includes(idDia))
        .slice().sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      if (sesiones.length > 0) return { fecha, sesiones }
    }
    return null
  }, [horariosHoy, horariosActivos, diasSemana])

  const sesionesVisibles = proximoDiaProgramado?.sesiones ?? horariosHoy
  const filas = useMemo(() => {
    if (filtro === 'todos') return sesionesVisibles
    return sesionesVisibles.filter((h) => jornadasPorId.get(h.idJornada) === filtro)
  }, [sesionesVisibles, filtro, jornadasPorId])

  const desglosePorJornada = useMemo(() => {
    const conteos = new Map<string, number>()
    for (const h of horariosActivos) {
      const nombre = jornadasPorId.get(h.idJornada)
      if (!nombre) continue
      conteos.set(nombre, (conteos.get(nombre) ?? 0) + 1)
    }
    return conteos
  }, [horariosActivos, jornadasPorId])

  const ambientesDisponibles = ambientes.filter((a) => a.estadoAmbiente === 'disponible').length
  const totalAmbientes = ambientes.length
  const porcentajeDisponible = totalAmbientes > 0 ? Math.round((ambientesDisponibles / totalAmbientes) * 100) : 0

  const conflictos: AuditoriaConflicto[] = auditoria?.conflictos ?? []
  const conflictosPorInstructor = conflictos.filter((c) => c.tipo === 'cruce_instructor').length
  const conflictosPorAmbiente = conflictos.filter((c) => c.tipo === 'cruce_ambiente').length
  const primerConflicto = conflictos[0]

  const pendientesDeRol = usuarios.filter((u) => u.roles.length === 0).length

  const ocupacionPorHora = useMemo(
    () => ocupacionSemanalPorHora(horariosActivos, diasSemana, totalAmbientes),
    [horariosActivos, diasSemana, totalAmbientes],
  )

  const diasDeLaSemana = useMemo(() => semanaDe(new Date()), [])
  const hoyTexto = new Date().toDateString()
  const horaActual = new Date().getHours()

  return (
    <AppShell activo="Inicio">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-on-surface-variant dark:text-slate-400" aria-label="Ubicación">
        <span>SENA Regional D.C.</span>
        <span>/</span>
        <span>CGMLTI Calle 52</span>
        <span>/</span>
        <span className="text-primary">Inicio</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant pb-6 dark:border-slate-700">
        <div>
          <h1 className="mb-2 text-3xl font-medium tracking-tight text-on-surface dark:text-slate-100">Programación académica</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">
            Centro de Gestión de Mercados, Logística y TI · {fechaHoy}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/horarios/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Crear horario
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="mb-6 border-y border-outline-variant dark:border-slate-700" aria-label="Estado de la programación">
        <dl className="grid divide-y divide-outline-variant sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-700">
          <div className="min-w-0 py-4 sm:px-5 sm:first:pl-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-on-surface-variant dark:text-slate-400">Horarios activos</dt>
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">calendar_month</span>
            </div>
            <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-on-surface dark:text-slate-100">{horarios ? horariosActivos.length : '—'}</dd>
            <p className="mt-1 truncate text-xs text-on-surface-variant dark:text-slate-400">
              {[...desglosePorJornada.entries()].map(([nombre, cantidad]) => `${nombre}: ${cantidad}`).join(' · ') || 'Sin franjas activas'}
            </p>
          </div>

          <div className="py-4 sm:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-on-surface-variant dark:text-slate-400">Cruces detectados</dt>
              <span className="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">warning</span>
            </div>
            <dd className="mt-1 flex items-center gap-2 font-mono text-2xl font-medium tabular-nums text-on-surface dark:text-slate-100">
              {conflictos.length}
              {conflictos.length > 0 && <span className="rounded-md bg-tertiary-container px-1.5 py-0.5 font-sans text-[11px] font-medium text-on-tertiary-container dark:bg-orange-950/50 dark:text-orange-300">Revisar</span>}
            </dd>
            <p className="mt-1 text-xs text-on-surface-variant dark:text-slate-400">
              {conflictosPorInstructor} instructor · {conflictosPorAmbiente} ambiente
            </p>
          </div>

          <div className="py-4 sm:pl-5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-on-surface-variant dark:text-slate-400">Ambientes disponibles</dt>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">meeting_room</span>
            </div>
            <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-on-surface dark:text-slate-100">
              {ambientesDisponibles} <span className="text-base text-on-surface-variant dark:text-slate-400">/ {totalAmbientes}</span>
            </dd>
            <div className="mt-2 h-1 w-full bg-surface-container dark:bg-slate-700" aria-label={`${porcentajeDisponible}% de ambientes disponibles`}>
              <div className="h-1 bg-primary" style={{ width: `${porcentajeDisponible}%` }} />
            </div>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-medium text-on-surface dark:text-slate-100">
                <span className="h-2 w-2 bg-tertiary dark:bg-primary" />
                {proximoDiaProgramado ? 'Próximo día con clases' : 'Horario académico de hoy'}
              </p>
              <p className="text-sm text-on-surface-variant dark:text-slate-400">
                {sesionesVisibles.length} sesiones programadas{proximoDiaProgramado ? ` · ${proximoDiaProgramado.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-surface-container p-1 dark:bg-slate-900">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    filtro === f.id
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:text-on-surface dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {f.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-xs text-on-surface-variant dark:border-slate-700 dark:text-slate-400">
                  <th scope="col" className="py-2 pr-4 font-medium">Hora</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Ficha</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Programa</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Instructor</th>
                  <th scope="col" className="py-2 font-medium">Ambiente</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const instructor = usuariosPorId.get(fila.idInstructor)
                  const ficha = fichasPorId.get(fila.idFicha)
                  const tieneConflicto = conflictos.some((c) => c.idHorario === fila.idHorario || c.idHorarioExistente === fila.idHorario)

                  return (
                    <tr
                      key={fila.idHorario}
                      className={`border-b border-outline-variant last:border-0 dark:border-slate-700 ${
                        tieneConflicto ? 'bg-tertiary-container/40 dark:bg-orange-950/30' : ''
                      }`}
                    >
                      <td className="py-3 pr-4 font-mono text-xs font-medium tabular-nums text-on-surface dark:text-slate-100">
                        {fila.horaInicio.slice(0, 5)}–{fila.horaFin.slice(0, 5)}
                      </td>
                      <td className="py-3 pr-4 text-on-surface-variant dark:text-slate-300">{fila.fichaCodigo}</td>
                      <td className="py-3 pr-4 text-on-surface-variant dark:text-slate-300">{ficha?.programa.nombrePrograma ?? '—'}</td>
                      <td className="py-3 pr-4 text-on-surface-variant dark:text-slate-300">
                        {fila.instructorNombre}
                        {instructor?.tipoContrato && (
                          <span className="ml-1.5 text-xs text-on-surface-variant/70">· {instructor.tipoContrato}</span>
                        )}
                      </td>
                      <td className="py-3 text-on-surface-variant dark:text-slate-300">{fila.ambienteNombre}</td>
                    </tr>
                  )
                })}
                {horarios && filas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-on-surface-variant dark:text-slate-400">
                      {horariosActivos.length === 0 ? 'No hay horarios activos registrados.' : 'No hay sesiones programadas para esta franja.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {primerConflicto && (
            <div className="rounded-2xl border border-tertiary-container bg-tertiary-container/30 p-5 dark:border-orange-900 dark:bg-orange-950/20">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-on-tertiary-container dark:text-orange-300">
                <span className="material-symbols-outlined text-[18px]">emergency_home</span>
                Atención inmediata
              </p>
              <p className="text-sm text-on-surface dark:text-slate-200">{primerConflicto.mensaje}</p>
              {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato real
                  del backend: no existe un endpoint que sugiera un ambiente
                  alterno libre para un conflicto puntual. */}
              <Link
                to={`/horarios/completos?id=${primerConflicto.idHorario}`}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-tertiary px-3 py-2.5 text-sm font-medium text-on-tertiary transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
              >
                Resolver en Horarios Completos
              </Link>
            </div>
          )}

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-4 text-sm font-medium text-on-surface dark:text-slate-100">
              Semana · {diasDeLaSemana[0]?.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex justify-center">
              <div className="flex gap-1.5">
                {diasDeLaSemana.map((dia) => (
                  <div
                    key={dia.toISOString()}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium tabular-nums ${
                      dia.toDateString() === hoyTexto
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant dark:text-slate-400'
                    }`}
                  >
                    {dia.getDate()}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 flex items-center justify-between text-sm font-medium text-on-surface dark:text-slate-100">
              Accesos de coordinación
            </p>
            <div className="flex flex-col gap-1">
              <Link to="/horarios/completos?perspectiva=ambiente" className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                Vista por ambientes
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
              {esAdministrador && <Link to="/aprobar-solicitudes" className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                <span>
                  Usuarios sin rol
                  {pendientesDeRol > 0 && <span className="ml-1.5 rounded-md bg-error-container px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums text-on-error-container">{pendientesDeRol}</span>}
                </span>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>}
              <Link to="/horarios/completos" className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                Gestionar horarios
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
              <Link to="/instructores" className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-on-surface transition-colors hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                Carga docente
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {ocupacionPorHora.length > 0 && (
        <section className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800" aria-labelledby="ocupacion-title">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p id="ocupacion-title" className="text-lg font-medium text-on-surface dark:text-slate-100">Pico semanal por franja</p>
              <p className="mt-1 text-xs text-on-surface-variant dark:text-slate-400">
                Máximo de ambientes ocupados en un mismo día de la semana
              </p>
            </div>
            <p className="font-mono text-xs tabular-nums text-on-surface-variant dark:text-slate-400">Base: {totalAmbientes} ambientes</p>
          </div>
          <p className="sr-only">
            Máximo porcentaje semanal de ambientes ocupados a cada hora, calculado sobre {totalAmbientes} ambientes reales.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
            {ocupacionPorHora.map(({ hora, porcentaje }) => (
              <div key={hora} className="min-w-0 border-l-2 border-outline-variant px-2 py-1.5 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span className="font-mono text-[11px] tabular-nums text-on-surface-variant dark:text-slate-400">{String(hora).padStart(2, '0')}:00</span>
                  {hora === horaActual && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Hora actual" />}
                </div>
                <span
                  className={`flex h-9 items-center justify-center rounded-md font-mono text-xs font-medium tabular-nums ${
                    porcentaje >= 90
                      ? 'bg-tertiary-container text-on-tertiary-container dark:bg-orange-950/60 dark:text-orange-300'
                      : porcentaje >= 60
                        ? 'bg-surface-container-high text-on-surface dark:bg-slate-700 dark:text-slate-100'
                        : 'bg-surface-container text-on-surface-variant dark:bg-slate-900'
                  }`}
                >
                  {porcentaje}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  )
}
