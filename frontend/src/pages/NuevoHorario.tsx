import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { HorarioEditor } from '../components/horario/HorarioEditor'
import type { CatalogosBloque } from '../components/horario/ModalBloque'
import { ModalCruce } from '../components/horario/ModalCruce'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, apiPost, apiPut, ApiError } from '../services/api'
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

const FILTROS_JORNADA = ['Todas', 'Mañana', 'Tarde', 'Noche'] as const
type FiltroJornada = (typeof FILTROS_JORNADA)[number]

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
  const [guardarComoBorrador, setGuardarComoBorrador] = useState(true)
  const [erroresGuardar, setErroresGuardar] = useState<string[]>([])
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [busquedaFicha, setBusquedaFicha] = useState('')
  const [filtroJornada, setFiltroJornada] = useState<FiltroJornada>('Todas')
  const [fichaSeleccionada, setFichaSeleccionada] = useState<Ficha | null>(null)
  const [fichaPendiente, setFichaPendiente] = useState<Ficha | null>(null)
  const [horariosFicha, setHorariosFicha] = useState<{ idFicha: number; datos: Horario[] } | null>(null)
  const [asignacionesPendientes, setAsignacionesPendientes] = useState<{
    idFicha: number
    bloques: BloqueClase[]
    grid: GridAsignaciones
  } | null>(null)
  const [cargandoHorarioFicha, setCargandoHorarioFicha] = useState(false)
  const [errorHorarioFicha, setErrorHorarioFicha] = useState<string | null>(null)
  const [recargaHorarioFicha, setRecargaHorarioFicha] = useState(0)
  const [versionEditor, setVersionEditor] = useState(0)
  const [hayCambiosPendientes, setHayCambiosPendientes] = useState(false)

  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null)
  const idFichaSeleccionada = fichaSeleccionada?.idFicha ?? null

  // La edición se habilita solo cuando el snapshot tiene todos sus vínculos
  // relacionales, para reemplazarlo de forma atómica en el backend.
  const [datosEdicion, setDatosEdicion] = useState<HorarioGuardado | null>(null)
  const [cargandoEdicion, setCargandoEdicion] = useState(Boolean(idEditar))
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)
  const [edicionSegura, setEdicionSegura] = useState(false)
  const idsOriginalesPorGrupo = useRef<Record<string, number>>({})
  const fechasOriginalesPorGrupo = useRef<Record<string, string>>({})

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
    setHayCambiosPendientes(estado.bloques.some((bloque) => bloque.idHorarioOriginal === undefined))
  }, [])

  function aplicarSeleccionFicha(item: Ficha) {
    setFichaSeleccionada(item)
    setFicha(item.codigoFicha)
    setFichaPendiente(null)
    setHayCambiosPendientes(false)
    setAsignacionesPendientes(null)
    setHorariosFicha(null)
    setErrorHorarioFicha(null)
    setCargandoHorarioFicha(true)
    estadoActualRef.current = { bloques: [], grid: gridVacio() }
  }

  function reintentarCargaHorarioFicha() {
    setErrorHorarioFicha(null)
    setCargandoHorarioFicha(true)
    setRecargaHorarioFicha((valor) => valor + 1)
  }

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
          const gruposOriginales = agruparCeldas(snapshot.grid)
          const ids = snapshot.idsHorarios ?? []
          const asignaciones = snapshot.asignaciones ?? []
          const asignacionesPorId = new Map(asignaciones.map((asignacion) => [asignacion.idHorario, asignacion]))
          if (
            !ids.length || gruposOriginales.length !== ids.length || asignaciones.length !== ids.length ||
            ids.some((id, index) => asignaciones[index]?.idHorario !== id || !asignaciones[index]?.fechaModificacion)
          ) {
            setErrorEdicion('Este snapshot no tiene vínculos completos con sus clases y no puede editarse de forma segura.')
            setDatosEdicion(snapshot)
            return
          }
          const idsPorGrupo: Record<string, number> = {}
          const fechasPorGrupo: Record<string, string> = {}
          const asignacionPorBloque = new Map<string, Horario>()
          gruposOriginales.forEach((grupo, index) => {
            const horario = asignacionesPorId.get(ids[index])
            if (!horario) return
            idsPorGrupo[`${grupo.bloqueIdx}-${grupo.bloqueId}`] = horario.idHorario
            fechasPorGrupo[`${grupo.bloqueIdx}-${grupo.bloqueId}`] = horario.fechaModificacion
            if (!asignacionPorBloque.has(grupo.bloqueId)) asignacionPorBloque.set(grupo.bloqueId, horario)
          })
          idsOriginalesPorGrupo.current = idsPorGrupo
          fechasOriginalesPorGrupo.current = fechasPorGrupo
          const bloques = snapshot.bloques.map((bloque) => {
            const horario = asignacionPorBloque.get(bloque.id)
            return horario ? {
              ...bloque,
              idResultado: horario.idResultado,
              idInstructor: horario.idInstructor,
              idFicha: horario.idFicha,
              idTrimestre: horario.idTrimestre,
              idAmbiente: horario.idAmbiente,
            } : bloque
          })
          setDatosEdicion({ ...snapshot, bloques })
          setEdicionSegura(true)
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

  useEffect(() => {
    if (idEditar || idFichaSeleccionada === null) return

    let vigente = true
    apiGet<Horario[]>(`/fichas/${idFichaSeleccionada}/horarios`)
      .then((datos) => {
        if (vigente) {
          setHorariosFicha({ idFicha: idFichaSeleccionada, datos })
          setVersionEditor((version) => version + 1)
        }
      })
      .catch((err: unknown) => {
        if (vigente) {
          setErrorHorarioFicha(
            err instanceof ApiError ? err.message : 'No se pudo cargar el horario de esta ficha.',
          )
        }
      })
      .finally(() => {
        if (vigente) setCargandoHorarioFicha(false)
      })

    return () => {
      vigente = false
    }
  }, [idEditar, idFichaSeleccionada, recargaHorarioFicha])

  async function guardarHorario() {
    if (
      !catalogos ||
      (idEditar !== null && !edicionSegura) ||
      (idEditar === null && (!fichaSeleccionada || cargandoHorarioFicha || errorHorarioFicha !== null))
    ) return

    setGuardando(true)
    setErroresGuardar([])
    setMensajeExito(null)

    const { bloques: bloquesActuales, grid: gridActual } = estadoActualRef.current
    const grupos = agruparCeldas(gridActual).filter((grupo) => {
      if (idEditar !== null) return true
      return bloquesActuales.find((bloque) => bloque.id === grupo.bloqueId)?.idHorarioOriginal === undefined
    })
    const errores: string[] = []

    if (idEditar === null && grupos.length === 0) {
      setErroresGuardar(['Agrega al menos una nueva asignación antes de guardar.'])
      setGuardando(false)
      return
    }

    if (idEditar !== null) {
      const horarios: (HorarioCreate & {
        idHorarioOriginal?: number
        fechaModificacionOriginal?: string
        bloqueIdx: number
        bloqueId: string
      })[] = []
      for (const grupo of grupos) {
        const bloque = bloquesActuales.find((b) => b.id === grupo.bloqueId)
        const bloqueHorario = BLOQUES[grupo.bloqueIdx]
        if (
          !bloque || !bloqueHorario || bloque.idResultado === undefined || bloque.idInstructor === undefined ||
          bloque.idFicha === undefined || bloque.idTrimestre === undefined || bloque.idAmbiente === undefined
        ) {
          errores.push(`"${bloque?.tematica ?? 'una celda'}" no tiene todos los datos — vuelve a editarla.`)
          continue
        }
        horarios.push({
          horaInicio: bloqueHorario.horaInicio24,
          horaFin: bloqueHorario.horaFin24,
          idJornada: catalogos.jornadaIdPorNombre[bloqueHorario.jornada],
          idTrimestre: bloque.idTrimestre,
          idAmbiente: bloque.idAmbiente,
          idInstructor: bloque.idInstructor,
          idFicha: bloque.idFicha,
          idResultado: bloque.idResultado,
          dias: grupo.diasIdx.map((diaIdx) => catalogos.diaIdPorNombre[DIAS[diaIdx]]),
          idHorarioOriginal: idsOriginalesPorGrupo.current[`${grupo.bloqueIdx}-${grupo.bloqueId}`],
          fechaModificacionOriginal: (() => {
            const key = `${grupo.bloqueIdx}-${grupo.bloqueId}`
            return idsOriginalesPorGrupo.current[key] === undefined ? undefined : fechasOriginalesPorGrupo.current[key]
          })(),
          bloqueIdx: grupo.bloqueIdx,
          bloqueId: grupo.bloqueId,
        })
      }
      if (errores.length || !horarios.length) {
        setErroresGuardar(errores.length ? errores : ['El horario debe conservar al menos una asignación.'])
        setGuardando(false)
        return
      }
      try {
        await apiPut(`/horarios-guardados/${idEditar}/reemplazar`, {
          ficha, aprendices, horasTrimestre,
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          bloques: bloquesActuales,
          grid: gridActual,
          horarios,
        })
        setMensajeExito('Los cambios del horario se guardaron de forma segura.')
        setErroresGuardar([])
      } catch (err) {
        const detalle = err instanceof ApiError && err.detail && typeof err.detail === 'object'
          ? (err.detail as { mensajes?: string[] }).mensajes?.join(' ')
          : null
        setErroresGuardar([detalle ?? (err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.')])
      } finally {
        setGuardando(false)
      }
      return
    }

    // Cada grupo se guarda o falla de forma independiente — si uno choca,
    // los demás igual se crean de verdad y quedan en el historial. Antes
    // esto era todo-o-nada: un solo cruce descartaba hasta las clases que
    // sí habían quedado guardadas en `horarios`.
    const gridExitoso: GridAsignaciones = gridVacio()
    const idsBloquesExitosos = new Set<string>()
    const gruposFallidos = new Set<string>()
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
        gruposFallidos.add(`${grupo.bloqueIdx}-${grupo.bloqueId}`)
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
        publicado: !guardarComoBorrador,
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
          gruposFallidos.add(`${grupo.bloqueIdx}-${grupo.bloqueId}`)
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
        gruposFallidos.add(`${grupo.bloqueIdx}-${grupo.bloqueId}`)
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
        `${creados} clase${creados === 1 ? '' : 's'} creada${creados === 1 ? '' : 's'} ${guardarComoBorrador ? 'como borrador privado' : 'y publicada'}.`,
      )
    }

    setErroresGuardar(errores)
    if (creados > 0 && fichaSeleccionada) {
      const gruposPendientes = grupos.filter((grupo) =>
        gruposFallidos.has(`${grupo.bloqueIdx}-${grupo.bloqueId}`),
      )
      const idsFallidos = new Set(gruposPendientes.map((grupo) => grupo.bloqueId))
      const bloquesFallidos = bloquesActuales.filter((bloque) => idsFallidos.has(bloque.id))
      const gridFallido = gridVacio()
      for (const grupo of gruposPendientes) {
        for (const diaIdx of grupo.diasIdx) {
          gridFallido[grupo.bloqueIdx][diaIdx] = grupo.bloqueId
        }
      }
      setAsignacionesPendientes({ idFicha: fichaSeleccionada.idFicha, bloques: bloquesFallidos, grid: gridFallido })
      setCargandoHorarioFicha(true)
      setRecargaHorarioFicha((valor) => valor + 1)
    }
    setGuardando(false)
  }

  const horariosFichaActual = horariosFicha?.idFicha === idFichaSeleccionada ? horariosFicha.datos : null
  const horarioConvertido = horariosFichaActual ? convertirHorariosAGrid(horariosFichaActual) : null
  const borradorFichaActual = asignacionesPendientes?.idFicha === idFichaSeleccionada ? asignacionesPendientes : null
  const bloquesInicialesFicha = [...(horarioConvertido?.bloques ?? []), ...(borradorFichaActual?.bloques ?? [])]
  const gridInicialFicha = (horarioConvertido?.grid ?? gridVacio()).map((fila, bloqueIdx) =>
    fila.map((bloqueId, diaIdx) => bloqueId ?? borradorFichaActual?.grid[bloqueIdx]?.[diaIdx] ?? null),
  )
  const horariosNoRepresentados = horariosFichaActual && horarioConvertido
    ? horariosFichaActual.length - new Set(horarioConvertido.grid.flat().filter(Boolean)).size
    : 0
  const fichasVisibles = (catalogos?.fichas ?? []).filter((item) => {
    const texto = `${item.codigoFicha} ${item.programa.nombrePrograma}`.toLocaleLowerCase('es-CO')
    const coincideTexto = texto.includes(busquedaFicha.trim().toLocaleLowerCase('es-CO'))
    const coincideJornada =
      filtroJornada === 'Todas' ||
      item.jornadas.some((jornada) => jornada.toLocaleLowerCase('es-CO').includes(filtroJornada.toLocaleLowerCase('es-CO')))
    return coincideTexto && coincideJornada
  })

  return (
    <AppShell activo="Horarios">
      <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant print:hidden">
        <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
        <span className="text-outline">/</span>
        <span className="font-semibold text-primary">Constructor de Horarios</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-on-surface dark:text-slate-100">
              {datosEdicion ? 'Modificar horario' : 'Constructor de Horarios'}
            </h1>
            <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-[11px] font-semibold text-on-secondary-container">
              {datosEdicion ? 'Modo edición' : 'Nuevo horario'}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">
            {datosEdicion
              ? edicionSegura
                ? 'Los cambios se validan y reemplazan juntos en el servidor; si alguno falla, se conserva el horario original.'
                : 'Este snapshot no dispone de vínculos completos con las clases originales y no puede editarse de forma segura.'
              : 'Selecciona una ficha para consultar lo que ya tiene asignado y completar su horario sin duplicar las clases existentes.'}
          </p>
          {catalogos && (
            <p className="mt-1 text-xs text-on-surface-variant dark:text-slate-400">
              {catalogos.fichas.length} fichas · {catalogos.instructores.length} instructores · {catalogos.ambientes.length} ambientes disponibles
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {!idEditar && (
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface">
              <input type="checkbox" checked={guardarComoBorrador} onChange={(evento) => setGuardarComoBorrador(evento.target.checked)} disabled={guardando} className="accent-primary" />
              Guardar como borrador
            </label>
          )}
          <Link
            to={datosEdicion ? '/horarios/historial' : '/dashboard'}
            className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </Link>
          <ExportarPdfButton etiqueta="Exportar a PDF" />
          <button
            type="button"
            onClick={() => void guardarHorario()}
            disabled={guardando || !catalogos || cargandoEdicion || (idEditar !== null && !edicionSegura) || (idEditar === null && (!fichaSeleccionada || cargandoHorarioFicha || errorHorarioFicha !== null))}
            title={idEditar !== null && !edicionSegura ? 'Snapshot incompleto: no se puede editar de forma segura' : !catalogos ? 'Cargando catálogos…' : cargandoEdicion ? 'Cargando horario a modificar…' : !fichaSeleccionada ? 'Selecciona una ficha antes de guardar' : cargandoHorarioFicha ? 'Cargando asignaciones de la ficha…' : errorHorarioFicha ? 'Reintenta la carga del horario antes de guardar' : undefined}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : idEditar !== null ? 'Guardar cambios' : guardarComoBorrador ? 'Guardar borrador' : 'Guardar y publicar'}
          </button>
        </div>
      </div>

      {errorCatalogos && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorCatalogos}
        </p>
      )}

      {errorEdicion && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {errorEdicion}
        </p>
      )}

      {erroresGuardar.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="mb-1 font-semibold">No se pudo completar el guardado:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {erroresGuardar.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {mensajeExito && (
        <p className="mb-4 rounded-xl border border-primary/30 bg-primary-container px-3 py-2 text-sm text-on-primary-container print:hidden dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {mensajeExito}
        </p>
      )}

      <div className={`grid gap-4 ${idEditar ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : 'xl:grid-cols-[18rem_minmax(0,1fr)_17rem]'}`}>
        {!idEditar && (
          <section
            className="flex h-[38rem] max-h-[calc(100vh-10rem)] min-h-0 min-w-0 flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800"
            aria-label="Selección de ficha"
          >
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-on-surface dark:text-slate-100">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">layers</span>
              Selección de Ficha
            </h2>
            <p className="mb-3 text-xs text-on-surface-variant dark:text-slate-400">
              Elige una ficha para consultar y completar su horario.
            </p>
            <label htmlFor="buscar-ficha-constructor" className="sr-only">Buscar ficha o programa</label>
            <input
              id="buscar-ficha-constructor"
              value={busquedaFicha}
              onChange={(evento) => setBusquedaFicha(evento.target.value)}
              placeholder="Buscar ficha o programa"
              className="mb-3 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Filtrar fichas por jornada">
              {FILTROS_JORNADA.map((jornada) => (
                <button
                  key={jornada}
                  type="button"
                  aria-pressed={filtroJornada === jornada}
                  onClick={() => setFiltroJornada(jornada)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    filtroJornada === jornada
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {jornada}
                </button>
              ))}
            </div>
            {catalogos ? (
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {fichasVisibles.map((item) => {
                    const activa = item.idFicha === fichaSeleccionada?.idFicha
                    const jornadaPrincipal = item.jornadas[0]
                    return (
                      <li key={item.idFicha}>
                        <button
                          type="button"
                          aria-pressed={activa}
                          disabled={guardando || cargandoHorarioFicha}
                          onClick={() => {
                            if (idFichaSeleccionada === item.idFicha) return
                            if (hayCambiosPendientes && idFichaSeleccionada !== item.idFicha) {
                              setFichaPendiente(item)
                              return
                            }
                            aplicarSeleccionFicha(item)
                          }}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            activa
                              ? 'border-primary bg-primary-container/60 ring-1 ring-primary dark:bg-sena-950/40'
                              : 'border-outline-variant hover:bg-surface dark:border-slate-700 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-on-surface dark:text-slate-100">
                              Ficha {item.codigoFicha}
                            </span>
                            {jornadaPrincipal && (
                              <span className="shrink-0 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-semibold text-on-secondary-container">
                                {jornadaPrincipal}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-xs text-on-surface-variant dark:text-slate-400">
                            {item.programa.nombrePrograma}
                          </span>
                          {activa && horariosFicha?.idFicha === item.idFicha && (
                            <span className="mt-1 block text-[11px] font-medium text-primary">
                              {horariosFicha.datos.length === 0
                                ? 'Sin horario asignado'
                                : `${horariosFicha.datos.length} asignaciones existentes`}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                {fichaPendiente && (
                  <li className="rounded-xl border border-tertiary bg-tertiary-container p-3 text-xs text-on-tertiary-container">
                    <p>Hay bloques nuevos sin guardar. Si cambias de ficha, se descartarán.</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fichaPendiente && aplicarSeleccionFicha(fichaPendiente)}
                        className="rounded-lg bg-primary px-2.5 py-1.5 font-semibold text-on-primary"
                      >
                        Cambiar ficha
                      </button>
                      <button
                        type="button"
                        onClick={() => setFichaPendiente(null)}
                        className="rounded-lg border border-outline px-2.5 py-1.5 font-semibold text-on-surface-variant"
                      >
                        Seguir aquí
                      </button>
                    </div>
                  </li>
                )}
                {fichasVisibles.length === 0 && (
                  <li className="py-6 text-center text-sm text-on-surface-variant">
                    {catalogos.fichas.length === 0 ? 'No hay fichas disponibles.' : 'Sin resultados.'}
                  </li>
                )}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-on-surface-variant">Cargando fichas…</p>
            )}
          </section>
        )}

        <main className="min-w-0">
          {!catalogos || cargandoEdicion ? (
            !errorCatalogos && !errorEdicion && <p className="text-sm text-on-surface-variant">Cargando…</p>
          ) : idEditar ? (
            <HorarioEditor
              bloquesIniciales={datosEdicion?.bloques ?? []}
              gridInicial={datosEdicion?.grid ?? gridVacio()}
              onCambiarEstado={capturarEstadoActual}
              catalogos={catalogos}
            />
          ) : !fichaSeleccionada ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-6 py-20 text-center dark:border-slate-700 dark:bg-slate-800">
              <span className="material-symbols-outlined mb-3 text-4xl text-primary" aria-hidden="true">calendar_month</span>
              <h2 className="font-semibold text-on-surface dark:text-slate-100">Ninguna ficha seleccionada</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant dark:text-slate-400">
                Selecciona una ficha del panel para consultar su horario y comenzar a asignar bloques.
              </p>
            </div>
          ) : cargandoHorarioFicha ? (
            <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800">
              Cargando horario de la ficha {fichaSeleccionada.codigoFicha}…
            </p>
          ) : errorHorarioFicha ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <p>{errorHorarioFicha}</p>
              <button
                type="button"
                onClick={reintentarCargaHorarioFicha}
                className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950"
              >
                Reintentar
              </button>
            </div>
          ) : horariosFicha?.idFicha === fichaSeleccionada.idFicha ? (
            <>
              {horariosNoRepresentados > 0 && (
                <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {horariosNoRepresentados} asignación{horariosNoRepresentados === 1 ? '' : 'es'} no aparece{horariosNoRepresentados === 1 ? '' : 'n'} en la cuadrícula estándar por horario no representable o cruce de celdas. No se modificarán al guardar.
                </p>
              )}
              <HorarioEditor
                key={`ficha-${fichaSeleccionada.idFicha}-${versionEditor}`}
                bloquesIniciales={bloquesInicialesFicha}
                gridInicial={gridInicialFicha}
                onCambiarEstado={capturarEstadoActual}
                catalogos={catalogos}
                fichaFijada={fichaSeleccionada}
              />
            </>
          ) : null}
        </main>

        <aside className="flex flex-col gap-4 print:hidden">
          {!idEditar && fichaSeleccionada && (
            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface dark:text-slate-100">
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">assignment</span>
                Resumen de ficha
              </h2>
              <p className="font-semibold text-on-surface dark:text-slate-100">{fichaSeleccionada.codigoFicha}</p>
              <p className="text-xs text-on-surface-variant dark:text-slate-400">{fichaSeleccionada.programa.nombrePrograma}</p>
              <div className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs dark:bg-slate-900/60">
                {cargandoHorarioFicha
                  ? 'Consultando asignaciones…'
                  : errorHorarioFicha
                    ? 'No se pudo consultar el estado del horario.'
                    : `${horariosFicha?.datos.length ?? 0} asignaciones de horario`}
              </div>
            </section>
          )}
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-2 border-b border-outline-variant bg-error-container/40 px-4 py-3 dark:border-slate-700 dark:bg-red-950/20">
              <span className="material-symbols-outlined text-[18px] text-error dark:text-red-400">shield</span>
              <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Auditoría en Tiempo Real</p>
            </div>
            <div className="p-4">
              <p className="mb-3 text-xs text-on-surface-variant dark:text-slate-400">
                Consulta los cruces ya detectados entre horarios guardados de la sede antes de programar más clases —
                mismas 5 categorías del motor real: cruce de ficha, instructor, ambiente, resultado repetido y regla
                institucional (RF-011).
              </p>
              <Link
                to="/horarios/auditoria"
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-on-primary-container"
              >
                Ver auditoría de cruces →
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <p className="mb-2 font-semibold text-on-surface dark:text-slate-100">Dirección sede principal y sedes</p>
            <ul className="space-y-0.5">
              {SEDES.map((sede) => (
                <li key={sede.nombre}>
                  <span className="font-medium text-on-surface-variant dark:text-slate-300">{sede.nombre}:</span> {sede.direccion}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-on-surface-variant dark:text-slate-400">
              Plantilla base:{' '}
              <code className="rounded bg-surface-container px-1.5 py-0.5 dark:bg-slate-900 dark:text-slate-300">
                _Docs/Diseño/plantillas-institucionales/disponibilidad-ficha-3228973B.pdf
              </code>
              . Reglas de color/tipografía en{' '}
              <code className="rounded bg-surface-container px-1.5 py-0.5 dark:bg-slate-900 dark:text-slate-300">_Docs/Diseño/GUIA_DE_MARCA.md</code>.
            </p>
          </div>
        </aside>
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
