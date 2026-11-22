import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { EditarBloqueImportado } from '../components/horarios/EditarBloqueImportado'
import { GridHorario } from '../components/horario/GridHorario'
import { GridAsistente } from '../components/horario/GridAsistente'
import { celdasDesdeHorarios } from '../components/horario/celdasAsistente'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiDelete, apiGet, apiPatch, ApiError } from '../services/api'
import type { DiaSemana, Horario, HorarioGuardado, Trimestre } from '../types/api'

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatearHora(hhmmss: string) {
  return hhmmss.slice(0, 5)
}

/** Historial de horarios completos y bloques creados desde el asistente. */
export function HistorialHorarios() {
  const [searchParams, setSearchParams] = useSearchParams()
  const idHorarioEnlace = Number(searchParams.get('idHorario'))
  const [horarios, setHorarios] = useState<HorarioGuardado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)
  const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState<string | null>(null)

  const [horariosReales, setHorariosReales] = useState<Horario[] | null>(null)
  const [errorReales, setErrorReales] = useState<string | null>(null)
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([])
  const [editandoBloqueId, setEditandoBloqueId] = useState<number | null>(null)
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
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
        setDiasSemana(dias)
        setDiasPorId(Object.fromEntries(dias.map((d) => [d.idDia, d.nombreDia])))
      })
      .catch((err) =>
        setErrorReales(err instanceof ApiError ? err.message : 'No se pudieron cargar las clases guardadas.'),
      )
    apiGet<Trimestre[]>('/trimestres/').then(setTrimestres).catch(() => {})
  }, [])

  async function confirmarEliminar(idHorario: number) {
    setBorrandoId(idHorario)
    try {
      await apiDelete(`/horarios/${idHorario}`)
      setHorariosReales((anterior) => anterior?.filter((h) => h.idHorario !== idHorario) ?? anterior)
      setConfirmandoId(null)
      setEditandoBloqueId(null)
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

  const idsVinculados = new Set((horarios ?? []).flatMap((h) => h.idsHorarios ?? []))
  const gruposMap = new Map<string, Horario[]>()
  for (const horario of horariosReales ?? []) {
    if (idsVinculados.has(horario.idHorario)) continue
    const clave = `${horario.idFicha}:${horario.idTrimestre}`
    gruposMap.set(clave, [...(gruposMap.get(clave) ?? []), horario])
  }
  const gruposImportados = [...gruposMap].map(([clave, bloques]) => ({
    clave,
    bloques,
    ficha: bloques[0].fichaCodigo ?? `Ficha ${bloques[0].idFicha}`,
    fecha: bloques.reduce((reciente, bloque) => bloque.fechaCreacion > reciente ? bloque.fechaCreacion : reciente, bloques[0].fechaCreacion),
  })).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const grupoSeleccionado = gruposImportados.find((grupo) => grupo.clave === grupoSeleccionadoId) ?? null
  const nombrePeriodo = (id: number) => trimestres.find((trimestre) => trimestre.idTrimestre === id)?.nombre ?? `Período ${id}`

  // Enlace desde Gestionar horarios: abre el conjunto al que pertenece el
  // bloque, sin confundir su ID con el ID del snapshot.
  useEffect(() => {
    if (!Number.isInteger(idHorarioEnlace) || idHorarioEnlace <= 0 || !horarios || !horariosReales) return
    const snapshot = horarios.find((item) => item.idsHorarios?.includes(idHorarioEnlace))
    if (snapshot) {
      setSeleccionadoId(snapshot.idHorarioGuardado)
      setGrupoSeleccionadoId(null)
      return
    }
    const bloque = horariosReales.find((item) => item.idHorario === idHorarioEnlace)
    if (bloque) {
      setGrupoSeleccionadoId(`${bloque.idFicha}:${bloque.idTrimestre}`)
      setSeleccionadoId(null)
    }
  }, [idHorarioEnlace, horarios, horariosReales])

  function volverAlHistorial() {
    setSeleccionadoId(null)
    setGrupoSeleccionadoId(null)
    setEditandoBloqueId(null)
    if (searchParams.has('idHorario')) {
      const siguientes = new URLSearchParams(searchParams)
      siguientes.delete('idHorario')
      setSearchParams(siguientes, { replace: true })
    }
  }

  async function publicarGrupo(bloques: Horario[], publicado: boolean) {
    if (bloques.length === 0) return
    setPublicando(true)
    try {
      // Mismo endpoint existente; se aplica al conjunto de una ficha/período.
      const actualizados = await Promise.all(
        bloques.map((bloque) => apiPatch<Horario>(`/horarios/${bloque.idHorario}/estado`, { publicado })),
      )
      const porId = new Map(actualizados.map((bloque) => [bloque.idHorario, bloque]))
      setHorariosReales((anterior) => anterior?.map((bloque) => porId.get(bloque.idHorario) ?? bloque) ?? anterior)
    } catch (err) {
      // Volver a consultar el estado real evita mostrar información obsoleta
      // si el servidor alcanzó a aplicar algunos cambios.
      const actuales = await apiGet<Horario[]>('/horarios/').catch(() => null)
      if (actuales) setHorariosReales(actuales)
      setErrorReales(err instanceof ApiError ? err.message : 'No se pudo actualizar la publicación de todos los bloques.')
    } finally {
      setPublicando(false)
    }
  }

  const cargando = !horarios && !error && !horariosReales && !errorReales
  const hayFilas = (horarios?.length ?? 0) > 0 || gruposImportados.length > 0

  // Más reciente primero — con horarios_guardados no hay fechaModificacion
  // propia (es un snapshot, no algo que se edite in-place), así que el
  // orden es por fechaCreacion; "Modificar" borra el snapshot viejo y crea
  // uno nuevo (ver NuevoHorario.tsx), así que editar sí sube uno al tope,
  // igual que pidió, solo que por la vía de "es uno nuevo de verdad".
  const snapshotsOrdenados = [...(horarios ?? [])].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))

  // Una fila por horario, no una fila por bloque. Los snapshots del creador
  // mantienen su identidad; las asignaciones sin snapshot forman un horario
  // operativo por ficha y período, independientemente de cuántas clases haya.
  const entradasHistorial = [
    ...snapshotsOrdenados.map((snapshot) => {
      const vinculados = (horariosReales ?? []).filter((h) => snapshot.idsHorarios?.includes(h.idHorario))
      const idPeriodo = vinculados[0]?.idTrimestre
      return {
        tipo: 'creador' as const,
        clave: `creador:${snapshot.idHorarioGuardado}`,
        ficha: snapshot.ficha,
        periodo: idPeriodo !== undefined ? nombrePeriodo(idPeriodo) : 'Sin período vinculado',
        cantidad: vinculados.length || snapshot.bloques.length,
        borradores: vinculados.filter((h) => !h.publicado).length,
        tieneEstado: vinculados.length > 0,
        programa: snapshot.programaNombre ?? 'Sin programa vinculado',
        fecha: snapshot.fechaCreacion,
        snapshot,
      }
    }),
    ...gruposImportados.map((grupo) => ({
      tipo: 'importado' as const,
      clave: `importado:${grupo.clave}`,
      ficha: grupo.ficha,
      periodo: nombrePeriodo(grupo.bloques[0].idTrimestre),
      cantidad: grupo.bloques.length,
      borradores: grupo.bloques.filter((h) => !h.publicado).length,
      tieneEstado: grupo.bloques.length > 0,
      programa: 'Horario de ficha',
      fecha: grupo.fecha,
      grupo,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))


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
      <header className="mb-8 max-w-3xl print:hidden">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">Programación académica</p>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Historial de horarios</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Consulta los horarios por ficha y período. Abre uno para revisar su distribución semanal, modificar asignaciones o administrar su publicación.
        </p>
      </header>

      {(error || errorReales) && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 print:hidden">
          {error ?? errorReales}
        </p>
      )}

      {!seleccionado && !grupoSeleccionado && (
        <div className="print:hidden">
          {cargando && <p className="py-12 text-center text-sm text-on-surface-variant">Cargando…</p>}

          {!cargando && !hayFilas && (
            <p className="text-sm text-on-surface-variant">
              Todavía no se ha guardado ningún horario.
            </p>
          )}

          {entradasHistorial.length > 0 && (
            <section aria-label="Horarios por ficha y período">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Horarios guardados</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">Un registro por horario. Las clases se consultan dentro de cada uno.</p>
                </div>
                <span className="text-xs font-medium tabular-nums text-on-surface-variant">{entradasHistorial.length} horario{entradasHistorial.length === 1 ? '' : 's'}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-outline-variant bg-surface-container-low text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    <tr>
                      <th scope="col" className="px-4 py-3">Ficha</th>
                      <th scope="col" className="px-4 py-3">Período académico</th>
                      <th scope="col" className="px-4 py-3">Estado</th>
                      <th scope="col" className="px-4 py-3">Clases</th>
                      <th scope="col" className="px-4 py-3">Último guardado</th>
                      <th scope="col" className="px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {entradasHistorial.map((entrada) => (
                      <tr key={entrada.clave} className="transition-colors hover:bg-surface-container-low/60">
                        <td className="px-4 py-4">
                          <div className="font-semibold tracking-tight text-on-surface">{entrada.ficha}</div>
                          <div className="mt-1 max-w-64 truncate text-xs text-on-surface-variant" title={entrada.tipo === 'creador' ? entrada.programa : 'Importado / clases independientes'}>{entrada.tipo === 'creador' ? entrada.programa : 'Importado / clases independientes'}</div>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{entrada.periodo}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${!entrada.tieneEstado ? 'bg-surface-container text-on-surface-variant' : entrada.borradores > 0 ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'}`}>
                            {!entrada.tieneEstado ? 'Sin estado verificable' : entrada.borradores > 0 ? `${entrada.borradores} sin publicar` : 'Publicado'}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium tabular-nums text-on-surface">{entrada.cantidad}</td>
                        <td className="px-4 py-4 text-xs tabular-nums text-on-surface-variant">{formatearFecha(entrada.fecha)}</td>
                        <td className="px-4 py-4">
                          {entrada.tipo === 'creador' ? (
                            confirmandoSnapshotId === entrada.snapshot.idHorarioGuardado ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-on-surface-variant">¿Borrar horario?</span>
                                <button type="button" disabled={borrandoSnapshotId === entrada.snapshot.idHorarioGuardado} onClick={() => void confirmarEliminarSnapshot(entrada.snapshot.idHorarioGuardado)} aria-label={`Confirmar borrar horario de ${entrada.ficha}`} className="rounded-lg bg-error px-3 py-2 text-xs font-semibold text-on-primary">Confirmar</button>
                                <button type="button" onClick={() => setConfirmandoSnapshotId(null)} aria-label={`Cancelar borrar horario de ${entrada.ficha}`} className="rounded-lg border border-outline px-3 py-2 text-xs">Cancelar</button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => { setSeleccionadoId(entrada.snapshot.idHorarioGuardado); setGrupoSeleccionadoId(null) }} className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-on-primary hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Ver horario</button>
                                <Link to={`/horarios/nuevo?editar=${entrada.snapshot.idHorarioGuardado}`} className="inline-flex min-h-9 items-center rounded-md border border-outline px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Modificar</Link>
                                <button type="button" onClick={() => setConfirmandoSnapshotId(entrada.snapshot.idHorarioGuardado)} aria-label={`Borrar horario de ${entrada.ficha}`} className="inline-flex min-h-9 items-center rounded-md px-3 py-2 text-xs text-error hover:bg-error-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error">Borrar</button>
                              </div>
                            )
                          ) : (
                            <button type="button" onClick={() => { setGrupoSeleccionadoId(entrada.grupo.clave); setSeleccionadoId(null) }} aria-label={`Ver horario de ${entrada.ficha}`} className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-on-primary hover:bg-on-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Ver horario</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {grupoSeleccionado && (
        <section aria-label={`Horario de ${grupoSeleccionado.ficha}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <button type="button" onClick={volverAlHistorial} className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface">← Volver al historial</button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void publicarGrupo(grupoSeleccionado.bloques, !grupoSeleccionado.bloques.every((bloque) => bloque.publicado))}
                disabled={publicando}
                className="rounded-xl border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60"
              >
                {publicando ? 'Guardando…' : grupoSeleccionado.bloques.every((bloque) => bloque.publicado) ? 'Despublicar horario' : 'Publicar horario'}
              </button>
              <ExportarPdfButton />
            </div>
          </div>
          <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <h2 className="text-lg font-semibold text-on-surface">Horario de la ficha {grupoSeleccionado.ficha}</h2>
            <p className="text-sm text-on-surface-variant">{grupoSeleccionado.bloques.length} bloque{grupoSeleccionado.bloques.length === 1 ? '' : 's'} guardado{grupoSeleccionado.bloques.length === 1 ? '' : 's'} · {nombrePeriodo(grupoSeleccionado.bloques[0].idTrimestre)}</p>
          </div>
          <div className="mb-4 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><div className="min-w-[760px]"><GridAsistente celdas={celdasDesdeHorarios(grupoSeleccionado.bloques)} soloFranjasOcupadas /></div></div>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 print:hidden">
            <h3 className="mb-2 font-semibold text-on-surface">Clases de este horario</h3>
            <p className="mb-3 text-sm text-on-surface-variant">Este horario contiene asignaciones del cargador o clases individuales, agrupadas por ficha y período. Puedes modificar o borrar clases individuales y administrar su publicación aquí. Para añadir asignaciones, abre el constructor con esta ficha seleccionada.</p>
            <Link to={`/horarios/nuevo?idFicha=${grupoSeleccionado.bloques[0].idFicha}`} className="mb-3 inline-flex rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-on-surface hover:bg-surface">Añadir asignaciones en el constructor</Link>
            <ul className="divide-y divide-outline-variant">{grupoSeleccionado.bloques.map((bloque) => <li key={bloque.idHorario} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div><p className="font-semibold text-on-surface">{bloque.resultadoDescripcion ?? bloque.resultadoCodigo ?? `Bloque #${bloque.idHorario}`}</p><p className="text-on-surface-variant">{bloque.dias.map((dia) => diasPorId[dia] ?? dia).join(', ')} · {formatearHora(bloque.horaInicio)}–{formatearHora(bloque.horaFin)} · {bloque.instructorNombre ?? 'Sin instructor'} · {bloque.publicado ? 'Publicado' : 'Borrador'}</p></div>
              <div className="flex items-center gap-2">
                <Link to={`/horarios/completos?idHorario=${bloque.idHorario}`} className="rounded-xl border border-outline px-3 py-2 font-semibold text-on-surface hover:bg-surface">Ver detalle</Link>
                <button type="button" onClick={() => setEditandoBloqueId((actual) => actual === bloque.idHorario ? null : bloque.idHorario)} className="rounded-xl border border-outline px-3 py-2 font-semibold text-on-surface">Modificar bloque</button>
                {confirmandoId === bloque.idHorario ? (
                  <>
                    <button type="button" disabled={borrandoId === bloque.idHorario} onClick={() => void confirmarEliminar(bloque.idHorario)} className="rounded-xl bg-error px-3 py-2 font-semibold text-on-primary">Confirmar borrar</button>
                    <button type="button" onClick={() => setConfirmandoId(null)} className="rounded-xl border border-outline px-3 py-2">Cancelar</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmandoId(bloque.idHorario)} className="rounded-xl border border-outline px-3 py-2 font-semibold text-error">Borrar bloque</button>
                )}
              </div>
              {editandoBloqueId === bloque.idHorario && (
                <EditarBloqueImportado
                  horario={bloque}
                  diasSemana={diasSemana}
                  onCancelar={() => setEditandoBloqueId(null)}
                  onGuardar={(actualizado) => {
                    setHorariosReales((anterior) => anterior?.map((item) => item.idHorario === actualizado.idHorario ? actualizado : item) ?? anterior)
                    setEditandoBloqueId(null)
                  }}
                />
              )}
            </li>)}</ul>
          </div>
        </section>
      )}

      {seleccionado && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={volverAlHistorial}
                className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                ← Volver al historial
              </button>
              {horariosDelSnapshot.length > 0 && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    horarioCompletoPublicado
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-surface-container text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'
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
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publicando ? 'Guardando…' : horarioCompletoPublicado ? 'Despublicar' : 'Publicar'}
                </button>
              )}
              <Link
                to={`/horarios/nuevo?editar=${seleccionado.idHorarioGuardado}`}
                className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Modificar
              </Link>
              <ExportarPdfButton />
            </div>
          </div>

          <div className="mb-6 grid gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
            <Campo etiqueta="Ficha">{seleccionado.ficha}</Campo>
            <Campo etiqueta="Aprendices en formación">{seleccionado.aprendices ?? '—'}</Campo>
            <Campo etiqueta="Horas asignadas del período académico">{seleccionado.horasTrimestre ?? '—'}</Campo>
            <Campo etiqueta="Inicio / fin del período académico">
              {seleccionado.fechaInicio ?? '—'} – {seleccionado.fechaFin ?? '—'}
            </Campo>
          </div>

          {vistaSnapshotEnVivo ? (
            <div className="mb-6 min-w-0 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
              <GridHorario
                bloques={vistaSnapshotEnVivo.bloques}
                grid={vistaSnapshotEnVivo.grid}
                hayBloqueActivo={false}
                soloLectura
              />
            </div>
          ) : (
            <>
              <p className="mb-3 rounded-xl bg-surface px-3 py-2 text-xs text-on-surface-variant dark:bg-slate-800 dark:text-slate-400">
                Este horario se guardó antes de vincularse a las clases reales — se muestra tal como quedó al
                crearlo, no refleja cambios posteriores.
              </p>
              <div className="mb-6 min-w-0 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
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
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 print:hidden dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-3 text-sm font-semibold text-on-surface dark:text-slate-100">Clases de este horario</p>
              <ul className="divide-y divide-outline-variant dark:divide-slate-700">
                {horariosDelSnapshot.map((h) => (
                  <li key={h.idHorario} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${h.activo ? '' : 'opacity-60'} ${h.idHorario === idHorarioEnlace ? 'rounded-lg bg-primary-container/50 px-2' : ''}`}>
                    <div className="text-sm text-on-surface-variant dark:text-slate-300">
                      {h.instructorNombre ?? '—'} · {h.ambienteNombre ?? '—'} ·{' '}
                      {h.dias.map((d) => diasPorId[d] ?? d).join(', ')} · {formatearHora(h.horaInicio)}–{formatearHora(h.horaFin)}
                      {!h.activo && (
                        <span className="ml-2 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant dark:bg-slate-700 dark:text-slate-300">
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
                        <span className="text-xs text-on-surface-variant dark:text-slate-400">¿Borrar?</span>
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
                          className="rounded border border-outline px-2 py-1 text-[11px] font-medium text-on-surface-variant hover:bg-surface dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
                          className="rounded-xl border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {cambiandoEstadoId === h.idHorario ? '…' : h.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(h.idHorario)}
                          aria-label={`Borrar clase de ${h.fichaCodigo}`}
                          className="rounded-xl border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/50"
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
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-slate-400">{etiqueta}</span>
      <p className="text-sm text-on-surface dark:text-slate-100">{children}</p>
    </div>
  )
}
