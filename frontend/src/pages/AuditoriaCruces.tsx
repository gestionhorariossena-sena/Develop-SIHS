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
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-on-surface">No tienes acceso a esta sección.</p>
          <p className="mt-1 text-sm text-on-surface-variant">
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
            ? 'rounded-xl border border-error/20 bg-error-container px-4 py-3'
            : 'rounded-xl border border-tertiary/20 bg-tertiary-container px-4 py-3'
        }
      >
        <p className={duro ? 'text-sm font-semibold text-on-error-container' : 'text-sm font-semibold text-on-tertiary-container'}>
          {TITULO_POR_TIPO[conflicto.tipo]}
        </p>
        <p className={duro ? 'mt-0.5 text-sm text-on-error-container/90' : 'mt-0.5 text-sm text-on-tertiary-container/90'}>
          {conflicto.mensaje}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            to={`/horarios/completos?id=${conflicto.idHorario}`}
            className={duro ? 'text-xs font-medium text-on-error-container hover:underline' : 'text-xs font-medium text-on-tertiary-container hover:underline'}
          >
            Revisar horario #{conflicto.idHorario} en Horarios completos →
          </Link>
          {conflicto.idHorarioExistente != null && (
            <Link
              to={`/horarios/completos?id=${conflicto.idHorarioExistente}`}
              className={duro ? 'text-xs font-medium text-on-error-container hover:underline' : 'text-xs font-medium text-on-tertiary-container hover:underline'}
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
        <h1 className="mb-1 text-2xl font-bold text-on-surface">Auditoría de cruces</h1>
        <p className="text-sm text-on-surface-variant">
          Cruces detectados entre horarios ya guardados — mismas reglas que el Constructor usa al crear uno nuevo.
        </p>
      </div>

      <section className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de auditoría">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="filtro-trimestre-auditoria" className="mb-1.5 block text-xs font-medium text-on-surface-variant">Trimestre</label>
            <select
              id="filtro-trimestre-auditoria"
              value={filtroTrimestre}
              onChange={(evento) => setFiltroTrimestre(evento.target.value)}
              className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="todos">Todos</option>
              {trimestres.map((trimestre) => (
                <option key={trimestre.idTrimestre} value={trimestre.idTrimestre}>{trimestre.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-sede-auditoria" className="mb-1.5 block text-xs font-medium text-on-surface-variant">Sede</label>
            <select
              id="filtro-sede-auditoria"
              value={filtroSede}
              onChange={(evento) => setFiltroSede(evento.target.value)}
              className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="todas">Todas</option>
              {sedes.map((sede) => (
                <option key={sede.idSede} value={sede.idSede}>{sede.nombreSede}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-on-surface-variant">Auditando horarios…</p>
      ) : conflictos.length === 0 ? (
        <div className="rounded-xl border border-primary/20 bg-primary-container p-8 text-center">
          <p className="text-sm font-semibold text-on-primary-container">Sin conflictos activos.</p>
          <p className="mt-1 text-sm text-on-primary-container/90">
            No hay cruces entre los horarios guardados para este filtro.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
            <span className="rounded-full bg-tertiary-container px-2.5 py-1 text-xs font-semibold text-on-tertiary-container">
              {conflictos.length} conflicto{conflictos.length === 1 ? '' : 's'} activo{conflictos.length === 1 ? '' : 's'}
            </span>
            {(datosVigentes?.resumen.tipos ?? []).map((tipo) => (
              <span key={tipo} className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-slate-700">
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
