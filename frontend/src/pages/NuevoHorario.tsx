import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ExportarPdfButton } from '../components/ExportarPdfButton'
import { HorarioEditor } from '../components/horario/HorarioEditor'
import type { CatalogosBloque } from '../components/horario/ModalBloque'
import { apiGet, apiPost, ApiError } from '../services/api'
import { BLOQUES, DIAS } from './horario/tipos'
import type { BloqueClase, GridAsignaciones, Jornada as JornadaGrid } from './horario/tipos'
import { gridVacio } from './horario/useHorarioState'
import type {
  Ambiente,
  DiaSemana,
  Ficha,
  HorarioCreate,
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

export function NuevoHorario() {
  const [ficha, setFicha] = useState('')
  const [aprendices, setAprendices] = useState('0')
  const [horasTrimestre, setHorasTrimestre] = useState('36')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [erroresGuardar, setErroresGuardar] = useState<string[]>([])
  const [horariosPendientesForzar, setHorariosPendientesForzar] = useState<HorarioCreate[]>([])
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null)

  // El grid arranca vacío — a diferencia de la versión anterior (con datos
  // ficticios), ahora cada bloque de clase se elige de catálogos reales
  // (ver ModalBloque), así que no hay nada de ejemplo que mostrar hasta que
  // el coordinador arme el horario.
  const [{ bloques, grid }] = useState(() => ({ bloques: [] as BloqueClase[], grid: gridVacio() }))
  const estadoActualRef = useRef<{ bloques: BloqueClase[]; grid: GridAsignaciones }>({ bloques, grid })
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
  }, [])

  async function guardarHorario() {
    if (!catalogos) return

    setGuardando(true)
    setErroresGuardar([])
    setHorariosPendientesForzar([])
    setMensajeExito(null)

    const { bloques: bloquesActuales, grid: gridActual } = estadoActualRef.current
    const grupos = agruparCeldas(gridActual)
    const errores: string[] = []

    // Cada grupo se guarda o falla de forma independiente — si uno choca,
    // los demás igual se crean de verdad y quedan en el historial. Antes
    // esto era todo-o-nada: un solo cruce descartaba hasta las clases que
    // sí habían quedado guardadas en `horarios`.
    const gridExitoso: GridAsignaciones = gridVacio()
    const idsBloquesExitosos = new Set<string>()
    const pendientesForzar: HorarioCreate[] = []

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

      try {
        await apiPost('/horarios/', datos)
        idsBloquesExitosos.add(grupo.bloqueId)
        for (const diaIdx of grupo.diasIdx) {
          gridExitoso[grupo.bloqueIdx][diaIdx] = grupo.bloqueId
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const detalle = err.detail as { mensajes?: string[] } | null
          const mensajes = detalle?.mensajes ?? [err.message]
          errores.push(`${bloque.tematica} (${DIAS[grupo.diasIdx[0]]} ${bloqueHorario.horaInicio}): ${mensajes.join(' ')}`)
          pendientesForzar.push(datos)
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
      setMensajeExito(`${creados} clase${creados === 1 ? '' : 's'} guardada${creados === 1 ? '' : 's'} sin cruces.`)
    }

    setErroresGuardar(errores)
    setHorariosPendientesForzar(pendientesForzar)
    setGuardando(false)
  }

  async function guardarDeTodasFormas() {
    setGuardando(true)
    setErroresGuardar([])

    const errores: string[] = []
    for (const horario of horariosPendientesForzar) {
      try {
        await apiPost('/horarios/', { ...horario, forzar: true })
      } catch (err) {
        errores.push(err instanceof ApiError ? err.message : 'Error al guardar el horario forzado.')
      }
    }

    setHorariosPendientesForzar([])
    setErroresGuardar(errores)
    if (errores.length === 0) {
      setMensajeExito('Las clases con cruces permitidos se guardaron correctamente.')
    }
    setGuardando(false)
  }

  return (
    <AppShell activo="Horarios">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Nuevo horario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define un bloque de clase eligiendo de los catálogos reales y reutilízalo en el grid —
            al guardar, el sistema revisa cruces de ficha, instructor, ambiente y resultado
            repetido antes de crear cada clase.
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <Link
            to="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </Link>
          <ExportarPdfButton etiqueta="Exportar a PDF" />
          <button
            type="button"
            onClick={() => void guardarHorario()}
            disabled={guardando || !catalogos}
            title={!catalogos ? 'Cargando catálogos…' : undefined}
            className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar horario'}
          </button>
        </div>
      </div>

      {errorCatalogos && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {errorCatalogos}
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
          {horariosPendientesForzar.length > 0 && (
            <button
              type="button"
              onClick={() => void guardarDeTodasFormas()}
              disabled={guardando}
              className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800"
            >
              {guardando ? 'Programando…' : 'Programar de todas formas'}
            </button>
          )}
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
        {catalogos ? (
          <HorarioEditor
            bloquesIniciales={bloques}
            gridInicial={grid}
            onCambiarEstado={capturarEstadoActual}
            catalogos={catalogos}
          />
        ) : (
          !errorCatalogos && <p className="text-sm text-slate-500">Cargando catálogos…</p>
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
