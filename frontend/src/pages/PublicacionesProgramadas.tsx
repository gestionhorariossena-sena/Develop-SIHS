import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { Horario, Trimestre } from '../types/api'

type EstadoProgramacion = 'pendiente' | 'ejecutando' | 'revision_requerida' | 'publicada' | 'fallida' | 'cancelada'

interface PublicacionProgramada {
  idPublicacion: number
  idTrimestre: number
  fechaEjecucion: string
  estado: EstadoProgramacion
  fechaCreacion: string
  fechaEjecucionReal: string | null
  resultado: string | null
  revision: number
  idHorarios: number[]
}

interface DisponibilidadWorker {
  habilitado: boolean
  ultimaSenal: string | null
  segundosDesdeSenal: number | null
  motivo: string | null
}

const ETIQUETAS: Record<EstadoProgramacion, string> = {
  pendiente: 'pendiente',
  ejecutando: 'ejecutando',
  revision_requerida: 'requiere revisión',
  publicada: 'publicada',
  fallida: 'fallida',
  cancelada: 'cancelada',
}

function horarioResumen(horario: Horario) {
  return `Ficha ${horario.fichaCodigo ?? horario.idFicha} · ${horario.instructorNombre ?? 'Instructor'} · ${horario.horaInicio.slice(0, 5)}–${horario.horaFin.slice(0, 5)}`
}

function fechaLocalBogota(instantanea: string) {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instantanea))
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}`
}

function estadoEstilo(estado: EstadoProgramacion) {
  if (estado === 'publicada') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
  if (estado === 'fallida') return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
  if (estado === 'revision_requerida') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  if (estado === 'ejecutando') return 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
  if (estado === 'cancelada') return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
  return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
}

export function PublicacionesProgramadas() {
  const [searchParams] = useSearchParams()
  const idInicial = Number(searchParams.get('idHorario'))
  const [publicaciones, setPublicaciones] = useState<PublicacionProgramada[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadWorker | null>(null)
  const [periodo, setPeriodo] = useState('')
  const [seleccion, setSeleccion] = useState<number[]>(Number.isFinite(idInicial) && idInicial > 0 ? [idInicial] : [])
  const [fechaLocal, setFechaLocal] = useState('')
  const [reprogramando, setReprogramando] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    const resultados = await Promise.allSettled([
      apiGet<PublicacionProgramada[]>('/publicaciones-programadas/'),
      apiGet<Trimestre[]>('/trimestres/'),
      apiGet<Horario[]>('/horarios/'),
    ])
    if (resultados[0].status === 'fulfilled') setPublicaciones(resultados[0].value)
    else setError(resultados[0].reason instanceof ApiError ? resultados[0].reason.message : 'No se pudieron consultar las publicaciones.')
    if (resultados[1].status === 'fulfilled') setTrimestres(resultados[1].value)
    if (resultados[2].status === 'fulfilled') {
      setHorarios(resultados[2].value)
      const inicial = resultados[2].value.find((horario) => horario.idHorario === idInicial && !horario.publicado)
      if (inicial) {
        setPeriodo(String(inicial.idTrimestre))
        setSeleccion([inicial.idHorario])
      }
    }
    try {
      setDisponibilidad(await apiGet<DisponibilidadWorker>('/publicaciones-programadas/disponibilidad'))
    } catch {
      setDisponibilidad({ habilitado: false, ultimaSenal: null, segundosDesdeSenal: null, motivo: 'No fue posible verificar la señal reciente del worker.' })
    }
    setCargando(false)
  }

  useEffect(() => { void cargar() }, [])

  const trimestreSeleccionado = Number(periodo)
  const borradores = useMemo(() => horarios.filter((horario) =>
    horario.activo && !horario.publicado && horario.idTrimestre === trimestreSeleccionado,
  ), [horarios, trimestreSeleccionado])
  const programacionActiva = disponibilidad?.habilitado === true
  const trimestreNombre = trimestres.find((item) => item.idTrimestre === trimestreSeleccionado)?.nombre ?? `Período ${trimestreSeleccionado || 'sin seleccionar'}`
  const horariosSeleccionados = borradores.filter((horario) => seleccion.includes(horario.idHorario))

  function cambiarPeriodo(valor: string) {
    setPeriodo(valor)
    const horarioInicial = horarios.find((horario) => horario.idHorario === idInicial && horario.idTrimestre === Number(valor) && !horario.publicado)
    setSeleccion(horarioInicial ? [horarioInicial.idHorario] : [])
  }

  function alternarHorario(id: number) {
    setSeleccion((actual) => actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id])
  }

  async function guardarProgramacion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!programacionActiva || !periodo || !fechaLocal || seleccion.length === 0 || ocupado) return
    setOcupado(true)
    setError(null)
    try {
      const cuerpo = { idTrimestre: trimestreSeleccionado, idHorarios: seleccion, fechaHoraLocal: `${fechaLocal}:00` }
      if (reprogramando === null) await apiPost('/publicaciones-programadas/', cuerpo)
      else await apiPut(`/publicaciones-programadas/${reprogramando}`, cuerpo)
      setMensaje(reprogramando === null ? 'La publicación quedó programada.' : 'La publicación fue reprogramada y aprobada para la nueva revisión.')
      setReprogramando(null)
      setFechaLocal('')
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la programación.')
    } finally {
      setOcupado(false)
    }
  }

  async function cancelar(id: number) {
    if (!window.confirm(`¿Cancelar la publicación programada ${id}?`)) return
    setOcupado(true)
    setError(null)
    try {
      await apiPost(`/publicaciones-programadas/${id}/cancelar`)
      setMensaje(`La publicación ${id} fue cancelada.`)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar la publicación.')
    } finally {
      setOcupado(false)
    }
  }

  function iniciarReprogramacion(publicacion: PublicacionProgramada) {
    setPeriodo(String(publicacion.idTrimestre))
    setSeleccion(publicacion.idHorarios)
    setFechaLocal(fechaLocalBogota(publicacion.fechaEjecucion))
    setReprogramando(publicacion.idPublicacion)
    const formulario = document.getElementById('form-programacion')
    if (formulario && typeof formulario.scrollIntoView === 'function') {
      formulario.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <AppShell activo="Publicaciones programadas">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Coordinación académica</p>
          <h1 className="text-2xl font-bold text-on-surface dark:text-slate-100">Publicaciones programadas</h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant dark:text-slate-400">Programa borradores validados para que el worker los publique a la hora elegida de Colombia.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/horarios/nuevo" className="rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container">Guardar borrador</Link>
          <Link to="/horarios/historial" className="rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container">Historial</Link>
          <Link to="/notificaciones" className="rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container">Notificaciones</Link>
        </div>
      </div>

      {disponibilidad && (
        <section className={`mb-4 rounded-xl border p-4 text-sm ${programacionActiva ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'}`} role="status" aria-live="polite">
          <strong>{programacionActiva ? 'Worker disponible' : 'Publicación programada no disponible'}</strong>
          <p className="mt-1">{programacionActiva ? `Señal recibida hace ${disponibilidad.segundosDesdeSenal ?? 0} s.` : disponibilidad.motivo ?? 'El backend no confirma un worker activo.'} Los borradores y el historial siguen accesibles.</p>
        </section>
      )}
      {error && <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" role="alert">{error}</p>}
      {mensaje && <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200" role="status">{mensaje}</p>}

      <section id="form-programacion" className="mb-6 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 text-lg font-bold text-on-surface dark:text-slate-100">{reprogramando === null ? 'Programar publicación' : `Reprogramar publicación ${reprogramando}`}</h2>
        {reprogramando !== null && <p className="mb-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">Al guardar, esta programación recibe una nueva revisión y requiere aprobación con el conjunto y la fecha actuales.</p>}
        <form onSubmit={(evento) => void guardarProgramacion(evento)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="periodo-publicacion" className="mb-1 block text-sm font-semibold text-on-surface dark:text-slate-200">Período académico</label>
              <select id="periodo-publicacion" value={periodo} onChange={(evento) => cambiarPeriodo(evento.target.value)} required className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" disabled={ocupado}>
                <option value="">Selecciona un período</option>
                {trimestres.map((trimestre) => <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre} · {trimestre.fechaInicio} a {trimestre.fechaFin}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="fecha-publicacion" className="mb-1 block text-sm font-semibold text-on-surface dark:text-slate-200">Fecha y hora de Colombia</label>
              <input id="fecha-publicacion" type="datetime-local" value={fechaLocal} onChange={(evento) => setFechaLocal(evento.target.value)} required disabled={!programacionActiva || ocupado} className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
              <p className="mt-1 text-xs text-on-surface-variant">Se interpreta como America/Bogota, sin depender de la zona horaria del navegador.</p>
            </div>
          </div>
          <fieldset disabled={!periodo || ocupado} className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-on-surface dark:text-slate-200">Borradores activos del período</legend>
            {!periodo ? <p className="text-sm text-on-surface-variant">Selecciona un período para ver sus borradores.</p> : borradores.length === 0 ? <p className="text-sm text-on-surface-variant">No hay borradores activos disponibles en {trimestreNombre}.</p> : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-outline-variant p-2 dark:border-slate-700">
                {borradores.map((horario) => <label key={horario.idHorario} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-surface-container dark:hover:bg-slate-700"><input type="checkbox" checked={seleccion.includes(horario.idHorario)} onChange={() => alternarHorario(horario.idHorario)} className="mt-1 accent-emerald-700" /><span>{horarioResumen(horario)}</span></label>)}
              </div>
            )}
          </fieldset>
          <div className="rounded-xl bg-surface-container-low p-3 text-sm dark:bg-slate-900" aria-label="Vista previa de publicación">
            <h3 className="mb-1 font-semibold text-on-surface dark:text-slate-100">Antes de confirmar</h3>
            <p>Período: {trimestreNombre}</p>
            <p>Fecha y hora: {fechaLocal ? `${fechaLocal.replace('T', ' ')} (America/Bogota)` : 'Sin seleccionar'}</p>
            <ul className="mt-1 list-inside list-disc text-on-surface-variant dark:text-slate-300">
              {horariosSeleccionados.length ? horariosSeleccionados.map((horario) => <li key={horario.idHorario}>{horarioResumen(horario)}</li>) : <li>No hay horarios seleccionados.</li>}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!programacionActiva || !periodo || !fechaLocal || seleccion.length === 0 || ocupado} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50">{ocupado ? 'Guardando…' : reprogramando === null ? 'Confirmar y programar' : 'Aprobar nueva revisión'}</button>
            {reprogramando !== null && <button type="button" onClick={() => setReprogramando(null)} className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold" disabled={ocupado}>Salir de reprogramación</button>}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold text-on-surface dark:text-slate-100">Programaciones e historial</h2><p className="text-sm text-on-surface-variant">Estados consultados directamente al backend.</p></div><button type="button" onClick={() => void cargar()} disabled={cargando || ocupado} className="rounded-xl border border-outline px-3 py-2 text-sm font-semibold disabled:opacity-50">Actualizar</button></div>
        {cargando ? <p className="py-6 text-center text-sm text-on-surface-variant">Cargando programaciones…</p> : publicaciones.length === 0 ? <p className="py-6 text-center text-sm text-on-surface-variant">No hay publicaciones programadas. Los borradores siguen disponibles desde <Link className="font-semibold text-primary underline" to="/horarios/completos">Horarios completos</Link>.</p> : (
          <div className="space-y-3">
            {publicaciones.map((publicacion) => {
              const requiereRevision = publicacion.estado === 'revision_requerida'
              const permiteGestion = publicacion.estado === 'pendiente' || requiereRevision
              const periodoPub = trimestres.find((item) => item.idTrimestre === publicacion.idTrimestre)
              return <article key={publicacion.idPublicacion} className="rounded-xl border border-outline-variant p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-on-surface dark:text-slate-100">Publicación #{publicacion.idPublicacion}</h3><span title={`Estado backend: ${publicacion.estado}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estadoEstilo(publicacion.estado)}`}>{ETIQUETAS[publicacion.estado]}</span></div><p className="mt-1 text-sm text-on-surface-variant">{periodoPub?.nombre ?? `Período ${publicacion.idTrimestre}`} · revisión {publicacion.revision} · {publicacion.idHorarios.length} horario(s)</p><p className="text-sm text-on-surface-variant">Ejecución: {new Date(publicacion.fechaEjecucion).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })} (Bogotá)</p></div>
                  {permiteGestion && <div className="flex gap-2">{programacionActiva && <button type="button" onClick={() => iniciarReprogramacion(publicacion)} disabled={ocupado} className="rounded-lg border border-outline px-3 py-1.5 text-sm font-semibold">Reprogramar</button>}<button type="button" onClick={() => void cancelar(publicacion.idPublicacion)} disabled={ocupado} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300">Cancelar</button></div>}
                </div>
                {requiereRevision && <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">Una edición invalidó la aprobación. Revisa nuevamente el conjunto y programa una nueva revisión antes de publicar.</p>}
                {publicacion.resultado && <p className="mt-2 text-sm text-on-surface-variant">{publicacion.resultado}</p>}
                <ul className="mt-2 list-inside list-disc text-sm text-on-surface-variant dark:text-slate-300">{publicacion.idHorarios.map((idHorario) => { const horario = horarios.find((item) => item.idHorario === idHorario); return <li key={idHorario}>{horario ? horarioResumen(horario) : `Horario histórico #${idHorario}`}</li> })}</ul>
              </article>
            })}
          </div>
        )}
      </section>
      <p className="mt-4 text-xs text-on-surface-variant">Los avisos de publicación aparecen en el centro de notificaciones cuando el backend confirma el resultado; esta pantalla no crea notificaciones locales.</p>
    </AppShell>
  )
}
