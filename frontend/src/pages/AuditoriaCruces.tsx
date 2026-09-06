import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { AuditoriaConflicto, AuditoriaCrucesResponse, Sede, Trimestre, TipoConflictoHorario } from '../types/api'

// Mismas 5 etiquetas oficiales que ModalCruce.tsx (no se exportan desde ahí,
// así que se replican acá tal cual — ver GUIA_DE_MARCA.md, "no inventar
// paleta o texto distinto al ya establecido").
const TITULO_POR_TIPO: Record<TipoConflictoHorario, string> = {
  cruce_ficha: 'Ficha ocupada',
  cruce_instructor: 'Instructor ocupado',
  cruce_ambiente: 'Ambiente ocupado',
  resultado_repetido: 'Resultado repetido',
  regla_instructor: 'Regla institucional (RF-011)',
}

function construirQuery(idTrimestre: string, idSede: string) {
  const params = new URLSearchParams()
  if (idTrimestre !== 'todos') params.set('idTrimestre', idTrimestre)
  if (idSede !== 'todas') params.set('idSede', idSede)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * "Auditoría de Cruces" — barrido de conflictos entre horarios YA
 * guardados (a diferencia del Constructor, que valida un candidato nuevo
 * antes de guardarlo). Consume GET /horarios/auditoria-cruces
 * (HorarioService.auditar_conflictos), que reutiliza la misma lógica y
 * las mismas 5 categorías que ya se usan en /horarios/validar y
 * ModalCruce.tsx — no hay una taxonomía nueva acá.
 *
 * "Resolver conflicto" no es un botón de un clic: no existe (todavía) un
 * mapeo de idHorario → idHorarioGuardado editable en el Constructor
 * (NuevoHorario.tsx solo sabe editar vía ?editar=<idHorarioGuardado>).
 * En vez de fabricar un link roto, cada horario en conflicto enlaza al
 * deep-link real y ya existente `/horarios/completos?id=<idHorario>`
 * (HorariosCompletos.tsx lee `?id=` y expande esa fila con el detalle
 * completo, y desde ahí ya hay un link real a "Detalles de creación /
 * Modificar" en Historial).
 */
export function AuditoriaCruces() {
  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [filtroTrimestre, setFiltroTrimestre] = useState('todos')
  const [filtroSede, setFiltroSede] = useState('todas')

  // `datos` guarda junto a la respuesta la combinación de filtros que la
  // produjo — así, al cambiar de filtro, el resultado del filtro anterior
  // se descarta (vuelve a verse "cargando") sin necesitar un setState
  // síncrono de "cargando=true" al inicio del efecto (mismo truco que
  // VistaFichas.tsx usa con `horariosVigentes`/`idFicha`, evita el warning
  // de react-hooks/set-state-in-effect).
  const [datos, setDatos] = useState<{ combinacion: string; respuesta: AuditoriaCrucesResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noAutorizado, setNoAutorizado] = useState(false)

  const combinacionActual = `${filtroTrimestre}|${filtroSede}`
  const datosVigentes = datos && datos.combinacion === combinacionActual ? datos.respuesta : null
  const cargando = datosVigentes === null && !error && !noAutorizado

  useEffect(() => {
    apiGet<Trimestre[]>('/trimestres/').then(setTrimestres).catch(() => {})
    apiGet<Sede[]>('/sedes').then(setSedes).catch(() => {})
  }, [])

  useEffect(() => {
    const combinacion = `${filtroTrimestre}|${filtroSede}`

    apiGet<AuditoriaCrucesResponse>(`/horarios/auditoria-cruces${construirQuery(filtroTrimestre, filtroSede)}`)
      .then((respuesta) => {
        setDatos({ combinacion, respuesta })
        setError(null)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setNoAutorizado(true)
          return
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la auditoría de cruces.')
      })
  }, [filtroTrimestre, filtroSede])

  if (noAutorizado) {
    return (
      <AppShell activo="Auditoría de cruces">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No tienes acceso a esta sección.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            La auditoría de cruces es solo para Coordinador/Administrador.
          </p>
        </div>
      </AppShell>
    )
  }

  const conflictos = datosVigentes?.conflictos ?? []
  const conflictosDuros = conflictos.filter((c) => c.tipo === 'regla_instructor')
  const conflictosFisicos = conflictos.filter((c) => c.tipo !== 'regla_instructor')

  function conteoPorTipo(tipo: TipoConflictoHorario) {
    return conflictos.filter((c) => c.tipo === tipo).length
  }

  function TarjetaConflicto({ conflicto, duro }: { conflicto: AuditoriaConflicto; duro: boolean }) {
    return (
      <div
        className={
          duro
            ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40'
            : 'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40'
        }
      >
        <p className={duro ? 'text-sm font-semibold text-red-800 dark:text-red-300' : 'text-sm font-semibold text-amber-800 dark:text-amber-300'}>
          {TITULO_POR_TIPO[conflicto.tipo]}
        </p>
        <p className={duro ? 'mt-0.5 text-sm text-red-700 dark:text-red-400' : 'mt-0.5 text-sm text-amber-700 dark:text-amber-400'}>
          {conflicto.mensaje}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            to={`/horarios/completos?id=${conflicto.idHorario}`}
            className={duro ? 'text-xs font-medium text-red-800 hover:text-red-900 dark:text-red-300' : 'text-xs font-medium text-amber-800 hover:text-amber-900 dark:text-amber-300'}
          >
            Revisar horario #{conflicto.idHorario} en Horarios completos →
          </Link>
          {conflicto.idHorarioExistente != null && (
            <Link
              to={`/horarios/completos?id=${conflicto.idHorarioExistente}`}
              className={duro ? 'text-xs font-medium text-red-800 hover:text-red-900 dark:text-red-300' : 'text-xs font-medium text-amber-800 hover:text-amber-900 dark:text-amber-300'}
            >
              Revisar horario #{conflicto.idHorarioExistente} en conflicto →
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <AppShell activo="Auditoría de cruces">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Auditoría de cruces</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cruces detectados entre horarios ya guardados — mismas reglas que el Constructor usa al crear uno nuevo.
        </p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de auditoría">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="filtro-trimestre-auditoria" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Trimestre</label>
            <select
              id="filtro-trimestre-auditoria"
              value={filtroTrimestre}
              onChange={(evento) => setFiltroTrimestre(evento.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="todos">Todos</option>
              {trimestres.map((trimestre) => (
                <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-sede-auditoria" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Sede</label>
            <select
              id="filtro-sede-auditoria"
              value={filtroSede}
              onChange={(evento) => setFiltroSede(evento.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="todas">Todas</option>
              {sedes.map((sede) => (
                <option key={sede.idSede} value={sede.idSede}>{sede.nombreSede}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Auditando horarios…</p>
      ) : conflictos.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Sin conflictos activos.</p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            No hay cruces entre los horarios guardados para este filtro.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
              {conflictos.length} conflicto{conflictos.length === 1 ? '' : 's'} activo{conflictos.length === 1 ? '' : 's'}
            </span>
            {(datosVigentes?.resumen.tipos ?? []).map((tipo) => (
              <span key={tipo} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {TITULO_POR_TIPO[tipo as TipoConflictoHorario] ?? tipo}: {conteoPorTipo(tipo as TipoConflictoHorario)}
              </span>
            ))}
          </div>

          <div className="space-y-3">
            {conflictosDuros.map((conflicto, i) => (
              <TarjetaConflicto key={`duro-${i}`} conflicto={conflicto} duro />
            ))}
            {conflictosFisicos.map((conflicto, i) => (
              <TarjetaConflicto key={`fisico-${i}`} conflicto={conflicto} duro={false} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}
