import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
 * Backlog de horarios completos guardados desde `NuevoHorario.tsx` (tabla
 * `horarios_guardados`) — la lista principal es solo eso, un horario
 * completo por fila; las clases individuales (`GET /horarios/`, la tabla
 * que de verdad valida cruces) NO se listan sueltas acá — se ven solo
 * dentro del horario al que pertenecen (pedido 2026-09-03: verlas
 * mezcladas en la misma lista se sentía desordenado). Un horario real que
 * no pertenece a ningún snapshot (por ejemplo, creado directo por API) no
 * aparece acá — sigue siendo visible y manejable desde "Horarios
 * completos" (`/horarios/completos`), que sí lista cada clase suelta.
 *
 * Clic en un horario para verlo completo (con datos vigentes, no
 * congelados — ver `vistaSnapshotEnVivo` más abajo), exportarlo a PDF,
 * reabrirlo en el creador ("Modificar") o gestionar sus clases una por
 * una (activar/desactivar/borrar).
 */
export function HistorialHorarios() {
  const [horarios, setHorarios] = useState<HorarioGuardado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)

  const [horariosReales, setHorariosReales] = useState<Horario[] | null>(null)
  const [errorReales, setErrorReales] = useState<string | null>(null)
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)
  const [borrandoId, setBorrandoId] = useState<number | null>(null)

  const [confirmandoSnapshotId, setConfirmandoSnapshotId] = useState<number | null>(null)
  const [borrandoSnapshotId, setBorrandoSnapshotId] = useState<number | null>(null)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<number | null>(null)
  const [publicando, setPublicando] = useState(false)

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

  async function publicarHorarioCompleto(publicado: boolean) {
    if (horariosDelSnapshot.length === 0) return
    setPublicando(true)
    try {
      const actualizados = await Promise.all(
        horariosDelSnapshot.map((h) => apiPatch<Horario>(`/horarios/${h.idHorario}/estado`, { publicado })),
      )
      const porId = new Map(actualizados.map((h) => [h.idHorario, h]))
      setHorariosReales((anterior) => anterior?.map((h) => porId.get(h.idHorario) ?? h) ?? anterior)
    } catch (err) {
      setErrorReales(err instanceof ApiError ? err.message : 'No se pudo publicar el horario.')
    } finally {
      setPublicando(false)
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

  const cargando = !horarios && !error && !horariosReales && !errorReales
  const hayFilas = horarios && horarios.length > 0

  // Más reciente primero — con horarios_guardados no hay fechaModificacion
  // propia (es un snapshot, no algo que se edite in-place), así que el
  // orden es por fechaCreacion; "Modificar" borra el snapshot viejo y crea
  // uno nuevo (ver NuevoHorario.tsx), así que editar sí sube uno al tope,
  // igual que pidió, solo que por la vía de "es uno nuevo de verdad".
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

  // "Publicado" es a nivel de horario completo, no por clase suelta — si
  // alguna de sus clases todavía no está publicada, el horario como
  // conjunto no cuenta como publicado (el instructor vería un horario
  // incompleto en "Mi horario", que es justo lo que se quiere evitar).
  const horarioCompletoPublicado = horariosDelSnapshot.length > 0 && horariosDelSnapshot.every((h) => h.publicado)

  return (
    <AppShell activo="Historial de horarios">
      <div className="mb-6 print:hidden">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Historial de horarios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Horarios completos guardados desde el creador. Abre uno para ver sus clases, modificarlo,
          exportarlo a PDF o activar/desactivar/borrar una clase puntual.
        </p>
      </div>

      {(error || errorReales) && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {error ?? errorReales}
        </p>
      )}

      {!seleccionado && (
        <div className="print:hidden">
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
                            <Link
                              to={`/horarios/nuevo?editar=${h.idHorarioGuardado}`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              Modificar
                            </Link>
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSeleccionadoId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Volver al historial
              </button>
              {horariosDelSnapshot.length > 0 && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    horarioCompletoPublicado
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {horarioCompletoPublicado ? 'Publicado' : 'Borrador'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {horariosDelSnapshot.length > 0 && (
                <button
                  type="button"
                  onClick={() => void publicarHorarioCompleto(!horarioCompletoPublicado)}
                  disabled={publicando}
                  title={
                    horarioCompletoPublicado
                      ? 'Deja de mostrarse en "Mi horario" para el instructor'
                      : 'Publica todas las clases de este horario — a partir de ahora el instructor las ve en "Mi horario"'
                  }
                  className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publicando ? 'Guardando…' : horarioCompletoPublicado ? 'Despublicar' : 'Publicar'}
                </button>
              )}
              <Link
                to={`/horarios/nuevo?editar=${seleccionado.idHorarioGuardado}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Modificar
              </Link>
              <ExportarPdfButton />
            </div>
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
            <div className="mb-6 min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
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
              <div className="mb-6 min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <GridHorario
                  bloques={seleccionado.bloques}
                  grid={seleccionado.grid}
                  hayBloqueActivo={false}
                  soloLectura
                />
              </div>
            </>
          )}

          {horariosDelSnapshot.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 print:hidden dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Clases de este horario</p>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {horariosDelSnapshot.map((h) => (
                  <li key={h.idHorario} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${h.activo ? '' : 'opacity-60'}`}>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {h.instructorNombre ?? '—'} · {h.ambienteNombre ?? '—'} ·{' '}
                      {h.dias.map((d) => diasPorId[d] ?? d).join(', ')} · {formatearHora(h.horaInicio)}–{formatearHora(h.horaFin)}
                      {!h.activo && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Inactivo
                        </span>
                      )}
                      {!h.publicado && (
                        <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          Borrador
                        </span>
                      )}
                    </div>
                    {confirmandoId === h.idHorario ? (
                      <div className="flex items-center gap-1.5">
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
                      <div className="flex gap-2">
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
                  </li>
                ))}
              </ul>
            </div>
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
