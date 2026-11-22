import { useEffect, useState } from 'react'
import { apiGet, apiPut, ApiError } from '../../services/api'
import type { Ambiente, DiaSemana, Horario, HorarioCreate, Jornada, ResultadoAprendizaje, Usuario } from '../../types/api'

interface Props {
  horario: Horario
  diasSemana: DiaSemana[]
  onGuardar: (actualizado: Horario) => void
  onCancelar: () => void
}

/** Edición de clases no vinculadas a un snapshot del constructor. */
export function EditarBloqueImportado({ horario, diasSemana, onGuardar, onCancelar }: Props) {
  const [instructores, setInstructores] = useState<Usuario[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [resultados, setResultados] = useState<ResultadoAprendizaje[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<HorarioCreate>({
    horaInicio: horario.horaInicio,
    horaFin: horario.horaFin,
    idJornada: horario.idJornada,
    idTrimestre: horario.idTrimestre,
    idAmbiente: horario.idAmbiente,
    idInstructor: horario.idInstructor,
    idFicha: horario.idFicha,
    idResultado: horario.idResultado,
    dias: [...horario.dias],
    publicado: horario.publicado,
  })

  useEffect(() => {
    let activo = true
    Promise.all([
      apiGet<Usuario[]>('/usuarios/instructores'),
      apiGet<Ambiente[]>('/ambientes'),
      apiGet<ResultadoAprendizaje[]>('/resultados-aprendizaje/'),
      apiGet<Jornada[]>('/jornadas/'),
    ]).then(([usuarios, listaAmbientes, listaResultados, listaJornadas]) => {
      if (!activo) return
      setInstructores(usuarios)
      setAmbientes(listaAmbientes)
      setResultados(listaResultados)
      setJornadas(listaJornadas)
    }).catch(() => {
      if (activo) setError('No se pudieron cargar las opciones de edición.')
    }).finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  async function guardar() {
    if (!borrador.dias.length) { setError('Selecciona al menos un día.'); return }
    if (borrador.horaFin <= borrador.horaInicio) { setError('La hora de fin debe ser posterior a la de inicio.'); return }
    setError(null)
    setGuardando(true)
    try {
      const actualizado = await apiPut<Horario>(`/horarios/${horario.idHorario}`, { ...borrador, publicado: horario.publicado })
      onGuardar(actualizado)
    } catch (err) {
      const detalle = err instanceof ApiError ? err.detail : null
      const mensajes = detalle && typeof detalle === 'object' && 'mensajes' in detalle
        ? (detalle as { mensajes?: string[] }).mensajes : null
      setError(mensajes?.join(' ') || (err instanceof ApiError ? err.message : 'No se pudo modificar la clase.'))
    } finally {
      setGuardando(false)
    }
  }

  const inputClass = 'mt-1 block w-full rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface'
  return (
    <section aria-label={`Modificar bloque #${horario.idHorario}`} className="mt-4 rounded-xl border border-primary/30 bg-primary-container/20 p-4">
      <h3 className="mb-1 font-semibold text-on-surface">Modificar bloque #{horario.idHorario}</h3>
      <p className="mb-4 text-sm text-on-surface-variant">Se validarán los cruces antes de guardar. Se conserva el estado de publicación.</p>
      {cargando && <p role="status" className="mb-3 text-sm">Cargando opciones…</p>}
      {error && <p role="alert" className="mb-3 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-on-surface-variant">Instructor
          <select aria-label="Instructor del bloque" disabled={cargando} value={borrador.idInstructor} onChange={(e) => setBorrador((v) => ({ ...v, idInstructor: e.target.value }))} className={inputClass}>
            {!instructores.some((u) => u.idUsuario === borrador.idInstructor) && <option value={borrador.idInstructor}>{horario.instructorNombre ?? 'Instructor actual'}</option>}
            {instructores.map((u) => <option key={u.idUsuario} value={u.idUsuario}>{u.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-on-surface-variant">Ambiente
          <select aria-label="Ambiente del bloque" disabled={cargando} value={borrador.idAmbiente} onChange={(e) => setBorrador((v) => ({ ...v, idAmbiente: Number(e.target.value) }))} className={inputClass}>
            {!ambientes.some((a) => a.idAmbiente === borrador.idAmbiente) && <option value={borrador.idAmbiente}>{horario.ambienteNombre ?? 'Ambiente actual'}</option>}
            {ambientes.map((a) => <option key={a.idAmbiente} value={a.idAmbiente}>{a.nombreAmbiente}</option>)}
          </select>
        </label>
        <label className="text-xs text-on-surface-variant">Resultado de aprendizaje
          <select aria-label="Resultado del bloque" disabled={cargando} value={borrador.idResultado} onChange={(e) => setBorrador((v) => ({ ...v, idResultado: Number(e.target.value) }))} className={inputClass}>
            {!resultados.some((r) => r.idResultado === borrador.idResultado) && <option value={borrador.idResultado}>{horario.resultadoDescripcion ?? 'Resultado actual'}</option>}
            {resultados.map((r) => <option key={r.idResultado} value={r.idResultado}>{r.codigo ? `${r.codigo} · ` : ''}{r.descripcion}</option>)}
          </select>
        </label>
        <label className="text-xs text-on-surface-variant">Jornada
          <select aria-label="Jornada del bloque" disabled={cargando} value={borrador.idJornada} onChange={(e) => setBorrador((v) => ({ ...v, idJornada: Number(e.target.value) }))} className={inputClass}>
            {!jornadas.some((j) => j.idJornada === borrador.idJornada) && <option value={borrador.idJornada}>Jornada actual</option>}
            {jornadas.map((j) => <option key={j.idJornada} value={j.idJornada}>{j.nombreJornada}</option>)}
          </select>
        </label>
        <label className="text-xs text-on-surface-variant">Desde
          <input type="time" value={borrador.horaInicio.slice(0, 5)} onChange={(e) => setBorrador((v) => ({ ...v, horaInicio: `${e.target.value}:00` }))} className={inputClass} />
        </label>
        <label className="text-xs text-on-surface-variant">Hasta
          <input type="time" value={borrador.horaFin.slice(0, 5)} onChange={(e) => setBorrador((v) => ({ ...v, horaFin: `${e.target.value}:00` }))} className={inputClass} />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-2 text-xs text-on-surface-variant">Días de clase</legend>
        <div className="flex flex-wrap gap-2">
          {diasSemana.map((dia) => <label key={dia.idDia} className="inline-flex items-center gap-2 rounded-lg border border-outline bg-surface-container-lowest px-3 py-2 text-xs text-on-surface">
            <input type="checkbox" checked={borrador.dias.includes(dia.idDia)} onChange={(e) => setBorrador((v) => ({ ...v, dias: e.target.checked ? [...v.dias, dia.idDia] : v.dias.filter((d) => d !== dia.idDia) }))} />
            {dia.nombreDia}
          </label>)}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-lg border border-outline px-4 py-2 text-sm">Cancelar</button>
        <button type="button" disabled={guardando || cargando || Boolean(error && error.startsWith('No se pudieron cargar'))} onClick={() => void guardar()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </section>
  )
}
