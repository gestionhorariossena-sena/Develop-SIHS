import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { GridSemanalInstructor } from '../components/horario/GridSemanalInstructor'
import { SeccionAmbientesAsignados } from '../components/relacionados/SeccionesInstructor'
import { apiGet, ApiError } from '../services/api'
import type { CargaSemanal, Ficha, Horario, Usuario } from '../types/api'
import type { Jornada } from './horario/tipos'

const TODAS_LAS_JORNADAS: Jornada[] = ['Mañana', 'Tarde', 'Noche']

const FILTROS_JORNADA: { etiqueta: string; valor: Jornada | 'todas' }[] = [
  { etiqueta: 'Todas las jornadas', valor: 'todas' },
  { etiqueta: 'Mañana (06:00 - 12:00)', valor: 'Mañana' },
  { etiqueta: 'Tarde (12:00 - 18:00)', valor: 'Tarde' },
  { etiqueta: 'Noche (18:00 - 22:00)', valor: 'Noche' },
]

/** Duración en horas entre dos "HH:MM:SS" 24h — mismo formato que trae
 * `Horario.horaInicio/horaFin` (ver BLOQUES en pages/horario/tipos.ts). */
function duracionHoras(horaInicio: string, horaFin: string): number {
  const [hIni, mIni] = horaInicio.split(':').map(Number)
  const [hFin, mFin] = horaFin.split(':').map(Number)
  return (hFin * 60 + mFin - (hIni * 60 + mIni)) / 60
}

/** Igual al mapeo BLOQUES de pages/horario/tipos.ts — se repite acá (solo
 * para filtrar por jornada del lado del cliente, y para agrupar el grid
 * semanal) para no importar el módulo del editor completo en esta pantalla
 * de solo lectura. */
function jornadaDeHorario(horaInicio: string): Jornada {
  const hora = Number(horaInicio.split(':')[0])
  if (hora < 12) return 'Mañana'
  if (hora < 18) return 'Tarde'
  return 'Noche'
}

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

const ETIQUETA_CONTRATO: Record<string, string> = {
  planta: 'Instructor de Planta',
  contrato: 'Instructor de Contrato',
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function inicioSemana(fecha: Date): Date {
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dia = inicio.getDay()
  inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1))
  return inicio
}

function isoLocal(fecha: Date): string {
  const año = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

function etiquetaSemana(inicio: Date): string {
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 4)
  const mesInicio = MESES[inicio.getMonth()]
  const mesFin = MESES[fin.getMonth()]
  const rango = mesInicio === mesFin
    ? `${inicio.getDate()} al ${fin.getDate()} ${mesFin}`
    : `${inicio.getDate()} ${mesInicio} al ${fin.getDate()} ${mesFin}`
  return `Semana ${semanaISO(inicio)}: ${rango} ${fin.getFullYear()}`
}

function semanaISO(fecha: Date): number {
  const jueves = new Date(fecha)
  jueves.setDate(jueves.getDate() + 3)
  const primerDia = new Date(jueves.getFullYear(), 0, 1)
  return Math.ceil((((jueves.getTime() - primerDia.getTime()) / 86400000) + 1) / 7)
}

/**
 * Autoservicio del instructor — "Mi horario" (pedido 2026-09-03,
 * rediseño 2026-09-07 sobre el mockup Stitch "Mi Horario Semanal", ver
 * _Docs/Diseño/mockups-stitch/mi_horario_semanal_vista_principal_sihs_sena).
 * A diferencia de Vista por instructores (que un Coordinador usa para
 * elegir CUALQUIER instructor de una lista), acá no hay nada que elegir:
 * siempre es el usuario logueado, vía `GET /usuarios/me/horarios`, que ya
 * viene filtrado a solo lo publicado — un instructor nunca ve acá un
 * borrador que el coordinador todavía está armando (ver
 * HorarioService.obtener_publicados_por_instructor en el backend).
 *
 * Solo aparece en el nav para quien tenga el rol Instructor
 * (`AppShell.tsx`, ítem "Mi horario" con `soloInstructor: true`), pero la
 * ruta en sí no está restringida por rol — cualquier usuario autenticado
 * puede visitarla y ve sus propias clases (o ninguna, si no dicta clases).
 *
 * El ribbon de KPIs usa `GET /usuarios/{id}/carga-semanal` (SCRUM-49) para
 * "Carga Lectiva Semanal" y "Estatus Normativo RF-011" — ese endpoint solo
 * permitía Coordinador/Administrador; se amplió (ver app/api/v1/usuarios.py)
 * para que un usuario pueda pedir SU PROPIA carga sin esos roles, igual que
 * ya pasaba con /me/horarios. "Fichas Activas" y "Ambientes en Uso" se
 * derivan de los mismos horarios ya cargados (+ GET /fichas/ para los
 * aprendices convocados por ficha). "Ambientes asignados" reutiliza la
 * sección ya construida del drawer de instructor (SCRUM-64,
 * `SeccionesInstructor.tsx`) en vez de rehacerla.
 *
 * "Estatus Normativo" (tarjeta RF-011 del mockup) es 100% derivado de
 * `cargaSemanal`: si `horasAsignadas <= horasMaximas` es "Aprobado"; si el
 * instructor está sobre el tope se muestra el estado real de alerta ("Excede
 * el tope") en vez de inventar "Aprobado" — mismo criterio de tope que
 * `HorarioService.calcular_carga_semanal`/`_validar_reglas_instructor`
 * (HORAS_MAX_PLANTA=32 / HORAS_MAX_CONTRATO=40, ver horario_service.py), no
 * uno reinventado acá. Si el usuario no tiene tipoContrato definido
 * (`horasMaximas` null) no hay tope que evaluar — se muestra ese caso
 * aparte, no como "Aprobado".
 *
 * "Alertas Operativas" (columna derecha del mockup) depende del Módulo de
 * Asistencia y de Solicitudes de cambio/permuta — ninguno de los dos existe
 * en el backend todavía (tickets aparte, mismo epic), así que la sección se
 * queda en un estado disabled+tooltip explicando por qué, en vez de mostrar
 * las alertas de ejemplo del mockup (asistencia pendiente, permuta
 * aprobada) como si fueran reales. El botón "Solicitar Novedad o Permuta"
 * vive en esa misma tarjeta (igual que el mockup) y abre el formulario del
 * ticket de Solicitudes de cambio/permuta — deshabilitado por la misma
 * razón.
 *
 * "Mis Fichas Activas" (columna derecha) sí es real en la parte que puede
 * serlo: código de ficha, nombre del programa y aprendices totales vienen
 * de GET /fichas/ cruzado con las fichas de `horarios`. "Vocero" (ticket de
 * vocero/subvocero) y "Avance curricular" (ticket de avance curricular) no
 * tienen endpoint todavía — se muestran como pendientes explícitos, no como
 * datos inventados. "Contactar" queda deshabilitado hasta que exista
 * mensajería instructor-aprendiz (Epic "Vistas del Aprendiz").
 *
 * No incluye (ticket aparte, mismo epic): sincronización con SofiaPlus — esa
 * integración es decorativa en el mockup y no hay backend real conectado.
 */
export function MiHorario() {
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtroJornada, setFiltroJornada] = useState<Jornada | 'todas'>('todas')
  const [semanaInicio, setSemanaInicio] = useState(() => inicioSemana(new Date()))

  const [fichas, setFichas] = useState<Ficha[]>([])

  const [cargaSemanal, setCargaSemanal] = useState<CargaSemanal | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    const semanaFin = new Date(semanaInicio)
    semanaFin.setDate(semanaFin.getDate() + 4)
    const query = `?fechaInicio=${isoLocal(semanaInicio)}&fechaFin=${isoLocal(semanaFin)}`
    apiGet<Horario[]>(`/usuarios/me/horarios${query}`)
      .then(setHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.'))

    apiGet<Usuario>('/usuarios/me')
      .then(setPerfil)
      .catch(() => {})

    apiGet<Ficha[]>('/fichas/').then(setFichas).catch(() => {})
  }, [semanaInicio])

  // La carga semanal (SCRUM-49) requiere el propio idUsuario — se pide
  // aparte una vez que /usuarios/me responde, igual que el patrón de
  // Instructores.tsx para el instructor seleccionado.
  useEffect(() => {
    if (!perfil) return

    apiGet<CargaSemanal>(`/usuarios/${perfil.idUsuario}/carga-semanal`)
      .then((datos) => setCargaSemanal(datos))
      .catch(() => setErrorCarga(true))
  }, [perfil])

  const horariosFiltrados = useMemo(() => {
    if (!horarios) return null
    if (filtroJornada === 'todas') return horarios
    return horarios.filter((h) => jornadaDeHorario(h.horaInicio) === filtroJornada)
  }, [horarios, filtroJornada])

  const aprendicesPorFicha = useMemo(() => {
    const mapa: Record<number, number> = {}
    for (const ficha of fichas) mapa[ficha.idFicha] = ficha.aprendicesTotales
    return mapa
  }, [fichas])

  const fichasActivas = useMemo(() => new Set((horarios ?? []).map((h) => h.idFicha)), [horarios])
  // "Mis Fichas Activas" (columna derecha) necesita el objeto Ficha completo
  // (nombre de programa, aprendicesTotales), no solo el código que ya trae
  // Horario — se cruza con GET /fichas/ acá.
  const fichasActivasCompletas = useMemo(
    () => fichas.filter((f) => fichasActivas.has(f.idFicha)),
    [fichas, fichasActivas],
  )
  const aprendicesConvocados = useMemo(
    () => [...fichasActivas].reduce((total, idFicha) => total + (aprendicesPorFicha[idFicha] ?? 0), 0),
    [fichasActivas, aprendicesPorFicha],
  )
  const ambientesEnUso = useMemo(
    () => new Set((horarios ?? []).map((h) => h.ambienteNombre).filter((nombre): nombre is string => Boolean(nombre))),
    [horarios],
  )

  const horasSemanales = useMemo(() => {
    if (!horarios) return 0
    return horarios.reduce((total, h) => total + duracionHoras(h.horaInicio, h.horaFin) * h.dias.length, 0)
  }, [horarios])

  const cargandoCarga = Boolean(perfil) && !cargaSemanal && !errorCarga
  const jornadasVisibles = filtroJornada === 'todas' ? TODAS_LAS_JORNADAS : [filtroJornada]

  // RF-011 (backend/app/services/horario_service.py, HORAS_MAX_PLANTA=32 /
  // HORAS_MAX_CONTRATO=40): mismo criterio de tope que usa el backend para
  // calcular `cargaSemanal.horasMaximas` — acá solo se COMPARA, no se
  // reinventa el tope. `horasMaximas` es null cuando el usuario no tiene
  // tipoContrato definido, caso en el que no hay tope que evaluar (no es lo
  // mismo que "Aprobado"). Si excede el tope no se muestra "Aprobado": se
  // muestra el estado real de alerta, igual que el drawer de instructor en
  // Instructores.tsx ("Supera el máximo de RF-011").
  const excedeTopeRf011 =
    cargaSemanal?.horasMaximas != null && cargaSemanal.horasAsignadas > cargaSemanal.horasMaximas

  return (
    <AppShell activo="Mi horario">
      <nav className="mb-3 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span>/</span>
        <span className="text-on-surface">Mi Horario</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface">Mi Horario Semanal</h1>
          <p className="text-sm text-on-surface-variant">
            Tu horario semanal publicado por tu coordinador. Si falta una clase que sabés que ya te
            asignaron, puede que todavía esté en borrador — hablalo con tu coordinador.
          </p>
        </div>

        <ExportarPdfButton etiqueta="Descargar Horario PDF" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container" />
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {perfil && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
            {letraInicial(perfil.nombre)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-on-surface">{perfil.nombre}</p>
              {perfil.tipoContrato && ETIQUETA_CONTRATO[perfil.tipoContrato] && (
                <span className="rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container">
                  {ETIQUETA_CONTRATO[perfil.tipoContrato]}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">{perfil.email}</p>
          </div>
        </div>
      )}

      {/* Ribbon de KPIs: Carga Lectiva Semanal (SCRUM-49), Fichas Activas,
          Ambientes en Uso y Estatus Normativo RF-011 — todo derivado de
          datos ya reales. */}
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
                  {cargaSemanal?.horasMaximas != null ? `/ ${cargaSemanal.horasMaximas} hrs semanales` : 'hrs'}
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
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">Ambientes en Uso</p>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">domain</span>
          </div>
          <p className="text-2xl font-bold text-on-surface">{horarios ? ambientesEnUso.size : '—'}</p>
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
            <p className="text-sm text-on-surface-variant">Sin tipo de contrato definido — no hay tope de RF-011 que evaluar.</p>
          ) : excedeTopeRf011 ? (
            <>
              <p className="text-2xl font-bold text-red-600">
                Excede el tope
                <span className="ml-1 text-sm font-medium text-on-surface-variant">Tope {cargaSemanal.horasMaximas}h</span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
                <span className="material-symbols-outlined text-[15px]">error</span>
                Supera el máximo de RF-011
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-primary">
                Aprobado
                <span className="ml-1 text-sm font-medium text-on-surface-variant">Tope {cargaSemanal.horasMaximas}h</span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-secondary">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                Validado por Coordinación Académica
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS_JORNADA.map((filtro) => (
            <button
              key={filtro.valor}
              type="button"
              onClick={() => setFiltroJornada(filtro.valor)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filtroJornada === filtro.valor
                  ? 'border-primary bg-primary-container text-on-primary-container'
                  : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {filtro.etiqueta}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1">
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => {
                const anterior = new Date(semanaInicio)
                anterior.setDate(anterior.getDate() - 7)
                setSemanaInicio(anterior)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-2 text-center text-xs font-semibold text-on-surface">{etiquetaSemana(semanaInicio)}</span>
            <button
              type="button"
              aria-label="Semana siguiente"
              onClick={() => {
                const siguiente = new Date(semanaInicio)
                siguiente.setDate(siguiente.getDate() + 7)
                setSemanaInicio(siguiente)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSemanaInicio(inicioSemana(new Date()))}
            className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Hoy
          </button>

          {/* Pantalla del ticket "[Frontend] Pantalla Detalle de Franja y
              Ambiente" (mismo epic) todavía no existe — deshabilitado en vez
              de navegar a una ruta que no resuelve a nada. */}
          <button
            type="button"
            disabled
            title="Disponible cuando se publique la pantalla de Detalle de Franja y Ambiente (mismo epic)"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-primary/50 px-4 py-2 text-sm font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]">meeting_room</span>
            Abrir Detalle de Franja y Ambiente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 lg:col-span-2">
          <div className="mb-3 px-1">
            <h2 className="text-base font-semibold text-on-surface">Calendario Semanal de Formación</h2>
            <p className="text-xs text-on-surface-variant">Franjas oficiales de formación presencial y asesorías</p>
          </div>

          {!horarios && !error ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">Cargando tu horario…</p>
          ) : (horariosFiltrados ?? []).length === 0 ? (
            <p className="py-16 text-center text-sm text-on-surface-variant">
              {filtroJornada === 'todas'
                ? 'Todavía no tenés clases publicadas en este trimestre.'
                : 'No tenés clases publicadas en esa jornada.'}
            </p>
          ) : (
            <GridSemanalInstructor
              horarios={horariosFiltrados ?? []}
              jornadasVisibles={jornadasVisibles}
              aprendicesPorFicha={aprendicesPorFicha}
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* "Alertas Operativas" (mockup) depende de dos backends que no
              existen todavía (Módulo de Asistencia, Solicitudes de cambio/
              permuta) — no se inventan alertas de ejemplo, la sección queda
              disabled+tooltip explicando la dependencia. */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-tertiary">notification_important</span>
              <p className="text-sm font-semibold text-on-surface">Alertas Operativas</p>
            </div>
            <p
              className="text-sm text-on-surface-variant"
              title="Disponible cuando existan el Módulo de Asistencia y Solicitudes de cambio/permuta (mismo epic)"
            >
              Todavía no hay alertas de asistencia ni de permutas conectadas — esta sección se activa cuando esos
              módulos estén disponibles.
            </p>
            <button
              type="button"
              disabled
              title="Disponible cuando exista el módulo de Solicitudes de cambio/permuta (mismo epic)"
              className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              Solicitar Novedad o Permuta
            </button>
          </div>

          {/* "Mis Fichas Activas" (mockup): código, programa y aprendices
              son reales (GET /fichas/); vocero y avance curricular todavía
              no tienen endpoint (tickets aparte, mismo epic) — se marcan
              como pendientes en vez de inventar un nombre o un porcentaje. */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
              <p className="text-sm font-semibold text-on-surface">Mis Fichas Activas</p>
            </div>
            {!horarios ? (
              <p className="text-sm text-on-surface-variant">Cargando…</p>
            ) : fichasActivasCompletas.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Sin fichas asignadas este trimestre.</p>
            ) : (
              <ul className="space-y-3">
                {fichasActivasCompletas.map((ficha) => (
                  <li key={ficha.idFicha} className="rounded-xl bg-surface-container-low/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-on-surface">{ficha.codigoFicha}</span>
                      <span className="text-[11px] text-on-surface-variant">{ficha.aprendicesTotales} aprendices</span>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-tight text-on-surface">{ficha.programa.nombrePrograma}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span title="Pendiente: ticket de vocero/subvocero (mismo epic)">Vocero: No disponible</span>
                      <button
                        type="button"
                        disabled
                        title="Disponible cuando exista mensajería instructor-aprendiz (Epic Vistas del Aprendiz)"
                        className="flex cursor-not-allowed items-center gap-1 font-bold text-on-surface-variant/50"
                      >
                        <span className="material-symbols-outlined text-[13px]">chat</span> Contactar
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-on-surface-variant" title="Pendiente: ticket de avance curricular (mismo epic)">
                      Avance curricular: No disponible
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <SeccionAmbientesAsignados horarios={horarios ?? []} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
