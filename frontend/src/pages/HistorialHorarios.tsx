import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { GridHorario } from '../components/horario/GridHorario'
import { GridAsistente } from '../components/horario/GridAsistente'
import { celdasDesdeHorarios } from '../components/horario/celdasAsistente'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, ApiError } from '../services/api'
import type { DiaSemana, Horario, HorarioGuardado, Trimestre } from '../types/api'

function formatearFecha(iso: string) { return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) }
function formatearHora(hora: string) { return hora.slice(0, 5) }

/** Bitácora de consulta: editar y publicar ocurre en Gestionar horarios. */
export function HistorialHorarios() {
  const [searchParams, setSearchParams] = useSearchParams()
  const idHorarioEnlace = Number(searchParams.get('idHorario'))
  const [snapshots, setSnapshots] = useState<HorarioGuardado[] | null>(null)
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [diasPorId, setDiasPorId] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)
  const [grupoSeleccionadoId, setGrupoSeleccionadoId] = useState<string | null>(null)

  useEffect(() => {
    apiGet<HorarioGuardado[]>('/horarios-guardados/')
      .then(setSnapshots)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el registro de horarios.'))
    Promise.all([apiGet<Horario[]>('/horarios/'), apiGet<DiaSemana[]>('/dias-semana/'), apiGet<Trimestre[]>('/trimestres/')])
      .then(([lista, dias, periodos]) => {
        setHorarios(lista); setTrimestres(periodos); setDiasPorId(Object.fromEntries(dias.map((dia) => [dia.idDia, dia.nombreDia])))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las clases registradas.'))
  }, [])

  const nombrePeriodo = (id: number) => trimestres.find((periodo) => periodo.idTrimestre === id)?.nombre ?? `Período ${id}`
  const idsVinculados = new Set((snapshots ?? []).flatMap((snapshot) => snapshot.idsHorarios ?? []))
  const gruposImportados = Object.entries((horarios ?? []).filter((horario) => !idsVinculados.has(horario.idHorario)).reduce<Record<string, Horario[]>>((grupos, horario) => {
    const clave = `${horario.idFicha}:${horario.idTrimestre}`
    grupos[clave] = [...(grupos[clave] ?? []), horario]
    return grupos
  }, {})).map(([clave, bloques]) => ({ clave, bloques, ficha: bloques[0].fichaCodigo ?? `Ficha ${bloques[0].idFicha}`, fecha: bloques.reduce((reciente, bloque) => bloque.fechaCreacion > reciente ? bloque.fechaCreacion : reciente, bloques[0].fechaCreacion) }))
  const entradas = [
    ...(snapshots ?? []).map((snapshot) => {
      const bloques = (horarios ?? []).filter((horario) => snapshot.idsHorarios?.includes(horario.idHorario))
      return { tipo: 'snapshot' as const, clave: `snapshot:${snapshot.idHorarioGuardado}`, ficha: snapshot.ficha, programa: snapshot.programaNombre ?? 'Sin programa vinculado', periodo: bloques[0] ? nombrePeriodo(bloques[0].idTrimestre) : 'Sin período vinculado', cantidad: bloques.length || snapshot.bloques.length, borradores: bloques.filter((bloque) => !bloque.publicado).length, tieneEstado: bloques.length > 0, fecha: snapshot.fechaCreacion, snapshot }
    }),
    ...gruposImportados.map((grupo) => ({ tipo: 'grupo' as const, clave: `grupo:${grupo.clave}`, ficha: grupo.ficha, programa: 'Bloques registrados sin versión del creador', periodo: nombrePeriodo(grupo.bloques[0].idTrimestre), cantidad: grupo.bloques.length, borradores: grupo.bloques.filter((bloque) => !bloque.publicado).length, tieneEstado: true, fecha: grupo.fecha, grupo })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const snapshotEnlace = Number.isInteger(idHorarioEnlace) && idHorarioEnlace > 0 ? snapshots?.find((snapshot) => snapshot.idsHorarios?.includes(idHorarioEnlace)) : undefined
  const bloqueEnlace = !snapshotEnlace && Number.isInteger(idHorarioEnlace) && idHorarioEnlace > 0 ? horarios?.find((horario) => horario.idHorario === idHorarioEnlace) : undefined
  const seleccionado = snapshots?.find((snapshot) => snapshot.idHorarioGuardado === seleccionadoId) ?? snapshotEnlace ?? null
  const grupoSeleccionado = gruposImportados.find((grupo) => grupo.clave === grupoSeleccionadoId) ?? (bloqueEnlace ? gruposImportados.find((grupo) => grupo.clave === `${bloqueEnlace.idFicha}:${bloqueEnlace.idTrimestre}`) : null)
  const horariosDelSnapshot = seleccionado ? (horarios ?? []).filter((horario) => seleccionado.idsHorarios?.includes(horario.idHorario)) : []
  const vistaSnapshotEnVivo = seleccionado?.idsHorarios?.length ? convertirHorariosAGrid(horariosDelSnapshot) : null

  function volverAlRegistro() {
    setSeleccionadoId(null); setGrupoSeleccionadoId(null)
    if (searchParams.has('idHorario')) { const siguientes = new URLSearchParams(searchParams); siguientes.delete('idHorario'); setSearchParams(siguientes, { replace: true }) }
  }

  return <AppShell activo="Registro y versiones">
    <header className="mb-8 max-w-3xl print:hidden"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">Programación académica</p><h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Registro y versiones</h1><p className="mt-2 text-sm leading-6 text-on-surface-variant">Consulta la distribución que se guardó y sus bloques vigentes. Para ajustar, publicar o retirar un bloque, ábrelo en Gestión de horarios.</p></header>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {!seleccionado && !grupoSeleccionado && <section aria-label="Registro por ficha y período" className="print:hidden">
      {!snapshots || !horarios ? <p className="py-12 text-center text-sm text-on-surface-variant">Cargando registro…</p> : entradas.length === 0 ? <p className="text-sm text-on-surface-variant">Todavía no hay horarios guardados.</p> : <>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-on-surface">Registros guardados</h2><p className="mt-1 text-sm text-on-surface-variant">Una entrada por ficha y período, disponible para consulta y auditoría.</p></div><span className="text-xs font-medium tabular-nums text-on-surface-variant">{entradas.length} registro{entradas.length === 1 ? '' : 's'}</span></div>
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-outline-variant bg-surface-container-low text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"><tr><th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Período académico</th><th className="px-4 py-3">Estado actual</th><th className="px-4 py-3">Clases</th><th className="px-4 py-3">Guardado</th><th className="px-4 py-3">Consulta</th></tr></thead><tbody className="divide-y divide-outline-variant">{entradas.map((entrada) => <tr key={entrada.clave} className="transition-colors hover:bg-surface-container-low/60"><td className="px-4 py-4"><div className="font-semibold text-on-surface">{entrada.ficha}</div><div className="mt-1 max-w-64 truncate text-xs text-on-surface-variant" title={entrada.programa}>{entrada.programa}</div></td><td className="px-4 py-3 text-on-surface-variant">{entrada.periodo}</td><td className="px-4 py-4"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${!entrada.tieneEstado ? 'bg-surface-container text-on-surface-variant' : entrada.borradores ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-primary-container text-on-primary-container'}`}>{!entrada.tieneEstado ? 'Sin estado verificable' : entrada.borradores ? `${entrada.borradores} sin publicar` : 'Publicado'}</span></td><td className="px-4 py-4 font-medium tabular-nums text-on-surface">{entrada.cantidad}</td><td className="px-4 py-4 text-xs tabular-nums text-on-surface-variant">{formatearFecha(entrada.fecha)}</td><td className="px-4 py-4"><button type="button" onClick={() => entrada.tipo === 'snapshot' ? (setSeleccionadoId(entrada.snapshot.idHorarioGuardado), setGrupoSeleccionadoId(null)) : (setGrupoSeleccionadoId(entrada.grupo.clave), setSeleccionadoId(null))} aria-label={`Ver registro de ${entrada.ficha}`} className="inline-flex min-h-9 items-center rounded-md border border-outline px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container">Ver registro</button></td></tr>)}</tbody></table></div>
      </>}
    </section>}
    {grupoSeleccionado && <section aria-label={`Registro de ${grupoSeleccionado.ficha}`}><RegistroEncabezado volver={volverAlRegistro} titulo={`Registro de la ficha ${grupoSeleccionado.ficha}`} descripcion={`${grupoSeleccionado.bloques.length} bloque${grupoSeleccionado.bloques.length === 1 ? '' : 's'} · ${nombrePeriodo(grupoSeleccionado.bloques[0].idTrimestre)}`} /><div className="mb-5 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><div className="min-w-[760px]"><GridAsistente celdas={celdasDesdeHorarios(grupoSeleccionado.bloques)} soloFranjasOcupadas /></div></div><ListaBloques bloques={grupoSeleccionado.bloques} diasPorId={diasPorId} /></section>}
    {seleccionado && <section aria-label={`Registro de ${seleccionado.ficha}`}><RegistroEncabezado volver={volverAlRegistro} titulo={`Versión guardada · ficha ${seleccionado.ficha}`} descripcion="Consulta de la versión y sus clases vigentes." /><div className="mb-5 grid gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-4"><Campo etiqueta="Ficha">{seleccionado.ficha}</Campo><Campo etiqueta="Aprendices en formación">{seleccionado.aprendices ?? '—'}</Campo><Campo etiqueta="Horas asignadas">{seleccionado.horasTrimestre ?? '—'}</Campo><Campo etiqueta="Período">{seleccionado.fechaInicio ?? '—'} – {seleccionado.fechaFin ?? '—'}</Campo></div>{vistaSnapshotEnVivo ? <div className="mb-5 min-w-0 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><GridHorario bloques={vistaSnapshotEnVivo.bloques} grid={vistaSnapshotEnVivo.grid} hayBloqueActivo={false} soloLectura /></div> : <><p className="mb-3 rounded-xl bg-surface px-3 py-2 text-xs text-on-surface-variant">Esta versión se guardó antes de vincularse a clases reales; se muestra tal como quedó al crearla.</p><div className="mb-5 min-w-0 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><GridHorario bloques={seleccionado.bloques} grid={seleccionado.grid} hayBloqueActivo={false} soloLectura /></div></>}{horariosDelSnapshot.length > 0 && <ListaBloques bloques={horariosDelSnapshot} diasPorId={diasPorId} />}</section>}
  </AppShell>
}

function RegistroEncabezado({ volver, titulo, descripcion }: { volver: () => void; titulo: string; descripcion: string }) { return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden"><div><button type="button" onClick={volver} className="mb-3 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-surface-container">← Volver al registro</button><h2 className="text-lg font-semibold text-on-surface">{titulo}</h2><p className="mt-1 text-sm text-on-surface-variant">{descripcion}</p></div><ExportarPdfButton /></div> }
function ListaBloques({ bloques, diasPorId }: { bloques: Horario[]; diasPorId: Record<number, string> }) { return <section aria-label="Clases registradas" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 print:hidden sm:p-5"><div className="mb-4 border-b border-outline-variant pb-4"><h3 className="text-base font-semibold text-on-surface">Clases registradas</h3><p className="mt-1 text-sm text-on-surface-variant">Este registro es de consulta. Abre un bloque para gestionarlo en su contexto actual.</p></div><ul className="divide-y divide-outline-variant">{bloques.map((bloque) => <li key={bloque.idHorario} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium text-on-surface">{bloque.resultadoDescripcion ?? bloque.resultadoCodigo ?? `Bloque #${bloque.idHorario}`}</p><p className="mt-1 text-xs text-on-surface-variant">{bloque.instructorNombre ?? 'Sin instructor'} · {bloque.ambienteNombre ?? 'Sin ambiente'} · {bloque.dias.map((dia) => diasPorId[dia] ?? dia).join(', ')} · {formatearHora(bloque.horaInicio)}–{formatearHora(bloque.horaFin)}</p></div><Link to={`/horarios/completos?idHorario=${bloque.idHorario}`} className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-outline px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container">Gestionar bloque</Link></li>)}</ul></section> }
function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) { return <div><span className="mb-1 block text-xs font-medium uppercase tracking-wide text-on-surface-variant">{etiqueta}</span><p className="text-sm text-on-surface">{children}</p></div> }
