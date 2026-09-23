import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { SeccionAmbientesAsignados } from '../components/relacionados/SeccionesInstructor'
import { apiGet, ApiError } from '../services/api'
import type { CargaSemanal, DiaSemana, Ficha, Horario, Usuario } from '../types/api'
import type { Jornada } from './horario/tipos'

const DIAS_SEMANA_STRIP = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const ETIQUETA_CONTRATO: Record<string, string> = {
  planta: 'Instructor de Planta',
  contrato: 'Instructor de Contrato',
}

const ICONO_JORNADA: Record<Jornada, string> = {
  Mañana: 'wb_sunny',
  Tarde: 'wb_twilight',
  Noche: 'bedtime',
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Igual a la de MiHorario.tsx/GridSemanalInstructor.tsx — se repite acá a
 * propósito (mismo patrón ya usado en esas páginas). */
function jornadaDeHorario(horaInicio: string): Jornada {
  const hora = Number(horaInicio.split(':')[0])
  if (hora < 12) return 'Mañana'
  if (hora < 18) return 'Tarde'
  return 'Noche'
}

function duracionHoras(horaInicio: string, horaFin: string): number {
  const [hIni, mIni] = horaInicio.split(':').map(Number)
  const [hFin, mFin] = horaFin.split(':').map(Number)
  return (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60
}

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

// Lunes a sábado de la semana de `hoy` — igual a Dashboard.tsx (no hay
// Domingo en diasDeLaSemana, ver database/02_datos_prueba.sql).
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

type EstadoSesion = 'en_curso' | 'proxima' | 'finalizada'

function estadoDeSesion(horaInicio: string, horaFin: string, horaActual: string): EstadoSesion {
  if (horaActual < horaInicio) return 'proxima'
  if (horaActual >= horaFin) return 'finalizada'
  return 'en_curso'
}

function minutosHasta(horaInicio: string, horaActual: string): number {
  const [hIni, mIni] = horaInicio.split(':').map(Number)
  const [hAct, mAct] = horaActual.split(':').map(Number)
  return hIni * 60 + mIni - (hAct * 60 + mAct)
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

/**
 * Home del Instructor tras iniciar sesión (`/dashboard`, ver
 * DashboardRouter.tsx) — antes todo usuario caía en el mismo Dashboard.tsx
 * pensado para Coordinador ("Accesos de coordinación", cruces de todo el
 * centro), lo cual no tenía sentido para un Instructor. Rediseño sobre el
 * mockup Stitch "Inicio Instructor" (ver INICIO INSTRUCTOR.jpeg en la raíz
 * del repo y GUIA_DE_MARCA.md para los tokens).
 *
 * Es un resumen del día, no reemplaza "Mi Horario Semanal" (MiHorario.tsx,
 * `/mi-horario`) que sigue siendo la vista semanal completa de solo
 * lectura — acá solo se ven las clases de HOY con más contexto operativo
 * inmediato (estado en vivo, acceso directo al detalle de cada franja).
 *
 * Mismos endpoints que MiHorario.tsx (`/usuarios/me/horarios`,
 * `/usuarios/{id}/carga-semanal`, `/fichas/`) — es la misma información,
 * solo recortada a "hoy" en vez de la semana completa.
 */
export function DashboardInstructor() {
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([])

  const [cargaSemanal, setCargaSemanal] = useState<CargaSemanal | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    apiGet<Horario[]>('/usuarios/me/horarios')
      .then(setHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.'))

    apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => {})
    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
    apiGet<DiaSemana[]>('/dias-semana/').then(setDiasSemana).catch(() => {})
  }, [])

  useEffect(() => {
    if (!perfil) return

    apiGet<CargaSemanal>(`/usuarios/${perfil.idUsuario}/carga-semanal`)
      .then((datos) => setCargaSemanal(datos))
      .catch(() => setErrorCarga(true))
  }, [perfil])

  const horaActual = useMemo(() => new Date().toTimeString().slice(0, 8), [])

  const idDiaHoy = useMemo(() => {
    const nombreHoy = capitalizar(new Date().toLocaleDateString('es-CO', { weekday: 'long' }))
    return diasSemana.find((d) => d.nombreDia === nombreHoy)?.idDia ?? null
  }, [diasSemana])

  const nombreDiaHoy = useMemo(
    () => diasSemana.find((d) => d.idDia === idDiaHoy)?.nombreDia ?? '',
    [diasSemana, idDiaHoy],
  )

  const horariosActivos = useMemo(() => (horarios ?? []).filter((h) => h.activo), [horarios])

  const horariosHoy = useMemo(() => {
    if (idDiaHoy === null) return []
    return horariosActivos
      .filter((h) => h.dias.includes(idDiaHoy))
      .slice()
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  }, [horariosActivos, idDiaHoy])

  const fichasPorId = useMemo(() => new Map(fichas.map((f) => [f.idFicha, f])), [fichas])
  const aprendicesPorFicha = useMemo(() => {
    const mapa: Record<number, number> = {}
    for (const ficha of fichas) mapa[ficha.idFicha] = ficha.aprendicesTotales
    return mapa
  }, [fichas])

  const fichasActivas = useMemo(() => new Set(horariosActivos.map((h) => h.idFicha)), [horariosActivos])
  const fichasActivasCompletas = useMemo(
    () => fichas.filter((f) => fichasActivas.has(f.idFicha)),
    [fichas, fichasActivas],
  )
  const aprendicesConvocados = useMemo(
    () => [...fichasActivas].reduce((total, idFicha) => total + (aprendicesPorFicha[idFicha] ?? 0), 0),
    [fichasActivas, aprendicesPorFicha],
  )
  const programasUnicos = useMemo(
    () => [...new Set(fichasActivasCompletas.map((f) => f.programa.nombrePrograma))],
    [fichasActivasCompletas],
  )

  const ambientesAsignados = useMemo(
    () => [...new Set(horariosActivos.map((h) => h.ambienteNombre).filter((n): n is string => Boolean(n)))],
    [horariosActivos],
  )

  const horasSemanales = useMemo(() => {
    if (!horarios) return 0
    return horarios.reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin) * h.dias.length, 0)
  }, [horarios])

  const cargandoCarga = Boolean(perfil) && !cargaSemanal && !errorCarga
  const excedeTopeRf011 =
    cargaSemanal?.horasMaximas != null && cargaSemanal.horasAsignadas > cargaSemanal.horasMaximas

  const sesionesHoy = useMemo(
    () =>
      horariosHoy.map((h) => ({
        horario: h,
        estado: estadoDeSesion(h.horaInicio, h.horaFin, horaActual),
      })),
    [horariosHoy, horaActual],
  )
  const enCursoHoy = sesionesHoy.filter((s) => s.estado === 'en_curso').length
  const pendientesHoy = sesionesHoy.filter((s) => s.estado === 'proxima').length
  const horasHoy = useMemo(
    () => horariosHoy.reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin), 0),
    [horariosHoy],
  )
  const ambientesHoy = useMemo(
    () => [...new Set(horariosHoy.map((h) => h.ambienteNombre).filter((n): n is string => Boolean(n)))],
    [horariosHoy],
  )

  const diasDeLaSemana = useMemo(() => semanaDe(new Date()), [])
  const hoyTexto = new Date().toDateString()

  return (
    <AppShell activo="Inicio">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-on-primary">
            {perfil ? letraInicial(perfil.nombre) : '·'}
          </span>
          <div>
            <h1 className="mb-1 text-2xl font-bold text-on-surface">
              Hola, {perfil ? perfil.nombre.split(' ')[0] : '…'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              {perfil?.tipoContrato && ETIQUETA_CONTRATO[perfil.tipoContrato] && (
                <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                  {ETIQUETA_CONTRATO[perfil.tipoContrato]}
                </span>
              )}
              <span>{fechaHoy}</span>
            </div>
          </div>
        </div>

        <Link
          to="/mi-horario"
          className="flex items-center gap-1.5 rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          Ver Horario Semanal
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Carga Lectiva Semanal</p>
            <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
          </div>
          {!perfil ? (
            <p className="text-sm text-on-surface-variant">Cargando…</p>
          ) : cargandoCarga ? (
            <p className="text-sm text-on-surface-variant">Calculando…</p>
          ) : errorCarga ? (
            <p className="text-2xl font-bold text-on-surface">
              {horasSemanales}
              <span className="ml-1 text-sm font-medium text-on-surface-variant">hrs (estimado)</span>
            </p>
          ) : (
            <>
              <p className="text-2xl font-bold text-on-surface">
                {cargaSemanal?.horasAsignadas}
                <span className="ml-1 text-sm font-medium text-on-surface-variant">
                  {cargaSemanal?.horasMaximas != null ? `/ ${cargaSemanal.horasMaximas} hrs` : 'hrs'}
                </span>
              </p>
              {cargaSemanal?.horasMaximas != null && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.round((cargaSemanal.horasAsignadas / cargaSemanal.horasMaximas) * 100))}%` }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Estatus Normativo</p>
            <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
          </div>
          {!perfil || cargandoCarga ? (
            <p className="text-sm text-on-surface-variant">{!perfil ? 'Cargando…' : 'Calculando…'}</p>
          ) : errorCarga ? (
            <p className="text-sm text-on-surface-variant">No se pudo validar el tope de RF-011.</p>
          ) : cargaSemanal?.horasMaximas == null ? (
            <p className="text-sm text-on-surface-variant">Sin tipo de contrato definido.</p>
          ) : excedeTopeRf011 ? (
            <p className="text-2xl font-bold text-red-600">Excede el tope</p>
          ) : (
            <p className="text-2xl font-bold text-primary">Aprobado</p>
          )}
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Fichas Activas</p>
            <span className="material-symbols-outlined text-[18px] text-secondary">groups</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">
            {horarios ? fichasActivas.size : '—'}
            <span className="ml-1 text-sm font-medium text-on-surface-variant">{fichasActivas.size === 1 ? 'ficha' : 'fichas'}</span>
          </p>
          {horarios && aprendicesConvocados > 0 && (
            <p className="mt-1 text-xs text-on-surface-variant">{aprendicesConvocados} aprendices convocados</p>
          )}
          {programasUnicos.length > 0 && (
            <p className="mt-1 truncate text-xs text-on-surface-variant" title={programasUnicos.join(', ')}>
              {programasUnicos.join(', ')}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Clases de Hoy</p>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">event_available</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">
            {horarios ? sesionesHoy.length : '—'}
            <span className="ml-1 text-sm font-medium text-on-surface-variant">{sesionesHoy.length === 1 ? 'sesión' : 'sesiones'}</span>
          </p>
          {horarios && sesionesHoy.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
              {enCursoHoy > 0 && (
                <span className="rounded-full bg-primary-container px-2 py-0.5 font-semibold text-on-primary-container">
                  {enCursoHoy} en curso
                </span>
              )}
              {pendientesHoy > 0 && <span>{pendientesHoy} pendiente{pendientesHoy === 1 ? '' : 's'}</span>}
            </p>
          )}
          {horarios && sesionesHoy.length > 0 && (
            <p className="mt-1 text-xs text-on-surface-variant">
              Total hoy: {horasHoy}h{ambientesHoy.length > 0 ? ` · ${ambientesHoy.join(' y ')}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-base font-semibold text-on-surface">
                Mis clases de hoy <span className="font-normal text-on-surface-variant">({sesionesHoy.length} {sesionesHoy.length === 1 ? 'bloque' : 'bloques'})</span>
              </h2>
              <p className="text-xs text-on-surface-variant">Agenda ordenada cronológicamente con franjas, ambiente asignado y estado de la sesión.</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Hora actual: {horaActual.slice(0, 5)}
            </span>
          </div>

          {!horarios && !error ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">Cargando tu horario…</p>
          ) : sesionesHoy.length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">No tenés clases programadas hoy.</p>
          ) : (
            <ul className="space-y-3">
              {sesionesHoy.map(({ horario, estado }) => {
                const ficha = fichasPorId.get(horario.idFicha)
                const jornada = jornadaDeHorario(horario.horaInicio)
                const aprendices = aprendicesPorFicha[horario.idFicha]

                return (
                  <li
                    key={horario.idHorario}
                    className={`rounded-xl border-l-4 p-3 ${
                      estado === 'en_curso'
                        ? 'border-l-primary bg-primary-container/20'
                        : estado === 'finalizada'
                          ? 'border-l-outline-variant opacity-70'
                          : 'border-l-tertiary'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-bold text-on-surface">
                          {horario.horaInicio.slice(0, 5)} – {horario.horaFin.slice(0, 5)}
                        </p>
                        <p className="text-xs text-on-surface-variant">{duracionHoras(horario.horaInicio, horario.horaFin)} horas</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                          Ficha {horario.fichaCodigo ?? horario.idFicha}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                          <span className="material-symbols-outlined text-[13px]">{ICONO_JORNADA[jornada]}</span>
                          Jornada {jornada}
                        </span>
                        {estado === 'en_curso' && (
                          <span className="rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container">En curso</span>
                        )}
                        {estado === 'proxima' && (
                          <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-[11px] font-semibold text-on-tertiary-container">Próxima</span>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-on-surface">{ficha?.programa.nombrePrograma ?? 'Sin programa'}</p>
                    {(horario.resultadoCodigo || horario.resultadoDescripcion) && (
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        Competencia: {horario.resultadoDescripcion ?? horario.resultadoCodigo}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span>
                          <span className="material-symbols-outlined align-middle text-[14px]">meeting_room</span>{' '}
                          Ambiente: <span className="font-semibold text-on-surface">{horario.ambienteNombre ?? 'Sin ambiente'}</span>
                        </span>
                        {aprendices != null && <span>{aprendices} aprendices</span>}
                        {estado === 'proxima' && (
                          <span>Inicia en {Math.max(0, minutosHasta(horario.horaInicio, horaActual))} min</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled
                          title="Disponible cuando exista el Módulo de Asistencia (mismo epic que MiHorario.tsx)"
                          className="cursor-not-allowed rounded-lg border border-outline px-2.5 py-1 text-xs font-semibold text-on-surface-variant/50"
                        >
                          Ver lista de asistencia
                        </button>
                        <Link
                          to={`/mi-horario/detalle-franja?horario=${horario.idHorario}&dia=${encodeURIComponent(nombreDiaHoy)}`}
                          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary hover:bg-on-primary-container"
                        >
                          Detalle de ambiente
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {sesionesHoy.length > 0 && (
            <div className="mt-3 flex justify-end px-1">
              <Link to="/mi-horario" className="text-xs font-semibold text-primary hover:underline">
                Ir a Mi Horario detallado →
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">bolt</span>
              <p className="text-sm font-semibold text-on-surface">Accesos rápidos</p>
            </div>
            <div className="flex flex-col gap-1">
              <Link to="/mi-horario" className="flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-container">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Ver mi horario semanal completo</p>
                  <p className="text-xs text-on-surface-variant">Matriz de lunes a sábado con franjas</p>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>
              </Link>
              <Link to="/mi-horario" className="flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-container">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Ver mis ambientes asignados</p>
                  <p className="truncate text-xs text-on-surface-variant" title={ambientesAsignados.join(', ')}>
                    {ambientesAsignados.length > 0 ? ambientesAsignados.join(', ') : 'Sin ambientes asignados'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>
              </Link>
              <div
                title="Disponible cuando exista el módulo de Solicitudes de cambio/permuta (mismo epic que MiHorario.tsx)"
                className="flex cursor-not-allowed items-start justify-between gap-2 rounded-lg px-2 py-2 opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-on-surface">Solicitar novedad o permuta</p>
                  <p className="text-xs text-on-surface-variant">Gestión formal de cambios de franja</p>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">lock</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-tertiary">notification_important</span>
                <p className="text-sm font-semibold text-on-surface">Alertas Operativas</p>
              </div>
              <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">0 pendientes</span>
            </div>
            <p
              className="mt-2 text-sm text-on-surface-variant"
              title="Disponible cuando existan el Módulo de Asistencia y Solicitudes de cambio/permuta (mismo epic que MiHorario.tsx)"
            >
              Todavía no hay alertas de asistencia ni de permutas conectadas — esta sección se activa cuando esos
              módulos estén disponibles.
            </p>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <SeccionAmbientesAsignados horarios={horariosActivos} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-on-surface">
            Resumen semanal de carga lectiva
            <span className="ml-2 font-normal text-on-surface-variant">
              {diasDeLaSemana[0]?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} al{' '}
              {diasDeLaSemana[5]?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </span>
          </p>
          <Link to="/mi-horario" className="text-xs font-semibold text-primary hover:underline">
            Ver horario completo →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {diasDeLaSemana.map((dia, idx) => {
            const nombreDia = DIAS_SEMANA_STRIP[idx]
            const idDia = diasSemana.find((d) => d.nombreDia === nombreDia)?.idDia
            const bloquesDelDia = idDia != null ? horariosActivos.filter((h) => h.dias.includes(idDia)) : []
            const horasDelDia = bloquesDelDia.reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin), 0)
            const esHoy = dia.toDateString() === hoyTexto

            return (
              <div
                key={dia.toISOString()}
                className={`rounded-xl border p-3 ${esHoy ? 'border-primary bg-primary-container/20' : 'border-outline-variant'}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase text-on-surface">{nombreDia.slice(0, 3)} {dia.getDate()}</p>
                  {esHoy && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">HOY</span>}
                </div>
                {bloquesDelDia.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Sin formación</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-on-surface">{horasDelDia}h</p>
                    <p className="truncate text-[11px] text-on-surface-variant" title={bloquesDelDia.map((b) => b.fichaCodigo).join(', ')}>
                      {[...new Set(bloquesDelDia.map((b) => b.fichaCodigo).filter(Boolean))].join(', ')}
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
