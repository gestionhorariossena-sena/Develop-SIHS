import { Fragment, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, apiPost, apiPostForm, ApiError } from '../services/api'
import type {
  BloquePropuesto,
  Ficha,
  FichaCreate,
  FilaImportada,
  GenerarPropuestaResponse,
  HorarioDryRunRequest,
  HorarioDryRunResponse,
  ImportarExcelPreviewResponse,
  JornadaAsistente,
  Programa,
  RespuestaPreguntaHorario,
  Sede,
  Trimestre,
} from '../types/api'

/**
 * Asistente de programación -- wizard de 4 pasos, separado de
 * NuevoHorario.tsx (el "Constructor" manual de un horario a la vez, que
 * sigue existiendo tal cual). Este es el flujo de "tengo un Excel de
 * planeación del trimestre, ayúdame a armar la propuesta completa":
 *
 *   1. Subir archivo  -> POST /horarios/asistente/importar (IA clasifica columnas)
 *   2. Así lo entendimos -> revisión, nada se guarda todavía
 *   3. Así quedaría el horario -> POST /horarios/asistente/generar-propuesta
 *      (OR-Tools, Fase 4), más una pasada real de POST /horarios/validar
 *      por bloque como prueba completa antes de dejar confirmar
 *   4. Confirmar y guardar -> POST /horarios/ (ya existente) por cada bloque
 *
 * Principio que se mantiene en cada paso: nada se guarda en la base de
 * datos hasta que el coordinador lo confirma explícitamente en el paso 4.
 */

type Paso = 1 | 2 | 3 | 4

// El default de api.ts (15s) alcanza para CRUD normal, pero se queda corto
// para estos 3 pasos: parsean un Excel + llaman a Gemini, o corren el
// optimizador -- de verdad pueden tardar más, sobre todo en la primera
// llamada "fría" de la sesión.
const TIMEOUT_ASISTENTE_MS = 45000

const NOMBRES_DIA: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' }
const JORNADAS: { valor: JornadaAsistente; etiqueta: string }[] = [
  { valor: 'MAÑANA', etiqueta: 'Mañana' },
  { valor: 'TARDE', etiqueta: 'Tarde' },
  { valor: 'NOCHE', etiqueta: 'Noche' },
]

interface BloqueValidado extends BloquePropuesto {
  estado: 'validando' | 'sinCruces' | 'conflicto'
  mensajeConflicto?: string
}

const PASOS: { numero: Paso; titulo: string }[] = [
  { numero: 1, titulo: 'Subir archivo' },
  { numero: 2, titulo: 'Así lo entendimos' },
  { numero: 3, titulo: 'Así quedaría el horario' },
  { numero: 4, titulo: 'Confirmar y guardar' },
]

export function AsistenteHorarios() {
  const [paso, setPaso] = useState<Paso>(1)

  const [subiendo, setSubiendo] = useState(false)
  const [previsualizacion, setPrevisualizacion] = useState<ImportarExcelPreviewResponse | null>(null)
  const [errorImportar, setErrorImportar] = useState<string | null>(null)

  const [trimestres, setTrimestres] = useState<Trimestre[]>([])
  const [idTrimestre, setIdTrimestre] = useState<number | null>(null)
  const [jornada, setJornada] = useState<JornadaAsistente>('MAÑANA')

  // Paso 2 -- botón "Crear ficha" por fila, para las que no existen
  // todavía en el catálogo. `filaCreandoFicha` es el número de fila cuyo
  // formulario está abierto (uno a la vez).
  const [programas, setProgramas] = useState<Programa[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [filaCreandoFicha, setFilaCreandoFicha] = useState<number | null>(null)
  const [formCreacion, setFormCreacion] = useState<{ idPrograma: string; idTrimestre: string; idSede: string }>({
    idPrograma: '',
    idTrimestre: '',
    idSede: '',
  })
  const [creandoFicha, setCreandoFicha] = useState(false)
  const [errorCreacionFicha, setErrorCreacionFicha] = useState<string | null>(null)

  const [generando, setGenerando] = useState(false)
  const [propuesta, setPropuesta] = useState<GenerarPropuestaResponse | null>(null)
  const [bloques, setBloques] = useState<BloqueValidado[]>([])
  const [errorPropuesta, setErrorPropuesta] = useState<string | null>(null)

  const [pregunta, setPregunta] = useState('')
  const [respuestaPregunta, setRespuestaPregunta] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState(false)

  const [confirmando, setConfirmando] = useState(false)
  const [resultadosConfirmacion, setResultadosConfirmacion] = useState<Record<number, 'ok' | string>>({})

  useEffect(() => {
    apiGet<Trimestre[]>('/trimestres/')
      .then((lista) => {
        setTrimestres(lista)
        const activo = lista.find((t) => t.estado === 'activo') ?? lista[0]
        if (activo) setIdTrimestre(activo.idTrimestre)
      })
      .catch(() => {})
    apiGet<Programa[]>('/programas/').then(setProgramas).catch(() => {})
    apiGet<Sede[]>('/sedes').then(setSedes).catch(() => {})
  }, [])

  function abrirCreacionFicha(fila: FilaImportada) {
    setFilaCreandoFicha(fila.fila)
    setErrorCreacionFicha(null)
    // Intento simple de pre-selección: si el nombre del programa leído del
    // Excel coincide (sin importar mayúsculas) con uno ya existente, se
    // preselecciona -- el coordinador igual puede cambiarlo antes de crear.
    const coincidencia = fila.programa
      ? programas.find((p) => p.nombrePrograma.trim().toLowerCase() === fila.programa!.trim().toLowerCase())
      : undefined
    setFormCreacion({
      idPrograma: coincidencia ? String(coincidencia.idPrograma) : '',
      idTrimestre: idTrimestre ? String(idTrimestre) : '',
      idSede: '',
    })
  }

  async function crearFicha(fila: FilaImportada) {
    if (!fila.codigoFicha || !formCreacion.idPrograma || !formCreacion.idTrimestre) return
    setCreandoFicha(true)
    setErrorCreacionFicha(null)
    try {
      const data: FichaCreate = {
        codigoFicha: fila.codigoFicha,
        idPrograma: Number(formCreacion.idPrograma),
        idTrimestre: Number(formCreacion.idTrimestre),
        idSede: formCreacion.idSede ? Number(formCreacion.idSede) : null,
      }
      const creada = await apiPost<Ficha>('/fichas/', data)
      // Se actualiza la fila en el estado local -- no hace falta re-importar
      // el archivo entero solo para reflejar que esta ficha ya existe.
      setPrevisualizacion((previo) =>
        previo
          ? {
              ...previo,
              filas: previo.filas.map((f) =>
                f.fila === fila.fila ? { ...f, fichaExiste: true, idFicha: creada.idFicha, advertencia: null } : f
              ),
            }
          : previo
      )
      setFilaCreandoFicha(null)
    } catch (error) {
      setErrorCreacionFicha(error instanceof ApiError ? error.message : 'No se pudo crear la ficha.')
    } finally {
      setCreandoFicha(false)
    }
  }

  const idsFichaListas = useMemo(() => {
    if (!previsualizacion) return []
    const ids = previsualizacion.filas.filter((f) => f.fichaExiste && f.idFicha !== null).map((f) => f.idFicha as number)
    return Array.from(new Set(ids))
  }, [previsualizacion])

  async function manejarArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setSubiendo(true)
    setErrorImportar(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const resultado = await apiPostForm<ImportarExcelPreviewResponse>('/horarios/asistente/importar', formData, TIMEOUT_ASISTENTE_MS)
      setPrevisualizacion(resultado)
      setPaso(2)
    } catch (error) {
      setErrorImportar(error instanceof ApiError ? error.message : 'No se pudo procesar el archivo.')
    } finally {
      setSubiendo(false)
    }
  }

  async function generarPropuesta() {
    if (!idTrimestre || idsFichaListas.length === 0) return
    setGenerando(true)
    setErrorPropuesta(null)
    setPropuesta(null)
    setBloques([])
    try {
      const resultado = await apiPost<GenerarPropuestaResponse>(
        '/horarios/asistente/generar-propuesta',
        { idTrimestre, idsFicha: idsFichaListas, jornada },
        TIMEOUT_ASISTENTE_MS
      )
      setPropuesta(resultado)
      if (!resultado.factible || resultado.bloques.length === 0) return

      const enValidacion: BloqueValidado[] = resultado.bloques.map((b) => ({ ...b, estado: 'validando' }))
      setBloques(enValidacion)

      // "Prueba completa" antes de dejar confirmar: cada bloque propuesto
      // pasa por el mismo dry-run real que usa el Constructor manual
      // (POST /horarios/validar), no una simulación aparte.
      const validados = await Promise.all(
        resultado.bloques.map(async (b) => {
          const dryRun: HorarioDryRunRequest = {
            horaInicio: b.horaInicio,
            horaFin: b.horaFin,
            idJornada: b.idJornada,
            idTrimestre,
            idAmbiente: b.idAmbiente,
            idInstructor: b.idInstructor,
            idFicha: b.idFicha,
            idResultado: b.idResultado,
            dias: b.dias,
          }
          try {
            const respuesta = await apiPost<HorarioDryRunResponse>('/horarios/validar', dryRun)
            return { ...b, estado: 'sinCruces' as const, mensajeConflicto: respuesta.conflictos[0]?.mensaje }
          } catch (error) {
            const mensaje = error instanceof ApiError ? error.message : 'No se pudo validar este bloque.'
            return { ...b, estado: 'conflicto' as const, mensajeConflicto: mensaje }
          }
        })
      )
      setBloques(validados)
    } catch (error) {
      setErrorPropuesta(error instanceof ApiError ? error.message : 'No se pudo generar la propuesta.')
    } finally {
      setGenerando(false)
    }
  }

  async function preguntar() {
    if (!pregunta.trim()) return
    setPreguntando(true)
    setRespuestaPregunta(null)
    try {
      const contexto = propuesta
        ? `Propuesta con ${propuesta.bloques.length} bloques para el trimestre ${idTrimestre}, jornada ${jornada}.`
        : `Archivo ${previsualizacion?.nombreArchivo ?? ''} con ${previsualizacion?.totalFilas ?? 0} filas, ${previsualizacion?.filasConAdvertencia ?? 0} con advertencia.`
      const resultado = await apiPost<RespuestaPreguntaHorario>(
        '/horarios/asistente/preguntar',
        { pregunta, contexto },
        TIMEOUT_ASISTENTE_MS
      )
      setRespuestaPregunta(resultado.respuesta)
    } catch (error) {
      setRespuestaPregunta(error instanceof ApiError ? error.message : 'No se pudo responder la pregunta.')
    } finally {
      setPreguntando(false)
    }
  }

  async function confirmarYGuardar() {
    const bloquesListos = bloques.filter((b) => b.estado === 'sinCruces')
    if (bloquesListos.length === 0 || !idTrimestre) return
    setConfirmando(true)
    const resultados: Record<number, 'ok' | string> = {}
    for (let i = 0; i < bloquesListos.length; i++) {
      const b = bloquesListos[i]
      try {
        await apiPost('/horarios/', {
          horaInicio: b.horaInicio,
          horaFin: b.horaFin,
          idJornada: b.idJornada,
          idTrimestre,
          idAmbiente: b.idAmbiente,
          idInstructor: b.idInstructor,
          idFicha: b.idFicha,
          idResultado: b.idResultado,
          dias: b.dias,
        })
        resultados[i] = 'ok'
      } catch (error) {
        resultados[i] = error instanceof ApiError ? error.message : 'No se pudo guardar.'
      }
      setResultadosConfirmacion({ ...resultados })
    }
    setConfirmando(false)
  }

  const bloquesListos = bloques.filter((b) => b.estado === 'sinCruces')
  const bloquesConConflicto = bloques.filter((b) => b.estado === 'conflicto')

  return (
    <AppShell activo="Asistente IA">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Asistente de programación</p>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-on-surface dark:text-slate-100">Organizar horario semanal de fichas</h1>
          <span className="whitespace-nowrap rounded-full bg-sena-50 px-3 py-1 text-xs font-semibold text-sena-700 dark:bg-sena-950/40 dark:text-sena-300">
            Tú tienes el control total
          </span>
        </div>
        <p className="mb-6 text-sm text-on-surface-variant dark:text-slate-400">
          Estás viendo una propuesta en borrador. Nada se guardará en el sistema hasta que tú lo apruebes en el paso final.
        </p>

        <ol className="mb-6 grid grid-cols-4 gap-2">
          {PASOS.map((p) => (
            <li
              key={p.numero}
              className={`rounded-xl border px-3 py-2 text-sm ${
                p.numero === paso
                  ? 'border-primary bg-sena-50 font-semibold text-primary dark:bg-sena-950/40 dark:text-sena-300'
                  : p.numero < paso
                    ? 'border-outline-variant bg-surface-container-lowest text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    : 'border-outline-variant bg-surface text-on-surface-variant opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
              }`}
            >
              <span className="block text-xs">Paso {p.numero}</span>
              {p.titulo}
            </li>
          ))}
        </ol>

        {paso === 1 && (
          <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 dark:border-slate-700 dark:bg-slate-800">
            <p className="mb-3 text-sm text-on-surface-variant dark:text-slate-300">
              Sube el Excel de planeación del trimestre. Revisamos lo que trae antes de tocar nada.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => void manejarArchivo(e)}
              disabled={subiendo}
              aria-label="Seleccionar archivo Excel"
              className="block w-full text-sm text-on-surface-variant file:mr-3 file:rounded-xl file:border-0 file:bg-sena-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-700 dark:text-slate-300 dark:file:bg-sena-950/50 dark:file:text-sena-400"
            />
            {subiendo && <p className="mt-3 text-sm text-on-surface-variant dark:text-slate-400">Leyendo el archivo…</p>}
            {errorImportar && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorImportar}</p>
            )}
          </section>
        )}

        {paso === 2 && previsualizacion && (
          <section className="space-y-4">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm font-semibold text-on-surface dark:text-slate-100">
                Archivo procesado: {previsualizacion.nombreArchivo}{' '}
                <span className="font-normal text-on-surface-variant dark:text-slate-400">
                  · {previsualizacion.totalFilas} filas · {idsFichaListas.length} fichas listas para programar
                </span>
              </p>
              {previsualizacion.filasConAdvertencia > 0 && (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  {previsualizacion.filasConAdvertencia} fila(s) necesitan revisión — no se van a programar todavía.
                </p>
              )}
            </div>

            {previsualizacion.advertenciaGeneral && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {previsualizacion.advertenciaGeneral}
              </div>
            )}

            <div className="overflow-auto rounded-xl border border-outline-variant dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface font-semibold uppercase text-on-surface-variant dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Ficha</th>
                    <th className="px-3 py-2">Programa</th>
                    <th className="px-3 py-2">Jornada</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant dark:divide-slate-700">
                  {previsualizacion.filas.map((f) => (
                    <Fragment key={f.fila}>
                      <tr>
                        <td className="px-3 py-2 text-on-surface dark:text-slate-200">{f.codigoFicha ?? '—'}</td>
                        <td className="px-3 py-2 text-on-surface-variant dark:text-slate-300">{f.programa ?? '—'}</td>
                        <td className="px-3 py-2 text-on-surface-variant dark:text-slate-300">{f.jornada ?? '—'}</td>
                        <td className="px-3 py-2">
                          {f.advertencia ? (
                            <span className="text-amber-700 dark:text-amber-400">{f.advertencia}</span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">Listo</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!f.fichaExiste && f.codigoFicha && (
                            <button
                              type="button"
                              onClick={() => (filaCreandoFicha === f.fila ? setFilaCreandoFicha(null) : abrirCreacionFicha(f))}
                              className="font-medium text-primary hover:underline dark:text-sena-400"
                            >
                              {filaCreandoFicha === f.fila ? 'Cancelar' : 'Crear ficha'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {filaCreandoFicha === f.fila && (
                        <tr>
                          <td colSpan={5} className="bg-surface px-3 py-3 dark:bg-slate-900">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-xs text-on-surface-variant dark:text-slate-300">
                                Programa
                                <select
                                  value={formCreacion.idPrograma}
                                  onChange={(e) => setFormCreacion((s) => ({ ...s, idPrograma: e.target.value }))}
                                  className="mt-1 block rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <option value="">Selecciona…</option>
                                  {programas.map((p) => (
                                    <option key={p.idPrograma} value={p.idPrograma}>
                                      {p.nombrePrograma}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs text-on-surface-variant dark:text-slate-300">
                                Trimestre
                                <select
                                  value={formCreacion.idTrimestre}
                                  onChange={(e) => setFormCreacion((s) => ({ ...s, idTrimestre: e.target.value }))}
                                  className="mt-1 block rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <option value="">Selecciona…</option>
                                  {trimestres.map((t) => (
                                    <option key={t.idTrimestre} value={t.idTrimestre}>
                                      {t.nombre}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs text-on-surface-variant dark:text-slate-300">
                                Sede (opcional)
                                <select
                                  value={formCreacion.idSede}
                                  onChange={(e) => setFormCreacion((s) => ({ ...s, idSede: e.target.value }))}
                                  className="mt-1 block rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <option value="">Sin definir</option>
                                  {sedes.map((s) => (
                                    <option key={s.idSede} value={s.idSede}>
                                      {s.nombreSede}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                disabled={creandoFicha || !formCreacion.idPrograma || !formCreacion.idTrimestre}
                                onClick={() => void crearFicha(f)}
                                className="rounded-lg bg-sena-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {creandoFicha ? 'Creando…' : `Crear ficha ${f.codigoFicha}`}
                              </button>
                              {!programas.some((p) => String(p.idPrograma) === formCreacion.idPrograma) && f.programa && (
                                <span className="text-xs text-amber-700 dark:text-amber-400">
                                  No encontramos "{f.programa}" en Programas -- créalo ahí primero si no existe.
                                </span>
                              )}
                              {errorCreacionFicha && <span className="text-xs text-red-700 dark:text-red-400">{errorCreacionFicha}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-on-surface-variant dark:text-slate-300">
                Trimestre
                <select
                  value={idTrimestre ?? ''}
                  onChange={(e) => setIdTrimestre(Number(e.target.value))}
                  className="ml-2 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {trimestres.map((t) => (
                    <option key={t.idTrimestre} value={t.idTrimestre}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-on-surface-variant dark:text-slate-300">
                Jornada
                <select
                  value={jornada}
                  onChange={(e) => setJornada(e.target.value as JornadaAsistente)}
                  className="ml-2 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {JORNADAS.map((j) => (
                    <option key={j.valor} value={j.valor}>
                      {j.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={() => setPaso(1)} className="text-sm font-medium text-on-surface-variant hover:text-on-surface dark:text-slate-400">
                ← Volver
              </button>
              <button
                type="button"
                disabled={idsFichaListas.length === 0 || !idTrimestre}
                onClick={() => {
                  setPaso(3)
                  void generarPropuesta()
                }}
                className="rounded-xl bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar con {idsFichaListas.length} ficha{idsFichaListas.length === 1 ? '' : 's'}
              </button>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="mb-2 text-sm font-semibold text-on-surface dark:text-slate-100">¿En qué te puedo ayudar con este horario?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  placeholder="Ej. ¿por qué esta ficha no se pudo programar?"
                  className="flex-1 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => void preguntar()}
                  disabled={preguntando || !pregunta.trim()}
                  className="rounded-xl bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {preguntando ? 'Preguntando…' : 'Preguntar'}
                </button>
              </div>
              {respuestaPregunta && (
                <p className="mt-3 rounded-xl bg-sena-50 px-3 py-2 text-sm text-on-surface dark:bg-sena-950/30 dark:text-slate-200">{respuestaPregunta}</p>
              )}
            </div>

            {generando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Armando tu horario…</p>}
            {errorPropuesta && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorPropuesta}</p>}
            {propuesta && !propuesta.factible && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{propuesta.mensaje}</p>
            )}

            {bloquesConConflicto.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {bloquesConConflicto.length} bloque(s) tuvieron un cruce al revisarlos de nuevo y no se van a guardar. Puedes generar la propuesta otra vez.
              </div>
            )}

            {bloques.length > 0 && (
              <div className="overflow-auto rounded-xl border border-outline-variant dark:border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface font-semibold uppercase text-xs text-on-surface-variant dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Ficha</th>
                      <th className="px-3 py-2">Instructor</th>
                      <th className="px-3 py-2">Ambiente</th>
                      <th className="px-3 py-2">Días</th>
                      <th className="px-3 py-2">Hora</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant dark:divide-slate-700">
                    {bloques.map((b, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-on-surface dark:text-slate-200">{b.fichaCodigo}</td>
                        <td className="px-3 py-2 text-on-surface-variant dark:text-slate-300">{b.instructorNombre}</td>
                        <td className="px-3 py-2 text-on-surface-variant dark:text-slate-300">{b.ambienteNombre}</td>
                        <td className="px-3 py-2 text-on-surface-variant dark:text-slate-300">
                          {b.dias.map((d) => NOMBRES_DIA[d]).join(', ')}
                        </td>
                        <td className="px-3 py-2 text-on-surface-variant dark:text-slate-300">
                          {b.horaInicio.slice(0, 5)}–{b.horaFin.slice(0, 5)}
                        </td>
                        <td className="px-3 py-2">
                          {b.estado === 'validando' && <span className="text-on-surface-variant dark:text-slate-400">Revisando…</span>}
                          {b.estado === 'sinCruces' && <span className="text-emerald-700 dark:text-emerald-400">Sin cruces ✓</span>}
                          {b.estado === 'conflicto' && <span className="text-red-700 dark:text-red-400">{b.mensajeConflicto ?? 'Conflicto'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between">
              <button type="button" onClick={() => setPaso(2)} className="text-sm font-medium text-on-surface-variant hover:text-on-surface dark:text-slate-400">
                ← Volver a revisión de datos
              </button>
              <button
                type="button"
                disabled={bloquesListos.length === 0 || generando}
                onClick={() => setPaso(4)}
                className="rounded-xl bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Todo se ve bien, ir a confirmar →
              </button>
            </div>
          </section>
        )}

        {paso === 4 && (
          <section className="space-y-4">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm text-on-surface-variant dark:text-slate-300">
                Vas a guardar <strong>{bloquesListos.length}</strong> horario{bloquesListos.length === 1 ? '' : 's'} nuevo{bloquesListos.length === 1 ? '' : 's'}. Esta es la última confirmación.
              </p>
            </div>

            <ul className="space-y-1 text-sm">
              {bloquesListos.map((b, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 dark:border-slate-700">
                  <span className="text-on-surface dark:text-slate-200">
                    Ficha {b.fichaCodigo} — {b.instructorNombre} — {b.dias.map((d) => NOMBRES_DIA[d]).join(', ')} {b.horaInicio.slice(0, 5)}–{b.horaFin.slice(0, 5)}
                  </span>
                  {resultadosConfirmacion[i] === 'ok' && <span className="text-emerald-700 dark:text-emerald-400">Guardado ✓</span>}
                  {resultadosConfirmacion[i] && resultadosConfirmacion[i] !== 'ok' && (
                    <span className="text-red-700 dark:text-red-400">{resultadosConfirmacion[i]}</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex justify-between">
              <button type="button" onClick={() => setPaso(3)} className="text-sm font-medium text-on-surface-variant hover:text-on-surface dark:text-slate-400">
                ← Volver
              </button>
              <button
                type="button"
                disabled={confirmando || Object.keys(resultadosConfirmacion).length === bloquesListos.length}
                onClick={() => void confirmarYGuardar()}
                className="rounded-xl bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmando ? 'Guardando…' : 'Confirmar y guardar en BD'}
              </button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
