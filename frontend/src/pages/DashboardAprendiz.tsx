import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Aviso, Ficha, Horario, MiAsistencia, Usuario } from '../types/api'

type FiltroJornada = 'manana' | 'tarde' | 'noche' | 'todos'

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function idDiaSistema(fecha: Date) {
  const js = fecha.getDay()
  return js === 0 ? 7 : js
}

function duracionHoras(inicio: string, fin: string) {
  const [hi, mi] = inicio.split(':').map(Number)
  const [hf, mf] = fin.split(':').map(Number)
  return Math.max(0, (hf * 60 + mf - hi * 60 - mi) / 60)
}

function jornadaDe(horario: Horario): Exclude<FiltroJornada, 'todos'> {
  const hora = Number(horario.horaInicio.slice(0, 2))
  if (hora < 12) return 'manana'
  if (hora < 18) return 'tarde'
  return 'noche'
}

function inicioSemana(fecha: Date) {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const dia = copia.getDay()
  copia.setDate(copia.getDate() - (dia === 0 ? 6 : dia - 1))
  return copia
}

function diasSemana(fecha: Date) {
  const lunes = inicioSemana(fecha)
  return Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(lunes)
    dia.setDate(lunes.getDate() + indice)
    return dia
  })
}

function fechaLarga(fecha: Date) {
  const texto = fecha.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function primeraPalabra(nombre: string) {
  return nombre.trim().split(/\s+/)[0] || nombre
}

function faseTexto(ficha: Ficha | null) {
  if (!ficha?.faseActual) return 'Etapa lectiva'
  return `Fase ${ficha.faseActual}`
}

function estadoClase(horario: Horario, ahora: Date) {
  const [hi, mi] = horario.horaInicio.split(':').map(Number)
  const [hf, mf] = horario.horaFin.split(':').map(Number)
  const minutoActual = ahora.getHours() * 60 + ahora.getMinutes()
  const inicio = hi * 60 + mi
  const fin = hf * 60 + mf

  if (minutoActual >= inicio && minutoActual < fin) return 'En curso'
  if (minutoActual < inicio) return 'Próxima'
  return 'Finalizada'
}

function claseEstado(estado: string) {
  if (estado === 'En curso') return 'bg-primary-container text-on-primary-container'
  if (estado === 'Próxima') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  return 'bg-surface-container text-on-surface-variant'
}

export function DashboardAprendiz() {
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [asistencia, setAsistencia] = useState<MiAsistencia | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [filtro, setFiltro] = useState<FiltroJornada>('manana')
  const [error, setError] = useState<string | null>(null)

  const ahora = useMemo(() => new Date(), [])
  const hoyId = idDiaSistema(ahora)
  const semana = useMemo(() => diasSemana(ahora), [ahora])

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => setPerfil(null))

    apiGet<Ficha>('/ficha-usuario/mi-ficha')
      .then(setFicha)
      .catch((err: unknown) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu ficha.')
        }
      })

    apiGet<Horario[]>('/ficha-usuario/mi-horario')
      .then(setHorarios)
      .catch((err: unknown) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.')
        }
      })

    apiGet<MiAsistencia>('/asistencias/mias').then(setAsistencia).catch(() => setAsistencia(null))
    apiGet<Aviso[]>('/avisos/').then(setAvisos).catch(() => setAvisos([]))
  }, [])

  const clasesHoy = useMemo(
    () =>
      horarios
        .filter((horario) => horario.activo && horario.publicado && horario.dias.includes(hoyId))
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [horarios, hoyId],
  )

  const clasesVisibles = useMemo(
    () => clasesHoy.filter((horario) => filtro === 'todos' || jornadaDe(horario) === filtro),
    [clasesHoy, filtro],
  )

  const horasHoy = useMemo(
    () => clasesHoy.reduce((total, horario) => total + duracionHoras(horario.horaInicio, horario.horaFin), 0),
    [clasesHoy],
  )

  const primeraClase = clasesHoy[0]
  const ultimaClase = clasesHoy.at(-1)
  const resumen = asistencia?.resumen

  const diasConClase = useMemo(() => new Set(horarios.flatMap((h) => h.activo && h.publicado ? h.dias : [])), [horarios])

  return (
    <AppShell activo="Inicio">
      <div className="mx-auto max-w-[1240px] space-y-4">
        <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest to-primary-container/35 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary-container text-2xl">
                🎒
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-on-surface md:text-2xl">
                    {perfil ? `Hola, Aprendiz ${perfil.nombre}` : 'Hola, Aprendiz'}
                  </h1>
                  <span className="rounded-full bg-primary-container px-2.5 py-1 text-[11px] font-bold text-on-primary-container">
                    {faseTexto(ficha)}
                  </span>
                </div>
                <p className="truncate text-sm text-on-surface-variant">
                  {ficha?.programa.nombrePrograma ?? 'Programa de formación'}
                  {ficha ? ` · Ficha ${ficha.codigoFicha}` : ''}
                </p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">
                  {ficha?.jornadas?.length ? `Jornada ${ficha.jornadas.join(' / ')}` : fechaLarga(ahora)}
                  {ficha?.trimestre ? ` · ${ficha.trimestre.nombre}` : ''}
                </p>
              </div>
            </div>

            <Link
              to="/mi-asistencia"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              Ver historial asistencias
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-primary-container px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-primary-container">
                En curso
              </span>
              <span className="text-xs font-semibold text-on-surface-variant">{clasesHoy.length} bloque{clasesHoy.length === 1 ? '' : 's'}</span>
            </div>
            <p className="text-lg font-bold text-on-surface">{ficha ? `Ficha ${ficha.codigoFicha}` : 'Mi formación'}</p>
            <p className="mt-1 line-clamp-1 text-sm font-medium text-primary">
              {ficha?.programa.nombrePrograma ?? 'Sin ficha vinculada'}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">meeting_room</span>
                {primeraClase?.ambienteNombre ?? 'Sin clase ahora'}
              </span>
              {ficha && <span>{ficha.aprendicesTotales} aprendices</span>}
            </div>
          </article>

          <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Asistencia registrada</p>
              {resumen && resumen.registradas > 0 && (
                <span className="rounded-full bg-primary-container px-2 py-1 text-[10px] font-bold text-on-primary-container">
                  {resumen.porcentaje >= 85 ? 'Al día' : 'Revisar'}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-on-surface">{resumen?.registradas ? `${resumen.porcentaje}%` : '—'}</p>
            <p className="text-xs text-on-surface-variant">sobre sesiones ya registradas</p>
            <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-3 text-xs">
              <span className="text-on-surface-variant">{resumen?.registradas ?? 0} asistencias registradas</span>
              <span className="font-semibold text-primary">{resumen?.ausente ?? 0} ausencias</span>
            </div>
          </article>

          <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Carga de hoy</p>
            <p className="text-3xl font-bold text-on-surface">
              {horasHoy.toFixed(horasHoy % 1 === 0 ? 0 : 1)}
              <span className="ml-1 text-sm font-medium text-on-surface-variant">horas presenciales</span>
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-outline-variant pt-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {clasesHoy.length} bloques
              </span>
              <span className="text-on-surface-variant">
                {ultimaClase ? `Finaliza ${ultimaClase.horaFin.slice(0, 5)}` : 'Sin clases hoy'}
              </span>
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
          <div className="space-y-4">
            <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">calendar_month</span>
                    <h2 className="text-lg font-bold text-on-surface">
                      {MESES[ahora.getMonth()].charAt(0).toUpperCase() + MESES[ahora.getMonth()].slice(1)} {ahora.getFullYear()}
                    </h2>
                  </div>
                  <p className="ml-8 text-xs text-on-surface-variant">Semana actual · {ficha?.trimestre.nombre ?? 'Período académico'}</p>
                </div>

                <div className="flex rounded-xl bg-surface-container p-1 text-xs font-semibold">
                  {([
                    ['manana', 'Mañana'],
                    ['tarde', 'Tarde'],
                    ['noche', 'Noche'],
                    ['todos', 'Todos'],
                  ] as const).map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setFiltro(valor)}
                      className={`rounded-lg px-3 py-1.5 transition ${filtro === valor ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {semana.map((dia) => {
                  const esHoy = dia.toDateString() === ahora.toDateString()
                  const tieneClase = diasConClase.has(idDiaSistema(dia))
                  return (
                    <div
                      key={dia.toISOString()}
                      className={`rounded-xl border px-1 py-3 text-center ${esHoy ? 'border-primary bg-primary text-on-primary shadow-sm' : 'border-outline-variant bg-surface-container-low'}`}
                    >
                      <p className={`text-[10px] font-bold uppercase ${esHoy ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                        {NOMBRES_DIA[dia.getDay()].slice(0, 3)}
                      </p>
                      <p className="mt-1 text-lg font-bold">{dia.getDate()}</p>
                      <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${esHoy ? 'bg-on-primary' : tieneClase ? 'bg-primary' : 'bg-outline-variant'}`} />
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-on-surface">Cumplimiento de horario semanal</p>
                  <p className="text-xs text-on-surface-variant">
                    {horarios.filter((h) => h.activo && h.publicado).length} bloques publicados en tu ficha
                  </p>
                </div>
                <Link to="/mi-horario-aprendiz" className="text-xs font-bold text-primary hover:underline">
                  Ver horario completo →
                </Link>
              </div>
            </article>

            <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Mi cronograma de hoy</h2>
                  <p className="text-xs text-on-surface-variant">
                    {NOMBRES_DIA[ahora.getDay()]} {ahora.getDate()} de {MESES[ahora.getMonth()]} · {clasesHoy.length} sesiones formativas
                  </p>
                </div>
                <span className="rounded-full bg-primary-container px-3 py-1 text-[11px] font-bold text-on-primary-container">
                  Horario publicado
                </span>
              </div>

              {clasesVisibles.length === 0 ? (
                <div className="rounded-xl bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant">
                  No tienes clases en esta jornada hoy.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {clasesVisibles.map((horario) => {
                    const estado = estadoClase(horario, ahora)
                    return (
                      <article key={horario.idHorario} className="rounded-xl border border-outline-variant bg-surface p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${claseEstado(estado)}`}>
                            {estado}
                          </span>
                          <span className="text-xs font-semibold text-on-surface-variant">
                            {horario.horaInicio.slice(0, 5)} - {horario.horaFin.slice(0, 5)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-on-surface">
                          {horario.resultadoCodigo ?? horario.resultadoDescripcion ?? 'Clase'}
                        </p>
                        {horario.resultadoCodigo && horario.resultadoDescripcion && (
                          <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{horario.resultadoDescripcion}</p>
                        )}
                        <div className="mt-4 space-y-2 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
                          <p className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">person</span>
                            {horario.instructorNombre ?? 'Instructor'}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">location_on</span>
                            {horario.ambienteNombre ?? 'Ambiente por confirmar'}
                          </p>
                        </div>
                        <Link
                          to="/mi-horario-aprendiz"
                          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:bg-on-primary-container"
                        >
                          Ver detalles →
                        </Link>
                      </article>
                    )
                  })}
                </div>
              )}
            </article>
          </div>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Accesos rápidos</h2>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/mi-horario-aprendiz" className="rounded-xl border border-primary/15 bg-primary-container/30 p-3 transition hover:bg-primary-container">
                  <span className="material-symbols-outlined text-primary">calendar_month</span>
                  <span className="mt-2 block text-xs font-bold text-on-surface">Mi horario</span>
                </Link>
                <Link to="/mensajes" className="rounded-xl border border-primary/15 bg-primary-container/30 p-3 transition hover:bg-primary-container">
                  <span className="material-symbols-outlined text-primary">chat</span>
                  <span className="mt-2 block text-xs font-bold text-on-surface">Mensajes</span>
                </Link>
                <Link to="/avisos" className="rounded-xl border border-primary/15 bg-primary-container/30 p-3 transition hover:bg-primary-container">
                  <span className="material-symbols-outlined text-primary">campaign</span>
                  <span className="mt-2 block text-xs font-bold text-on-surface">Ver avisos</span>
                </Link>
                <Link to="/mi-asistencia" className="rounded-xl border border-primary/15 bg-primary-container/30 p-3 transition hover:bg-primary-container">
                  <span className="material-symbols-outlined text-primary">fact_check</span>
                  <span className="mt-2 block text-xs font-bold text-on-surface">Mi asistencia</span>
                </Link>
              </div>
            </article>

            <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Avisos académicos</h2>
                <Link to="/avisos" className="text-[10px] font-bold text-primary hover:underline">Ver todos</Link>
              </div>
              {avisos.length === 0 ? (
                <p className="rounded-xl bg-surface-container-low px-3 py-4 text-xs text-on-surface-variant">
                  No hay avisos vigentes para ti.
                </p>
              ) : (
                <div className="space-y-2">
                  {avisos.slice(0, 3).map((aviso) => (
                    <Link key={aviso.idAviso} to="/avisos" className="block rounded-xl border border-tertiary/15 bg-tertiary-container/40 p-3 hover:bg-tertiary-container">
                      <p className="line-clamp-1 text-[11px] font-bold text-on-tertiary-container">{aviso.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] text-on-surface-variant">{aviso.cuerpo}</p>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Tu ficha</p>
              <p className="mt-2 text-sm font-bold text-on-surface">{ficha?.codigoFicha ?? 'Sin ficha vinculada'}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {ficha?.programa.nombrePrograma ?? 'Vincula tu ficha desde Mi horario para completar tu información.'}
              </p>
              {perfil && (
                <p className="mt-3 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
                  Sesión de {primeraPalabra(perfil.nombre)}
                </p>
              )}
            </article>
          </aside>
        </section>
      </div>
    </AppShell>
  )
}
