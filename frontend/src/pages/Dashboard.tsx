import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet } from '../services/api'
import type { AuditoriaConflicto, Ambiente, AuditoriaCrucesResponse, DiaSemana, Ficha, Horario, Jornada, Usuario } from '../types/api'

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'Mañana', etiqueta: 'Mañana' },
  { id: 'Tarde', etiqueta: 'Tarde' },
  { id: 'Noche', etiqueta: 'Noche' },
] as const

const HORAS_OCUPACION = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 21]

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

export function Dashboard() {
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

  const filas = useMemo(() => {
    if (filtro === 'todos') return horariosHoy
    return horariosHoy.filter((h) => jornadasPorId.get(h.idJornada) === filtro)
  }, [horariosHoy, filtro, jornadasPorId])

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

  // Ocupación real por franja: cuántos horarios activos cubren cada hora,
  // como fracción de los ambientes totales — no es un dato ya calculado
  // por el backend, pero sí se deriva 100% de datos reales ya cargados
  // (horarios + ambientes), no es contenido inventado.
  const ocupacionPorHora = useMemo(() => {
    if (totalAmbientes === 0) return []
    return HORAS_OCUPACION.map((hora) => {
      const enUso = horariosActivos.filter((h) => {
        const inicio = Number(h.horaInicio.slice(0, 2))
        const fin = Number(h.horaFin.slice(0, 2))
        return inicio <= hora && hora < fin
      }).length
      return { hora, porcentaje: Math.round((enUso / totalAmbientes) * 100) }
    })
  }, [horariosActivos, totalAmbientes])

  const diasDeLaSemana = useMemo(() => semanaDe(new Date()), [])
  const hoyTexto = new Date().toDateString()

  return (
    <AppShell activo="Inicio">
      <nav className="mb-1 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant dark:text-slate-400">
        <span>SENA Regional D.C.</span>
        <span>/</span>
        <span>CGMLTI Calle 52</span>
        <span>/</span>
        <span className="text-primary">Dashboard</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Dashboard — Panel de Programación</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">
            Centro de Gestión de Mercados, Logística y TI · {fechaHoy}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled
            title="Aún no implementado en el backend"
            className="cursor-not-allowed rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant dark:border-slate-700 dark:text-slate-300"
          >
            Exportar horarios
          </button>
          <Link
            to="/horarios/nuevo"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container"
          >
            Nuevo horario
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-on-surface-variant uppercase dark:text-slate-400">
              Horarios activos
            </p>
            <span className="material-symbols-outlined text-[20px] text-primary">calendar_month</span>
          </div>
          <p className="text-3xl font-bold text-on-surface dark:text-slate-100">{horarios ? horariosActivos.length : '—'}</p>
          <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">
            {[...desglosePorJornada.entries()].map(([nombre, cantidad]) => `${nombre}: ${cantidad}`).join(' · ') || 'Sin franjas activas'}
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-on-surface-variant uppercase dark:text-slate-400">
              Cruces detectados
            </p>
            <span className="material-symbols-outlined text-[20px] text-tertiary">warning</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-on-surface dark:text-slate-100">{conflictos.length}</p>
            {conflictos.length > 0 && (
              <span className="rounded-full bg-tertiary-container px-2.5 py-1 text-xs font-semibold text-on-tertiary-container dark:bg-orange-950/50 dark:text-orange-300">
                Requiere revisión
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">
            {conflictosPorInstructor} por instructor · {conflictosPorAmbiente} por ambiente
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-on-surface-variant uppercase dark:text-slate-400">
              Ambientes disponibles
            </p>
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">meeting_room</span>
          </div>
          <p className="text-3xl font-bold text-on-surface dark:text-slate-100">
            {ambientesDisponibles} <span className="text-lg font-medium text-on-surface-variant dark:text-slate-400">/ {totalAmbientes}</span>
          </p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-surface-container dark:bg-slate-700">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${porcentajeDisponible}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold text-on-surface dark:text-slate-100">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Horario académico de hoy
              </p>
              <p className="text-sm text-on-surface-variant dark:text-slate-400">
                {horariosHoy.length} sesiones programadas · seguimiento en tiempo real
              </p>
            </div>

            <div className="flex gap-1 rounded-xl bg-surface-container p-1 dark:bg-slate-900">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
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
                <tr className="border-b border-outline-variant text-xs uppercase text-on-surface-variant dark:border-slate-700 dark:text-slate-400">
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
                      <td className="py-3 pr-4 font-semibold text-on-surface dark:text-slate-100">
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
                      No hay sesiones programadas para hoy en esta franja.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {primerConflicto && (
            <div className="rounded-xl border border-tertiary-container bg-tertiary-container/30 p-4 dark:border-orange-900 dark:bg-orange-950/20">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-tertiary-container dark:text-orange-300">
                <span className="material-symbols-outlined text-[18px]">emergency_home</span>
                Atención inmediata
              </p>
              <p className="text-sm text-on-surface dark:text-slate-200">{primerConflicto.mensaje}</p>
              {/* Contenido de mockup (Stitch) — pendiente de conectar a un dato real
                  del backend: no existe un endpoint que sugiera un ambiente
                  alterno libre para un conflicto puntual. */}
              <p className="mt-2 text-xs text-on-surface-variant dark:text-slate-400">
                Ambiente alterno sugerido (ejemplo): <span className="font-semibold">por definir</span>
              </p>
              <Link
                to={`/horarios/completos?id=${primerConflicto.idHorario}`}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-tertiary px-3 py-2 text-sm font-semibold text-on-tertiary hover:opacity-90"
              >
                Resolver en Horarios Completos
              </Link>
            </div>
          )}

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 text-sm font-semibold text-on-surface dark:text-slate-100">
              Semana · {diasDeLaSemana[0]?.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex items-center justify-between">
              <button
                disabled
                title="Aún no implementado en el backend"
                className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg text-on-surface-variant/50"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <div className="flex gap-1">
                {diasDeLaSemana.map((dia) => (
                  <div
                    key={dia.toISOString()}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                      dia.toDateString() === hoyTexto
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant dark:text-slate-400'
                    }`}
                  >
                    {dia.getDate()}
                  </div>
                ))}
              </div>
              <button
                disabled
                title="Aún no implementado en el backend"
                className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg text-on-surface-variant/50"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 flex items-center justify-between text-sm font-semibold text-on-surface dark:text-slate-100">
              Accesos de coordinación
              <span className="text-xs font-normal text-on-surface-variant dark:text-slate-400">Frecuentes</span>
            </p>
            <div className="flex flex-col gap-1">
              <Link to="/vista-ambientes" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                Vista por ambientes
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
              <Link to="/aprobar-solicitudes" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                <span>
                  Aprobar solicitudes
                  {pendientesDeRol > 0 && <span className="ml-1.5 rounded-full bg-error-container px-1.5 py-0.5 text-xs font-semibold text-on-error-container">{pendientesDeRol}</span>}
                </span>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
              <Link to="/horarios/nuevo" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                Constructor de horarios
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
              <Link to="/instructores" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-on-surface hover:bg-surface-container dark:text-slate-200 dark:hover:bg-slate-700">
                Carga docente
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {ocupacionPorHora.length > 0 && (
        <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Ocupación horaria por franja</p>
          <p className="mb-4 text-xs text-on-surface-variant dark:text-slate-400">
            % de ambientes con un horario activo en cada hora, calculado sobre {totalAmbientes} ambientes reales.
          </p>
          <div className="flex flex-wrap gap-2">
            {ocupacionPorHora.map(({ hora, porcentaje }) => (
              <div key={hora} className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-on-surface-variant dark:text-slate-400">{String(hora).padStart(2, '0')}:00</span>
                <span
                  className={`flex h-10 w-14 items-center justify-center rounded-lg text-xs font-semibold ${
                    porcentaje >= 90
                      ? 'bg-primary text-on-primary'
                      : porcentaje >= 60
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {porcentaje}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}
