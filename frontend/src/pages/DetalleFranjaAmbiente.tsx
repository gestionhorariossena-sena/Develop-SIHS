import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Ambiente, CompetenciaFormacion, Ficha, Horario, ResultadoAprendizaje, Usuario } from '../types/api'
import type { Jornada } from './horario/tipos'

const ETIQUETA_CONTRATO: Record<string, string> = {
  planta: 'Instructor de Planta',
  contrato: 'Instructor de Contrato',
}

const ETIQUETA_ESTADO_AMBIENTE: Record<string, string> = {
  disponible: 'Operativo',
  mantenimiento: 'En mantenimiento',
  inactivo: 'Inactivo',
}

/** Igual a la de MiHorario.tsx/GridSemanalInstructor.tsx — se repite acá
 * a propósito (mismo patrón ya usado en esas páginas). */
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

function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

/**
 * "Detalle de Franja y Ambiente" — se abre desde "Detalle →" de cada
 * bloque del grid semanal de "Mi Horario" (GridSemanalInstructor.tsx),
 * vía `?horario=<idHorario>&dia=<Día>`. Mockup Stitch:
 * _Docs/Diseño/mockups-stitch/detalle_de_franja_y_ambiente_sihs_sena.
 *
 * Cadena de datos reales: `GET /usuarios/me/horarios` ya trae el bloque
 * (ficha, tema/RAP, ambiente, horas, días) — a partir de ahí se piden
 * `GET /fichas/{id}` (programa, sede, aprendices), `GET /ambientes/{id}`
 * (estado, tipo) y `GET /resultados-aprendizaje/{id}` →
 * `GET /competencias-formacion/{id}` (competencia asociada al RAP en
 * curso). Estos 4 endpoints solo permitían Coordinador/Administrador
 * (`require_lectura_catalogo`) — se ampliaron a
 * `require_lectura_catalogo_o_instructor` (backend/app/core/supabase_auth.py)
 * para que un Instructor pueda leer el detalle liviano de SU PROPIA
 * sesión sin tener rol de coordinación; la escritura de esos catálogos y
 * el horario COMPLETO de otro instructor/ficha/ambiente siguen exigiendo
 * el rol de coordinación como antes.
 *
 * Deliberadamente NO reales (cada uno depende de un ticket aparte, mismo
 * epic — no se inventa el dato mientras tanto):
 *  - Fase del Proyecto Formativo (ticket de avance curricular).
 *  - Vocero de Ficha (ticket de vocero/subvocero).
 *  - Piso / capacidad / responsable de llaves del ambiente (ticket de
 *    ficha técnica de ambiente).
 *  - Nómina de aprendices / asistencia real (ticket del Módulo de
 *    Asistencia) — se deja el mismo banner "Módulo exploratorio" del
 *    mockup, sin tabla de aprendices inventados.
 *  - "Modalidad" del mockup: no existe ningún campo de modalidad
 *    (presencial/virtual) en el backend todavía, así que no se muestra.
 *
 * El bloque "Equipamiento e Inventario de Aula" SÍ se deja igual que en
 * el mockup (a propósito, así lo pide el ticket): contenido conceptual /
 * en evaluación, claramente marcado como tal — no es un dato real.
 *
 * Acciones (Descargar Ficha / Reportar Novedad / Radicar Solicitud de
 * Cambio / Cerrar Sesión de Formación): ninguna tiene backend todavía
 * (solicitudes de cambio, exportación PDF, ni un concepto de "sesión"
 * para cerrar) — quedan deshabilitadas con tooltip, no fingen funcionar.
 */
export function DetalleFranjaAmbiente() {
  const [searchParams] = useSearchParams()
  const idHorarioParam = searchParams.get('horario')
  const dia = searchParams.get('dia') ?? ''
  const idHorario = idHorarioParam ? Number(idHorarioParam) : null

  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [errorFicha, setErrorFicha] = useState(false)
  const [ambiente, setAmbiente] = useState<Ambiente | null>(null)
  const [errorAmbiente, setErrorAmbiente] = useState(false)
  const [resultado, setResultado] = useState<ResultadoAprendizaje | null>(null)
  const [competencia, setCompetencia] = useState<CompetenciaFormacion | null>(null)
  const [errorCompetencia, setErrorCompetencia] = useState(false)

  useEffect(() => {
    apiGet<Horario[]>('/usuarios/me/horarios')
      .then(setHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.'))

    apiGet<Usuario>('/usuarios/me')
      .then(setPerfil)
      .catch(() => {})
  }, [])

  const horario = useMemo(
    () => (idHorario != null ? (horarios?.find((h) => h.idHorario === idHorario) ?? null) : null),
    [horarios, idHorario],
  )

  useEffect(() => {
    if (!horario) return

    apiGet<Ficha>(`/fichas/${horario.idFicha}`)
      .then(setFicha)
      .catch(() => setErrorFicha(true))

    apiGet<Ambiente>(`/ambientes/${horario.idAmbiente}`)
      .then(setAmbiente)
      .catch(() => setErrorAmbiente(true))

    apiGet<ResultadoAprendizaje>(`/resultados-aprendizaje/${horario.idResultado}`)
      .then(setResultado)
      .catch(() => setErrorCompetencia(true))
  }, [horario])

  useEffect(() => {
    if (!resultado) return

    apiGet<CompetenciaFormacion>(`/competencias-formacion/${resultado.idCompetencia}`)
      .then(setCompetencia)
      .catch(() => setErrorCompetencia(true))
  }, [resultado])

  const horasSemanaBloque = horario ? duracionHoras(horario.horaInicio, horario.horaFin) * horario.dias.length : 0
  const horasPorDia = horario ? duracionHoras(horario.horaInicio, horario.horaFin) : 0

  return (
    <AppShell activo="Mi horario">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-on-surface-variant">
          <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
          <span>/</span>
          <Link to="/mi-horario" className="hover:text-primary">Mi Horario</Link>
          <span>/</span>
          <span className="rounded-lg bg-surface-container-low px-2 py-0.5 font-semibold text-on-surface">
            Detalle de Franja{horario ? `: ${dia} ${formatoHora(horario.horaInicio)} - ${formatoHora(horario.horaFin)} (Ficha ${horario.fichaCodigo ?? horario.idFicha})` : ''}
          </span>
        </nav>
        <Link
          to="/mi-horario"
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Volver a Mi Horario Semanal
        </Link>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!horarios && !error ? (
        <p className="py-16 text-center text-sm text-on-surface-variant">Cargando el detalle de la franja…</p>
      ) : !horario ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <p className="text-sm font-semibold text-on-surface">No encontramos esa franja.</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Puede que el enlace esté vencido o incompleto. Volvé a Mi Horario y elegí "Detalle →" en el bloque que querés consultar.
          </p>
          <Link to="/mi-horario" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            Ir a Mi Horario Semanal
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Encabezado de la sesión */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-max items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[14px]">verified</span>
                  Dato Oficial SIHS
                </span>
                <h1 className="text-2xl font-bold text-on-surface">
                  Detalle de Sesión Formativa{ficha ? `: ${ficha.programa.nombrePrograma}` : ''}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    Ficha {horario.fichaCodigo ?? horario.idFicha}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    Franja {jornadaDeHorario(horario.horaInicio)} ({formatoHora(horario.horaInicio)} - {formatoHora(horario.horaFin)} · {horasPorDia}h lectivas)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Aún no implementado en el backend"
                  className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-xl bg-surface-container-low px-4 text-sm font-semibold text-on-surface-variant opacity-70"
                >
                  <span className="material-symbols-outlined text-[18px]">description</span>
                  Descargar Ficha
                </button>
                <button
                  type="button"
                  disabled
                  title="Aún no implementado en el backend"
                  className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-xl bg-error/60 px-4 text-sm font-semibold text-on-error opacity-80"
                >
                  <span className="material-symbols-outlined text-[18px]">report_problem</span>
                  Reportar Novedad
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Sección 1: Datos Pedagógicos y Curriculares */}
            <div className="flex flex-col gap-6 lg:col-span-7">
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">school</span>
                  <h2 className="text-base font-semibold text-on-surface">Datos Pedagógicos y Curriculares</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface p-3">
                    <p className="text-xs tracking-wide text-on-surface-variant uppercase">Programa Académico</p>
                    {!ficha && !errorFicha ? (
                      <p className="mt-1 text-sm text-on-surface-variant">Cargando…</p>
                    ) : errorFicha ? (
                      <p className="mt-1 text-sm text-on-surface-variant">No se pudo cargar el programa.</p>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-on-surface">{ficha!.programa.nombrePrograma}</p>
                        <p className="text-xs text-on-surface-variant">Código: {ficha!.programa.codigoPrograma}</p>
                      </>
                    )}
                  </div>

                  {/* Fase del Proyecto Formativo — depende del ticket de
                      avance curricular, todavía no existe ese dato. */}
                  <div className="rounded-xl bg-surface p-3">
                    <p className="text-xs tracking-wide text-on-surface-variant uppercase">Fase del Proyecto Formativo</p>
                    <p className="mt-1 text-sm text-on-surface-variant">Pendiente — depende del ticket de avance curricular.</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-surface p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs tracking-wide text-on-surface-variant uppercase">Competencia Asociada</p>
                    {competencia?.codigo && (
                      <span className="rounded bg-surface-container-low px-1.5 py-0.5 text-xs text-on-surface">{competencia.codigo}</span>
                    )}
                  </div>
                  {!resultado && !errorCompetencia ? (
                    <p className="text-sm text-on-surface-variant">Cargando…</p>
                  ) : errorCompetencia ? (
                    <p className="text-sm text-on-surface-variant">No se pudo cargar la competencia asociada.</p>
                  ) : !competencia ? (
                    <p className="text-sm text-on-surface-variant">Cargando…</p>
                  ) : (
                    <p className="text-sm font-semibold text-on-surface">{competencia.descripcion}</p>
                  )}
                </div>

                <div className="mt-3 rounded-xl bg-secondary-container/40 p-3">
                  <p className="text-xs font-semibold tracking-wide text-on-secondary-container uppercase">
                    Resultado de Aprendizaje (RAP en curso)
                  </p>
                  <blockquote className="mt-1 rounded-r-lg bg-primary/10 py-1.5 pl-3 text-sm text-on-surface italic">
                    "{horario.resultadoDescripcion ?? horario.resultadoCodigo ?? 'Sin resultado de aprendizaje asignado'}"
                  </blockquote>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-on-primary">
                      {perfil ? perfil.nombre.trim().charAt(0).toUpperCase() : '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary">INSTRUCTOR TITULAR</p>
                      <p className="truncate text-sm font-bold text-on-surface">{perfil?.nombre ?? 'Cargando…'}</p>
                      <p className="text-xs text-on-surface-variant">
                        {perfil?.tipoContrato && ETIQUETA_CONTRATO[perfil.tipoContrato] ? ETIQUETA_CONTRATO[perfil.tipoContrato] : 'Instructor'}
                      </p>
                    </div>
                  </div>

                  {/* Vocero de Ficha — depende del ticket de
                      vocero/subvocero, todavía no existe ese dato. */}
                  <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px]">person_off</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface-variant">VOCERO DE FICHA</p>
                      <p className="text-sm text-on-surface-variant">Pendiente — depende del ticket de vocero/subvocero.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel de métricas de franja */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:grid-cols-4">
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-on-surface-variant">Horas Semana</p>
                  <p className="text-xl font-bold text-on-surface">{horasSemanaBloque}h</p>
                  <p className="text-xs text-primary">{horasPorDia}h / día</p>
                </div>
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-on-surface-variant">Total Aprendices</p>
                  <p className="text-xl font-bold text-on-surface">{ficha ? ficha.aprendicesTotales : '—'}</p>
                </div>
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-on-surface-variant">Jornada</p>
                  <p className="text-xl font-bold text-on-surface">{jornadaDeHorario(horario.horaInicio)}</p>
                  <p className="text-xs text-on-surface-variant">{formatoHora(horario.horaInicio)} a {formatoHora(horario.horaFin)}</p>
                </div>
                <div className="rounded-xl bg-surface p-3">
                  <p className="text-xs text-on-surface-variant">Sede Operativa</p>
                  <p className="truncate text-xl font-bold text-on-surface">{ficha?.sede?.nombreSede ?? 'Sin sede'}</p>
                </div>
              </div>
            </div>

            {/* Sección 2: Ficha Técnica del Ambiente */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">meeting_room</span>
                    <h2 className="text-base font-semibold text-on-surface">Ficha Técnica del Ambiente</h2>
                  </div>
                  {ambiente && (
                    <span className="rounded-full bg-secondary-container px-2.5 py-1 text-xs font-semibold text-on-secondary-container">
                      {ETIQUETA_ESTADO_AMBIENTE[ambiente.estadoAmbiente] ?? ambiente.estadoAmbiente}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant">Identificador</span>
                    <span className="text-sm font-bold text-primary">{ambiente?.nombreAmbiente ?? horario.ambienteNombre ?? 'Sin ambiente'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant">Tipo de ambiente</span>
                    <span className="text-sm font-medium text-on-surface capitalize">{errorAmbiente ? 'No disponible' : (ambiente?.tipoAmbiente ?? 'Cargando…')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant">Piso / Capacidad / Responsable de llaves</span>
                    <span className="text-xs text-on-surface-variant">Pendiente</span>
                  </div>
                </div>

                {/* Contenido de mockup (Stitch) — pendiente de conectar a un
                    dato real del backend (ticket de piso/capacidad/
                    responsable de llaves). Marcado explícitamente como
                    conceptual/en evaluación, igual que en el mockup — no
                    finge ser un dato real. */}
                <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface-container-low p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                      <span className="material-symbols-outlined text-tertiary text-[16px]">devices</span>
                      Equipamiento e Inventario de Aula
                    </span>
                    <span className="rounded bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container">
                      *Dato Conceptual / En Evaluación
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Parámetros técnicos de referencia cargados preliminarmente para la integración de inventarios automáticos:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-surface-container-lowest p-2">
                      <p className="text-xs text-on-surface-variant">Capacidad Puestos</p>
                      <p className="text-sm font-bold text-on-surface">30 Puestos</p>
                    </div>
                    <div className="rounded-lg bg-surface-container-lowest p-2">
                      <p className="text-xs text-on-surface-variant">Estaciones de Trabajo</p>
                      <p className="text-sm font-bold text-on-surface">30 equipos</p>
                    </div>
                    <div className="rounded-lg bg-surface-container-lowest p-2">
                      <p className="text-xs text-on-surface-variant">Conectividad Red</p>
                      <p className="text-sm font-bold text-on-surface">1 Gbps</p>
                    </div>
                    <div className="rounded-lg bg-surface-container-lowest p-2">
                      <p className="text-xs text-on-surface-variant">Audiovisual</p>
                      <p className="text-sm font-bold text-on-surface">Pantalla táctil</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-3 rounded-xl bg-surface-container-low p-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">health_and_safety</span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Protocolo de Laboratorio</p>
                    <p className="text-xs text-on-surface-variant">
                      Prohibido el ingreso de alimentos o líquidos descubiertos. Valida el apagado seguro de terminales y el cierre perimetral al finalizar la sesión.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sección 3: Nómina de Aprendices / Asistencia */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
            <div className="flex flex-col gap-2 rounded-xl bg-tertiary-container/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 sm:items-center">
                <span className="material-symbols-outlined text-tertiary text-[20px]">science</span>
                <div>
                  <p className="text-sm font-bold text-on-tertiary-container">MÓDULO EXPLORATORIO / EN EVALUACIÓN UX</p>
                  <p className="text-xs text-on-surface-variant">
                    El backend institucional SIHS actual no provee lista de aprendices por ficha en tiempo real (gestión descentralizada en SOFIA Plus). Depende del ticket del Módulo de Asistencia.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-semibold text-on-surface">Nómina de Aprendices Registrados</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Todavía no hay una fuente real de asistencia por ficha — cuando el Módulo de Asistencia esté listo, esta sección mostrará la nómina real de {ficha?.aprendicesTotales ?? 'los'} aprendices convocados.
              </p>
            </div>
          </div>

          {/* Acciones al pie */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[24px]">task_alt</span>
              <div>
                <p className="text-sm font-semibold text-on-surface">Franja consultada</p>
                <p className="text-xs text-on-surface-variant">Datos oficiales de SIHS para esta sesión.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled
                title="Aún no implementado en el backend"
                className="inline-flex h-11 cursor-not-allowed items-center gap-1.5 rounded-xl bg-surface-container-low px-5 text-sm font-semibold text-on-surface-variant opacity-70"
              >
                <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                Radicar Solicitud de Cambio o Novedad
              </button>
              <button
                type="button"
                disabled
                title="Aún no implementado en el backend"
                className="inline-flex h-11 cursor-not-allowed items-center gap-1.5 rounded-xl bg-primary/50 px-5 text-sm font-semibold text-on-primary"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Cerrar Sesión de Formación
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
