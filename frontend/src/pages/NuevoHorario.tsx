import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { HorarioEditor } from '../components/horario/HorarioEditor'
import type { CatalogosBloque } from '../components/horario/ModalBloque'
import { ModalCruce } from '../components/horario/ModalCruce'
import { apiDelete, apiGet, apiPost, ApiError } from '../services/api'
import { BLOQUES, DIAS } from './horario/tipos'
import type { BloqueClase, GridAsignaciones, Jornada as JornadaGrid } from './horario/tipos'
import { gridVacio } from './horario/useHorarioState'
import type {
  Ambiente,
  DiaSemana,
  Ficha,
  Horario,
  HorarioCreate,
  HorarioDryRunConflict,
  HorarioDryRunResponse,
  HorarioGuardado,
  Jornada,
  ResultadoAprendizaje,
  Usuario,
} from '../types/api'

const SEDES = [
  { nombre: 'Sede principal', direccion: 'Calle 52 # 13 -65' },
  { nombre: 'Sede Unigermana', direccion: 'AK 14 # 63 – 87' },
  { nombre: 'Sede Fontibón', direccion: 'Cl 19A # 96c - 40' },
]

interface Catalogos extends CatalogosBloque {
  jornadaIdPorNombre: Record<JornadaGrid, number>
  diaIdPorNombre: Record<string, number>
}

interface GrupoCelda {
  bloqueIdx: number
  bloqueId: string
  diasIdx: number[]
}

/** Agrupa el grid por (bloque de clase, bloque horario) — cada grupo se
 * traduce en un POST /horarios con la lista de días donde aparece. */
function agruparCeldas(grid: GridAsignaciones): GrupoCelda[] {
  const grupos = new Map<string, GrupoCelda>()

  grid.forEach((fila, bloqueIdx) => {
    fila.forEach((bloqueId, diaIdx) => {
      if (!bloqueId) return
      const clave = `${bloqueIdx}-${bloqueId}`
      const existente = grupos.get(clave)
      if (existente) {
        existente.diasIdx.push(diaIdx)
      } else {
        grupos.set(clave, { bloqueIdx, bloqueId, diasIdx: [diaIdx] })
      }
    })
  })

  return [...grupos.values()]
}

/** POST /horarios/validar — revisa cruces sin persistir nada. Si hay
 * conflictos, el backend responde 409 con el mismo cuerpo (ok/
 * puedeGuardar/conflictos/resumen) — apiPost lo lanza como ApiError, así
 * que acá se recupera desde `err.detail` en vez de tratarlo como falla.
 * Si el dry-run falla por otra razón (red, 500), devuelve null y
 * guardarHorario sigue directo al POST real — el dry-run es una ayuda
 * para decidir antes, no un requisito para poder guardar. */
async function validarDryRun(datos: HorarioCreate): Promise<HorarioDryRunResponse | null> {
  try {
    return await apiPost<HorarioDryRunResponse>('/horarios/validar', {
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      idJornada: datos.idJornada,
      idTrimestre: datos.idTrimestre,
      idAmbiente: datos.idAmbiente,
      idInstructor: datos.idInstructor,
      idFicha: datos.idFicha,
      idResultado: datos.idResultado,
      dias: datos.dias,
      excluirIdHorario: null,
    })
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 409 &&
      err.detail &&
      typeof err.detail === 'object' &&
      'conflictos' in err.detail
    ) {
      return err.detail as HorarioDryRunResponse
    }
    return null
  }
}

export function NuevoHorario() {
  const [searchParams] = useSearchParams()
  const idEditar = searchParams.get('editar')

  const [ficha, setFicha] = useState('')
  const [aprendices, setAprendices] = useState('0')
  const [horasTrimestre, setHorasTrimestre] = useState('36')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [erroresGuardar, setErroresGuardar] = useState<string[]>([])
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null)

  // Modo "Modificar" (?editar=<idHorarioGuardado>, desde Historial de
  // horarios): precarga ficha/fechas/bloques/grid de ese horario guardado
  // en vez de arrancar vacío. `datosEdicion` guarda también
  // idHorarioGuardado/idsHorarios — al guardar, guardarHorario() borra
  // esas filas viejas antes de crear las nuevas (ver más abajo), así el
  // horario "editado" queda igual de nuevo que uno creado desde cero.
  const [datosEdicion, setDatosEdicion] = useState<HorarioGuardado | null>(null)
  const [cargandoEdicion, setCargandoEdicion] = useState(Boolean(idEditar))
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)

  // Cuando el dry-run (POST /horarios/validar) encuentra conflictos, se
  // pausa el guardado de ESE bloque y se muestra ModalCruce — el
  // coordinador decide cancelar o forzar. resolverDecisionRef guarda el
  // resolve() de la promesa que el loop de guardarHorario está esperando
  // (ver pedirDecision más abajo).
  const [conflictoPendiente, setConflictoPendiente] = useState<{
    bloqueResumen: string
    conflictos: HorarioDryRunConflict[]
  } | null>(null)
  const resolverDecisionRef = useRef<((forzar: boolean) => void) | null>(null)

  function pedirDecision(bloqueResumen: string, conflictos: HorarioDryRunConflict[]): Promise<boolean> {
    return new Promise((resolve) => {
      resolverDecisionRef.current = resolve
      setConflictoPendiente({ bloqueResumen, conflictos })
    })
  }

  function resolverConflictoPendiente(forzar: boolean) {
    setConflictoPendiente(null)
    resolverDecisionRef.current?.(forzar)
    resolverDecisionRef.current = null
  }

  // bloquesIniciales/gridInicial son de verdad "iniciales": HorarioEditor
  // los usa como valor de arranque de su propio useHorarioState y después
  // los ignora (ver useHorarioState.ts) — por eso <HorarioEditor> no se
  // monta más abajo hasta que cargandoEdicion sea false, si no siempre
  // arrancaría vacío aunque datosEdicion llegara un instante después.
  const estadoActualRef = useRef<{ bloques: BloqueClase[]; grid: GridAsignaciones }>({ bloques: [], grid: gridVacio() })
  const capturarEstadoActual = useCallback((estado: { bloques: BloqueClase[]; grid: GridAsignaciones }) => {
    estadoActualRef.current = estado
  }, [])

  useEffect(() => {
    Promise.all([
      apiGet<Ficha[]>('/fichas/'),
      apiGet<Ambiente[]>('/ambientes'),
      apiGet<Usuario[]>('/usuarios/'),
      apiGet<ResultadoAprendizaje[]>('/resultados-aprendizaje/'),
      apiGet<Jornada[]>('/jornadas/'),
      apiGet<DiaSemana[]>('/dias-semana/'),
    ])
      .then(([fichas, ambientes, instructores, resultados, jornadas, dias]) => {
        const jornadaIdPorNombre = Object.fromEntries(
          jornadas.map((j) => [j.nombreJornada, j.idJornada]),
        ) as Record<JornadaGrid, number>
        const diaIdPorNombre = Object.fromEntries(dias.map((d) => [d.nombreDia, d.idDia]))

        setCatalogos({ fichas, ambientes, instructores, resultados, jornadaIdPorNombre, diaIdPorNombre })
      })
      .catch((err: unknown) => {
        setErrorCatalogos(
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar los catálogos (fichas, ambientes, instructores, resultados).',
        )
      })

    if (idEditar) {
      apiGet<HorarioGuardado>(`/horarios-guardados/${idEditar}`)
        .then((snapshot) => {
          setDatosEdicion(snapshot)
          setFicha(snapshot.ficha)
          setAprendices(snapshot.aprendices ?? '0')
          setHorasTrimestre(snapshot.horasTrimestre ?? '36')
          setFechaInicio(snapshot.fechaInicio ?? '')
          setFechaFin(snapshot.fechaFin ?? '')
        })
        .catch((err: unknown) => {
          setErrorEdicion(err instanceof ApiError ? err.message : 'No se pudo cargar el horario a modificar.')
        })
        .finally(() => setCargandoEdicion(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idEditar no cambia en la vida del componente.
  }, [])

  async function guardarHorario() {
    if (!catalogos) return

    setGuardando(true)
    setErroresGuardar([])
    setMensajeExito(null)

    // Modo edición: se borran primero las clases reales y el snapshot
    // originales — todo lo de abajo (dry-run, POST /horarios/, POST
    // /horarios-guardados/) es exactamente el mismo camino que crear desde
    // cero, así el horario "modificado" queda con fechaCreacion nueva y
    // sube al tope de Historial, como pidió. Si algún borrado falla (ya no
    // existe, por ejemplo) no se frena el guardado — mismo criterio de
    // "mejor esfuerzo" que ya tiene el resto de esta función.
    if (datosEdicion) {
      for (const idHorarioViejo of datosEdicion.idsHorarios ?? []) {
        try {
          await apiDelete(`/horarios/${idHorarioViejo}`)
        } catch {
          // No pasa nada si ya no existía.
        }
      }
      try {
        await apiDelete(`/horarios-guardados/${datosEdicion.idHorarioGuardado}`)
      } catch {
        // Idem.
      }
    }

    const { bloques: bloquesActuales, grid: gridActual } = estadoActualRef.current
    const grupos = agruparCeldas(gridActual)
    const errores: string[] = []

    // Cada grupo se guarda o falla de forma independiente — si uno choca,
    // los demás igual se crean de verdad y quedan en el historial. Antes
    // esto era todo-o-nada: un solo cruce descartaba hasta las clases que
    // sí habían quedado guardadas en `horarios`.
    const gridExitoso: GridAsignaciones = gridVacio()
    const idsBloquesExitosos = new Set<string>()
    // idHorario real (tabla `horarios`) de cada bloque que sí se creó — se
    // manda junto con el snapshot para que borrar el "Horario completo" en
    // Historial de horarios también libere estas clases reales, no solo
    // el resumen (bug reportado 2026-09-02: quedaban huérfanas).
    const idsHorariosCreados: number[] = []

    for (const grupo of grupos) {
      const bloque = bloquesActuales.find((b) => b.id === grupo.bloqueId)
      const bloqueHorario = BLOQUES[grupo.bloqueIdx]

      if (
        !bloque ||
        bloque.idResultado === undefined ||
        bloque.idInstructor === undefined ||
        bloque.idFicha === undefined ||
        bloque.idTrimestre === undefined ||
        bloque.idAmbiente === undefined
      ) {
        errores.push(`"${bloque?.tematica ?? 'una celda'}" no tiene todos los datos — vuelve a editarla.`)
        continue
      }

      const datos: HorarioCreate = {
        horaInicio: bloqueHorario.horaInicio24,
        horaFin: bloqueHorario.horaFin24,
        idJornada: catalogos.jornadaIdPorNombre[bloqueHorario.jornada],
        idTrimestre: bloque.idTrimestre,
        idAmbiente: bloque.idAmbiente,
        idInstructor: bloque.idInstructor,
        idFicha: bloque.idFicha,
        idResultado: bloque.idResultado,
        dias: grupo.diasIdx.map((diaIdx) => catalogos.diaIdPorNombre[DIAS[diaIdx]]),
      }

      const diasTexto = grupo.diasIdx.map((diaIdx) => DIAS[diaIdx]).join(' y ')
      const etiquetaBloque = `${bloque.tematica} (${diasTexto} ${bloqueHorario.horaInicio})`

      // Dry-run antes de guardar de verdad: si el backend no responde (o
      // devuelve algo que no es el contrato esperado), no se bloquea el
      // guardado por eso — se sigue directo al POST real, igual que
      // antes de que existiera el dry-run.
      const dryRun = await validarDryRun(datos)

      if (dryRun && !dryRun.puedeGuardar) {
        const bloqueResumen = `${diasTexto} ${bloqueHorario.horaInicio} – ${bloqueHorario.horaFin} · ${bloque.tematica} · ${bloque.instructor} · Ficha ${bloque.ficha} · ${bloque.ambiente}`
        const forzar = await pedirDecision(bloqueResumen, dryRun.conflictos)

        if (!forzar) {
          // RF-011 sigue el mismo patrón que un cruce físico (§7.2 de
          // PLAN_INTEGRACION_LOGICA_Y_BD.md, corregido 2026-09-02) — no
          // es "imposible de programar", el coordinador simplemente
          // decidió no forzarlo.
          errores.push(`${etiquetaBloque}: cruce detectado — no se guardó (cancelado).`)
          continue
        }

        datos.forzar = true
      }

      try {
        const horarioCreado = await apiPost<Horario>('/horarios/', datos)
        idsBloquesExitosos.add(grupo.bloqueId)
        idsHorariosCreados.push(horarioCreado.idHorario)
        for (const diaIdx of grupo.diasIdx) {
          gridExitoso[grupo.bloqueIdx][diaIdx] = grupo.bloqueId
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const detalle = err.detail as { mensajes?: string[] } | null
          const mensajes = detalle?.mensajes ?? [err.message]
          errores.push(`${etiquetaBloque}: ${mensajes.join(' ')}`)
        } else {
          errores.push(`${bloque.tematica}: ${err instanceof ApiError ? err.message : 'error al guardar'}`)
        }
      }
    }

    const creados = gridExitoso.reduce((total, fila) => total + fila.filter(Boolean).length, 0)

    if (creados > 0) {
      // Snapshot en `horarios_guardados` solo con lo que sí quedó creado de
      // verdad — para el Historial/exportar a PDF (ver
      // PLAN_INTEGRACION_LOGICA_Y_BD.md §5, migración pendiente). El
      // schema espera fecha válida o null — nunca "" (Pydantic rechaza un
      // string vacío como date con 422).
      try {
        await apiPost('/horarios-guardados/', {
          ficha,
          aprendices,
          horasTrimestre,
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          bloques: bloquesActuales.filter((b) => idsBloquesExitosos.has(b.id)),
          grid: gridExitoso,
          idsHorarios: idsHorariosCreados,
        })
      } catch (err) {
        // Las clases reales ya quedaron creadas — esto solo afecta al
        // snapshot de Historial/PDF, pero se avisa en vez de tragarlo en
        // silencio (así se descubrió el bug de fechas vacías → 422).
        errores.push(
          `Las clases se guardaron, pero no se pudo actualizar el Historial: ${
            err instanceof ApiError ? err.message : 'error desconocido'
          }`,
        )
      }
      setMensajeExito(
        `${creados} clase${creados === 1 ? '' : 's'} ${datosEdicion ? 'guardada' : 'creada'}${creados === 1 ? '' : 's'} sin cruces.`,
      )
    }

    setErroresGuardar(errores)
    setGuardando(false)
  }

  return (
    <AppShell activo="Horarios">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {datosEdicion ? 'Modificar horario' : 'Nuevo horario'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {datosEdicion
              ? 'Edita los bloques de este horario completo y guarda — reemplaza las clases originales por las que queden acá, con fecha de creación nueva.'
              : 'Define un bloque de clase eligiendo de los catálogos reales y reutilízalo en el grid — al guardar, el sistema revisa cruces de ficha, instructor, ambiente y resultado repetido antes de crear cada clase.'}
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <Link
            to={datosEdicion ? '/horarios/historial' : '/dashboard'}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </Link>
          <ExportarPdfButton etiqueta="Exportar a PDF" />
          <button
            type="button"
            onClick={() => void guardarHorario()}
            disabled={guardando || !catalogos || cargandoEdicion}
            title={!catalogos ? 'Cargando catálogos…' : cargandoEdicion ? 'Cargando horario a modificar…' : undefined}
            className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : datosEdicion ? 'Guardar cambios' : 'Guardar horario'}
          </button>
        </div>
      </div>

      {errorCatalogos && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {errorCatalogos}
        </p>
      )}

      {errorEdicion && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {errorEdicion}
        </p>
      )}

      {erroresGuardar.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          <p className="mb-1 font-semibold">El sistema encontró cruces — esto no se guardó:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {erroresGuardar.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {mensajeExito && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 print:hidden">
          {mensajeExito}
        </p>
      )}

      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
        <Campo etiqueta="Ficha (referencia del formulario)">
          <input
            value={ficha}
            onChange={(e) => setFicha(e.target.value)}
            placeholder="Ej. 3228973 B"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </Campo>
        <Campo etiqueta="Aprendices en formación a la fecha">
          <input
            value={aprendices}
            onChange={(e) => setAprendices(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </Campo>
        <Campo etiqueta="Horas asignadas trimestre">
          <input
            value={horasTrimestre}
            onChange={(e) => setHorasTrimestre(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </Campo>
        <Campo etiqueta="Inicio / fin de trimestre">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </Campo>
      </div>

      <div className="mb-6">
        {catalogos && !cargandoEdicion ? (
          <HorarioEditor
            bloquesIniciales={datosEdicion?.bloques ?? []}
            gridInicial={datosEdicion?.grid ?? gridVacio()}
            onCambiarEstado={capturarEstadoActual}
            catalogos={catalogos}
          />
        ) : (
          !errorCatalogos && !errorEdicion && <p className="text-sm text-slate-500">Cargando…</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Dirección sede principal y sedes</p>
        <ul className="space-y-0.5">
          {SEDES.map((sede) => (
            <li key={sede.nombre}>
              <span className="font-medium text-slate-700 dark:text-slate-300">{sede.nombre}:</span> {sede.direccion}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500 print:hidden dark:text-slate-400">
          Plantilla base:{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-900 dark:text-slate-300">
            _Docs/Diseño/plantillas-institucionales/disponibilidad-ficha-3228973B.pdf
          </code>
          . Reglas de color/tipografía en{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-900 dark:text-slate-300">_Docs/Diseño/GUIA_DE_MARCA.md</code>.
        </p>
      </div>

      {conflictoPendiente && (
        <ModalCruce
          bloqueResumen={conflictoPendiente.bloqueResumen}
          conflictos={conflictoPendiente.conflictos}
          onCancelar={() => resolverConflictoPendiente(false)}
          onForzar={() => resolverConflictoPendiente(true)}
        />
      )}
    </AppShell>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {etiqueta}
      </span>
      {children}
    </label>
  )
}
