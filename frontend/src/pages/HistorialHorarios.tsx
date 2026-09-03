import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiDelete, apiGet, apiPatch, ApiError } from '../services/api'
import type { DiaSemana, Horario, HorarioGuardado } from '../types/api'

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatearHora(hhmmss: string) {
  return hhmmss.slice(0, 5)
}

/**
 * Lista de horarios guardados desde `NuevoHorario.tsx` (tabla
 * `horarios_guardados`, ver ese archivo para por qué no es el módulo
 * `horarios` real todavía) — clic en uno para verlo completo en modo
 * solo lectura y, desde ahí, exportarlo a PDF con el mismo
 * `ExportarPdfButton` reutilizable que usa el editor.
 *
 * También lista las clases REALES (`GET /horarios/`, la tabla que de
 * verdad valida cruces) con opción de borrar una — útil para liberar un
 * horario de prueba sin tener que pedirlo por SQL. Pide confirmación
 * antes de borrar, igual que al eliminar un bloque en el editor.
 */
export function HistorialHorarios() {
  const [horarios, setHorarios] = useState<HorarioGuardado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)
  const [seleccionadoRealId, setSeleccionadoRealId] = useState<number | null>(null)

  const [horariosReales, setHorariosReales] = useState<Horario[] | null>(null)
  const [errorReales, setErrorReales] = useState<string | null>(null)
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)
  const [borrandoId, setBorrandoId] = useState<number | null>(null)

  const [confirmandoSnapshotId, setConfirmandoSnapshotId] = useState<number | null>(null)
  const [borrandoSnapshotId, setBorrandoSnapshotId] = useState<number | null>(null)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<number | null>(null)

  useEffect(() => {
    // Con "/" al final a propósito: sin él, FastAPI responde 307 hacia la
    // ruta con slash — en el backend desplegado (Railway, detrás de un
    // proxy TLS) ese redirect sale como http:// en vez de https://, y el
    // navegador lo bloquea por contenido mixto (bug reportado 2026-09-02:
    // en el desplegado de producción esta llamada nunca llegaba a responder).
    apiGet<HorarioGuardado[]>('/horarios-guardados/')
      .then(setHorarios)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial de horarios.'),
      )

    Promise.all([apiGet<Horario[]>('/horarios/'), apiGet<DiaSemana[]>('/dias-semana/')])
      .then(([lista, dias]) => {
        setHorariosReales(lista)
        setDiasPorId(Object.fromEntries(dias.map((d) => [d.idDia, d.nombreDia])))
      })
      .catch((err) =>
        setErrorReales(err instanceof ApiError ? err.message : 'No se pudieron cargar las clases guardadas.'),
      )
  }, [])

  async function confirmarEliminar(idHorario: number) {
    setBorrandoId(idHorario)
    try {
      await apiDelete(`/horarios/${idHorario}`)
      setHorariosReales((anterior) => anterior?.filter((h) => h.idHorario !== idHorario) ?? anterior)
      setConfirmandoId(null)
    } catch (err) {
      setErrorReales(err instanceof ApiError ? err.message : 'No se pudo borrar la clase.')
    } finally {
      setBorrandoId(null)
    }
  }

  async function cambiarEstado(idHorario: number, activo: boolean) {
    setCambiandoEstadoId(idHorario)
    try {
      const actualizado = await apiPatch<Horario>(`/horarios/${idHorario}/estado`, { activo })
      setHorariosReales((anterior) => anterior?.map((h) => (h.idHorario === idHorario ? actualizado : h)) ?? anterior)
    } catch (err) {
      setErrorReales(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado de la clase.')
    } finally {
      setCambiandoEstadoId(null)
    }
  }

  async function confirmarEliminarSnapshot(idHorarioGuardado: number) {
    setBorrandoSnapshotId(idHorarioGuardado)
    try {
      await apiDelete(`/horarios-guardados/${idHorarioGuardado}`)
      setHorarios((anterior) => anterior?.filter((h) => h.idHorarioGuardado !== idHorarioGuardado) ?? anterior)
      setConfirmandoSnapshotId(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar el horario.')
    } finally {
      setBorrandoSnapshotId(null)
    }
  }

  const seleccionado = horarios?.find((h) => h.idHorarioGuardado === seleccionadoId) ?? null
  const seleccionadoReal = horariosReales?.find((h) => h.idHorario === seleccionadoRealId) ?? null

  const cargando = !horarios && !error && !horariosReales && !errorReales
  const hayFilas = (horariosReales && horariosReales.length > 0) || (horarios && horarios.length > 0)

  // Más reciente primero — con fechaModificacion ya disponible, editar (o
  // activar/desactivar) una clase la sube al tope, como si acabara de
  // crearse. Copia del arreglo: sort() muta in place y horariosReales/
  // horarios siguen siendo el estado "fuente de verdad".
  const clasesOrdenadas = [...(horariosReales ?? [])].sort((a, b) => b.fechaModificacion.localeCompare(a.fechaModificacion))
  const snapshotsOrdenados = [...(horarios ?? [])].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))

  // Vista de "Horario completo": ya NO se dibuja desde el blob congelado
  // (`seleccionado.bloques`/`grid`, tal como quedó al guardarlo) sino con
  // los horarios reales vigentes vía `idsHorarios` — así se ven los
  // cambios de nombre/estado más recientes, y solo las clases que
  // pertenecen a ESTE horario, no a otro. Snapshots viejos (de antes de
  // que existiera `idsHorarios`, ver horario_guardado.py) no tienen ese
  // vínculo y caen al blob congelado como única opción.
  const idsHorariosSeleccionado = seleccionado?.idsHorarios ?? []
  const horariosDelSnapshot = (horariosReales ?? []).filter((h) => idsHorariosSeleccionado.includes(h.idHorario))
  const vistaSnapshotEnVivo = idsHorariosSeleccionado.length > 0 ? convertirHorariosAGrid(horariosDelSnapshot) : null

  const vistaClaseReal = seleccionadoReal ? convertirHorariosAGrid([seleccionadoReal]) : null

  return (
    <AppShell activo="Historial de horarios">
      <div className="mb-6 print:hidden">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Historial de horarios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Todo lo guardado desde el editor — clases individuales y horarios completos, en la misma lista.
          Borrar una clase libera ese instructor/ambiente/ficha/resultado para volver a programarlo.
        </p>
      </div>

      {!seleccionado && !seleccionadoReal && (
        <div className="print:hidden">
          {(error || errorReales) && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ?? errorReales}
            </p>
          )}

          {cargando && <p className="text-sm text-slate-500">Cargando…</p>}

          {!cargando && !hayFilas && (
            <p className="text-sm text-slate-500">
              Todavía no se ha guardado ningún horario — créalo desde "Horarios" en el menú.
            </p>
          )}

          {hayFilas && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Ficha</th>
                    <th scope="col" className="px-4 py-3">Detalle</th>
                    <th scope="col" className="px-4 py-3">Creado por</th>
                    <th scope="col" className="px-4 py-3">Fecha</th>
                    <th scope="col" className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {clasesOrdenadas.map((h) => (
                    <tr key={`real-${h.idHorario}`} className={`hover:bg-slate-50 dark:hover:bg-slate-700/60 ${h.activo ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {h.fichaCodigo ?? '—'}
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          Clase
                        </span>
                        {!h.activo && (
                          <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {h.instructorNombre ?? '—'} · {h.ambienteNombre ?? '—'} ·{' '}
                        {h.dias.map((d) => diasPorId[d] ?? d).join(', ')} · {formatearHora(h.horaInicio)}–
                        {formatearHora(h.horaFin)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">—</td>
                      <td className="px-4 py-3 text-slate-500">{formatearFecha(h.fechaModificacion)}</td>
                      <td className="px-4 py-3 text-right">
                        {confirmandoId === h.idHorario ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-slate-500">¿Borrar?</span>
                            <button
                              type="button"
                              onClick={() => void confirmarEliminar(h.idHorario)}
                              disabled={borrandoId === h.idHorario}
                              aria-label={`Confirmar borrar clase de ${h.fichaCodigo}`}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {borrandoId === h.idHorario ? 'Borrando…' : 'Sí, borrar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoId(null)}
                              aria-label={`Cancelar borrar clase de ${h.fichaCodigo}`}
                              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSeleccionadoRealId(h.idHorario)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              title="Reabrir en el creador de horarios — próximo paso del rediseño, todavía no implementado."
                              disabled
                              className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500"
                            >
                              Modificar
                            </button>
                            <button
                              type="button"
                              onClick={() => void cambiarEstado(h.idHorario, !h.activo)}
                              disabled={cambiandoEstadoId === h.idHorario}
                              aria-label={`${h.activo ? 'Desactivar' : 'Activar'} clase de ${h.fichaCodigo}`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
                            >
                              {cambiandoEstadoId === h.idHorario ? '…' : h.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoId(h.idHorario)}
                              aria-label={`Borrar clase de ${h.fichaCodigo}`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600"
                            >
                              Borrar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {snapshotsOrdenados.map((h) => (
                    <tr key={`snap-${h.idHorarioGuardado}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {h.ficha}
                        <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                          Horario completo
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {h.bloques.length} bloque{h.bloques.length === 1 ? '' : 's'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{h.creadorNombre ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatearFecha(h.fechaCreacion)}</td>
                      <td className="px-4 py-3 text-right">
                        {confirmandoSnapshotId === h.idHorarioGuardado ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-slate-500">¿Borrar?</span>
                            <button
                              type="button"
                              onClick={() => void confirmarEliminarSnapshot(h.idHorarioGuardado)}
                              disabled={borrandoSnapshotId === h.idHorarioGuardado}
                              aria-label={`Confirmar borrar horario de ${h.ficha}`}
                              className="rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {borrandoSnapshotId === h.idHorarioGuardado ? 'Borrando…' : 'Sí, borrar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoSnapshotId(null)}
                              aria-label={`Cancelar borrar horario de ${h.ficha}`}
                              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSeleccionadoId(h.idHorarioGuardado)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Ver horario
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoSnapshotId(h.idHorarioGuardado)}
                              aria-label={`Borrar horario de ${h.ficha}`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600"
                            >
                              Borrar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {seleccionado && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={() => setSeleccionadoId(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver al historial
            </button>
            <ExportarPdfButton />
          </div>

          <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
            <Campo etiqueta="Ficha">{seleccionado.ficha}</Campo>
            <Campo etiqueta="Aprendices en formación">{seleccionado.aprendices ?? '—'}</Campo>
            <Campo etiqueta="Horas asignadas trimestre">{seleccionado.horasTrimestre ?? '—'}</Campo>
            <Campo etiqueta="Inicio / fin de trimestre">
              {seleccionado.fechaInicio ?? '—'} – {seleccionado.fechaFin ?? '—'}
            </Campo>
          </div>

          {vistaSnapshotEnVivo ? (
            <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <GridHorario
                bloques={vistaSnapshotEnVivo.bloques}
                grid={vistaSnapshotEnVivo.grid}
                hayBloqueActivo={false}
                soloLectura
              />
            </div>
          ) : (
            <>
              <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Este horario se guardó antes de vincularse a las clases reales — se muestra tal como quedó al
                crearlo, no refleja cambios posteriores.
              </p>
              <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <GridHorario
                  bloques={seleccionado.bloques}
                  grid={seleccionado.grid}
                  hayBloqueActivo={false}
                  soloLectura
                />
              </div>
            </>
          )}
        </div>
      )}

      {seleccionadoReal && (
        <div>
          <div className="mb-4 print:hidden">
            <button
              type="button"
              onClick={() => setSeleccionadoRealId(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver al historial
            </button>
          </div>

          <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
            <Campo etiqueta="Ficha">{seleccionadoReal.fichaCodigo ?? '—'}</Campo>
            <Campo etiqueta="Instructor">{seleccionadoReal.instructorNombre ?? '—'}</Campo>
            <Campo etiqueta="Ambiente">{seleccionadoReal.ambienteNombre ?? '—'}</Campo>
            <Campo etiqueta="Resultado de aprendizaje">
              {[seleccionadoReal.resultadoCodigo, seleccionadoReal.resultadoDescripcion].filter(Boolean).join(' — ') || '—'}
            </Campo>
          </div>

          {vistaClaseReal && vistaClaseReal.bloques.length > 0 ? (
            <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <GridHorario
                bloques={vistaClaseReal.bloques}
                grid={vistaClaseReal.grid}
                hayBloqueActivo={false}
                soloLectura
              />
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {formatearHora(seleccionadoReal.horaInicio)}–{formatearHora(seleccionadoReal.horaFin)} no coincide con
              ninguno de los 6 bloques institucionales, así que no se puede dibujar en la grilla.
            </p>
          )}
        </div>
      )}
    </AppShell>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{etiqueta}</span>
      <p className="text-sm text-slate-900 dark:text-slate-100">{children}</p>
    </div>
  )
}
