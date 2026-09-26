import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DrawerRelacionados, SeccionDrawer } from '../components/relacionados/DrawerRelacionados'
import { apiGet, apiPost, apiPostForm, ApiError } from '../services/api'
import type {
  CompetenciaFormacionCreate,
  CompetenciaFormacionResponse,
  Ficha,
  PreviewCurriculoResponse,
  Programa,
  ResultadoAprendizajeCreate,
} from '../types/api'

type Orden = 'codigo' | 'nombre' | 'nivel'
type Estado = 'todos' | 'activo' | 'inactivo'

const POR_PAGINA = 10

export function Programas() {
  const [searchParams] = useSearchParams()
  const idDesdeUrl = searchParams.get('id')
  const [programas, setProgramas] = useState<Programa[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [nivelFormacion, setNivelFormacion] = useState('todos')
  const [estado, setEstado] = useState<Estado>('todos')
  const [orden, setOrden] = useState<Orden>('codigo')
  const [paginaActual, setPaginaActual] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Programa | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Importar competencias/resultados de aprendizaje desde el Formato de
  // Planeación Pedagógica real de SENA -- ver PLAN_INTEGRACION_IA.md.
  // Solo Administrador puede confirmar (mismo permiso que
  // POST /competencias-formacion/ y /resultados-aprendizaje/ ya exigían).
  const [subiendoCurriculo, setSubiendoCurriculo] = useState(false)
  const [previewCurriculo, setPreviewCurriculo] = useState<PreviewCurriculoResponse | null>(null)
  const [errorCurriculo, setErrorCurriculo] = useState<string | null>(null)
  const [importandoCurriculo, setImportandoCurriculo] = useState(false)
  const [resultadoImportacion, setResultadoImportacion] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Programa[]>('/programas/')
      .then((datos) => {
        setProgramas(datos)

        // Deep link (ej. desde Fichas.tsx → "Ver programa"): abre el
        // drawer de ese programa directo — mismo patrón que Fichas.tsx.
        if (idDesdeUrl) {
          const encontrado = datos.find((programa) => programa.idPrograma === Number(idDesdeUrl))
          if (encontrado) setSeleccionado(encontrado)
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado de programas.'))
      .finally(() => setCargando(false))

    // Sin .catch dedicado no rompe nada visible (el conteo de fichas cae a
    // 0 si falla), pero deja una unhandled rejection en tests — mismo
    // patrón que Fichas.tsx/Ambientes.tsx con /horarios/.
    apiGet<Ficha[]>('/fichas/')
      .then(setFichas)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar; idDesdeUrl no cambia en la vida del componente.
  }, [])

  const fichasPorPrograma = useMemo(() => {
    const mapa = new Map<number, Ficha[]>()
    for (const ficha of fichas) {
      const actuales = mapa.get(ficha.idPrograma) ?? []
      actuales.push(ficha)
      mapa.set(ficha.idPrograma, actuales)
    }
    return mapa
  }, [fichas])

  const fichasDelSeleccionado = seleccionado ? fichasPorPrograma.get(seleccionado.idPrograma) ?? [] : []

  async function subirCurriculo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setSubiendoCurriculo(true)
    setErrorCurriculo(null)
    setResultadoImportacion(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const resultado = await apiPostForm<PreviewCurriculoResponse>(
        '/competencias-formacion/importar-vista-previa',
        formData,
        45000
      )
      setPreviewCurriculo(resultado)
    } catch (error) {
      setErrorCurriculo(error instanceof ApiError ? error.message : 'No se pudo leer el archivo.')
    } finally {
      setSubiendoCurriculo(false)
    }
  }

  async function confirmarImportacionCurriculo() {
    if (!previewCurriculo || !seleccionado) return
    setImportandoCurriculo(true)
    setResultadoImportacion(null)
    let competenciasCreadas = 0
    let resultadosCreados = 0
    const errores: string[] = []

    for (const competencia of previewCurriculo.competencias) {
      try {
        const creada = await apiPost<CompetenciaFormacionResponse>('/competencias-formacion/', {
          descripcion: competencia.descripcion,
          idPrograma: seleccionado.idPrograma,
        } satisfies CompetenciaFormacionCreate)
        competenciasCreadas++

        for (const resultado of competencia.resultados) {
          try {
            await apiPost('/resultados-aprendizaje/', {
              descripcion: resultado.descripcion,
              idCompetencia: creada.idCompetencia,
              horasAsignadas: resultado.horasAsignadas,
              numeroFase: resultado.numeroFase,
            } satisfies ResultadoAprendizajeCreate)
            resultadosCreados++
          } catch (error) {
            errores.push(error instanceof ApiError ? error.message : 'No se pudo crear un resultado.')
          }
        }
      } catch (error) {
        errores.push(error instanceof ApiError ? error.message : 'No se pudo crear una competencia.')
      }
    }

    setResultadoImportacion(
      `${competenciasCreadas} competencias y ${resultadosCreados} resultados creados.` +
        (errores.length > 0 ? ` ${errores.length} fallaron.` : '')
    )
    setPreviewCurriculo(null)
    setImportandoCurriculo(false)
  }

  const niveles = [...new Set(programas.map((programa) => programa.nivelFormacion || 'Sin definir'))].sort()
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const filtrosActivos =
    Number(Boolean(busqueda.trim())) + Number(nivelFormacion !== 'todos') + Number(estado !== 'todos')
  const visibles = programas.filter((programa) => {
    const coincideTexto = !texto || `${programa.codigoPrograma} ${programa.nombrePrograma}`.toLocaleLowerCase('es-CO').includes(texto)
    const coincideNivel = nivelFormacion === 'todos' || (programa.nivelFormacion || 'Sin definir') === nivelFormacion
    const coincideEstado = estado === 'todos' || (estado === 'activo') === programa.activo
    return coincideTexto && coincideNivel && coincideEstado
  }).sort((primero, segundo) => {
    if (orden === 'nombre') return primero.nombrePrograma.localeCompare(segundo.nombrePrograma, 'es-CO')
    if (orden === 'nivel') return (primero.nivelFormacion || '').localeCompare(segundo.nivelFormacion || '', 'es-CO')
    return primero.codigoPrograma.localeCompare(segundo.codigoPrograma, 'es-CO', { numeric: true })
  })

  // Mismo patrón clamped que Fichas.tsx: sin useEffect de reseteo.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const inicioPagina = (paginaSegura - 1) * POR_PAGINA
  const visiblesPagina = visibles.slice(inicioPagina, inicioPagina + POR_PAGINA)

  return (
    <AppShell activo="Programas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">Programas</h1>
          <p className="text-sm text-on-surface-variant dark:text-slate-400">Programas de formación registrados, con sus fichas y trimestre.</p>
        </div>
        <p className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{visibles.length} de {programas.length} programas</p>
      </div>

      <section className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de programas">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-on-surface dark:text-slate-100">Filtrar programas</p>
            {filtrosActivos > 0 && <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-primary dark:bg-sena-950/50">{filtrosActivos} activo{filtrosActivos === 1 ? '' : 's'}</span>}
            {filtrosActivos > 0 && <button type="button" onClick={() => { setBusqueda(''); setNivelFormacion('todos'); setEstado('todos') }} className="text-sm font-medium text-primary hover:text-on-primary-container dark:text-sena-400">Limpiar filtros</button>}
          </div>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">Activos</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{programas.filter((programa) => programa.activo).length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">Fichas totales</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{fichas.length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/70">Niveles</p><p className="text-sm font-bold text-on-surface dark:text-slate-100">{niveles.length}</p></div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="buscar-programa" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Buscar</label>
            <input id="buscar-programa" value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setPaginaActual(1) }} placeholder="Código o nombre" className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label htmlFor="filtro-nivel-programa" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Nivel</label>
            <select id="filtro-nivel-programa" value={nivelFormacion} onChange={(evento) => { setNivelFormacion(evento.target.value); setPaginaActual(1) }} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              {niveles.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-estado-programa" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Estado</label>
            <select id="filtro-estado-programa" value={estado} onChange={(evento) => { setEstado(evento.target.value as Estado); setPaginaActual(1) }} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="todos">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div>
            <label htmlFor="orden-programa" className="mb-1.5 block text-xs font-medium text-on-surface-variant dark:text-slate-400">Ordenar por</label>
            <select id="orden-programa" value={orden} onChange={(evento) => setOrden(evento.target.value as Orden)} className="w-full rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <option value="codigo">Código</option>
              <option value="nombre">Nombre</option>
              <option value="nivel">Nivel</option>
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">Cargando programas...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface text-xs font-semibold uppercase text-on-surface-variant dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Programa</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Fichas</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant dark:divide-slate-700">
                {visiblesPagina.map((programa) => (
                  <tr
                    key={programa.idPrograma}
                    onClick={() => {
                      setSeleccionado(programa)
                      setPreviewCurriculo(null)
                      setErrorCurriculo(null)
                      setResultadoImportacion(null)
                    }}
                    className="cursor-pointer hover:bg-surface dark:hover:bg-slate-700/60"
                  >
                    <td className="px-4 py-3 font-semibold text-on-surface dark:text-slate-100">{programa.codigoPrograma}</td>
                    <td className="px-4 py-3 text-on-surface-variant dark:text-slate-300">{programa.nombrePrograma}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-primary dark:bg-sena-950/50">{programa.nivelFormacion || 'Sin definir'}</span></td>
                    <td className="px-4 py-3 font-medium text-on-surface dark:text-slate-300">{(fichasPorPrograma.get(programa.idPrograma) ?? []).length}</td>
                    <td className="px-4 py-3">
                      <span className={programa.activo ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'}>
                        {programa.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibles.length === 0 && <p className="px-4 py-12 text-center text-sm text-on-surface-variant dark:text-slate-400">No hay programas que coincidan con los filtros.</p>}

          {visibles.length > 0 && (
            <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3 dark:border-slate-700">
              <p className="text-xs text-on-surface-variant dark:text-slate-400">Página {paginaSegura} de {totalPaginas}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))}
                  disabled={paginaSegura === 1}
                  className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))}
                  disabled={paginaSegura === totalPaginas}
                  className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {seleccionado && (
        <DrawerRelacionados
          iniciales={seleccionado.codigoPrograma.slice(0, 2).toUpperCase()}
          titulo={seleccionado.nombrePrograma}
          subtitulo={seleccionado.codigoPrograma}
          onCerrar={() => {
            setSeleccionado(null)
            setPreviewCurriculo(null)
            setErrorCurriculo(null)
            setResultadoImportacion(null)
          }}
        >
          <dl className="space-y-4 text-sm">
            <div><dt className="text-on-surface-variant dark:text-slate-400">Código del programa</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionado.codigoPrograma}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Nivel de formación</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionado.nivelFormacion || 'Sin definir'}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Estado</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{seleccionado.activo ? 'Activo' : 'Inactivo'}</dd></div>
            <div><dt className="text-on-surface-variant dark:text-slate-400">Fichas asociadas</dt><dd className="mt-1 font-medium text-on-surface dark:text-slate-100">{fichasDelSeleccionado.length}</dd></div>
          </dl>

          <SeccionDrawer titulo="Competencias y resultados de aprendizaje">
            <p className="mb-3 text-sm text-on-surface-variant dark:text-slate-400">
              Sube el Formato de Planeación Pedagógica de este programa (Excel real de SENA, columnas "COMPETENCIA" /
              "RESULTADOS DE APRENDIZAJE") para cargar su contenido curricular -- sin esto, el asistente de
              programación no tiene qué programar en las fichas de este programa. Requiere rol Administrador.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => void subirCurriculo(e)}
              disabled={subiendoCurriculo}
              aria-label="Seleccionar archivo de plan curricular"
              className="block w-full text-sm text-on-surface-variant file:mr-3 file:rounded-xl file:border-0 file:bg-sena-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sena-700 dark:text-slate-300 dark:file:bg-sena-950/50 dark:file:text-sena-400"
            />
            {subiendoCurriculo && <p className="mt-2 text-sm text-on-surface-variant dark:text-slate-400">Leyendo el archivo…</p>}
            {errorCurriculo && (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorCurriculo}</p>
            )}
            {resultadoImportacion && (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                {resultadoImportacion}
              </p>
            )}

            {previewCurriculo && (
              <div className="mt-3 rounded-xl border border-outline-variant p-3 dark:border-slate-700">
                <p className="mb-2 text-sm font-semibold text-on-surface dark:text-slate-100">
                  Se encontraron {previewCurriculo.totalCompetencias} competencias y {previewCurriculo.totalResultados}{' '}
                  resultados de aprendizaje -- nada se ha guardado todavía.
                </p>
                <ul className="max-h-64 space-y-2 overflow-auto text-sm">
                  {previewCurriculo.competencias.map((competencia, i) => {
                    const fases = [...new Set(competencia.resultados.map((r) => r.numeroFase).filter((f): f is number => f !== null))].sort()
                    return (
                      <li key={i} className="rounded-lg bg-surface p-2 dark:bg-slate-900">
                        <p className="font-medium text-on-surface dark:text-slate-100">{competencia.descripcion.split('\n')[0]}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant dark:text-slate-400">
                          <span>{competencia.resultados.length} resultado(s)</span>
                          {fases.map((fase) => (
                            <span key={fase} className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                              TRIM {['I', 'II', 'III', 'IV'][fase - 1] ?? fase}
                            </span>
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <button
                  type="button"
                  disabled={importandoCurriculo}
                  onClick={() => void confirmarImportacionCurriculo()}
                  className="mt-3 rounded-xl bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importandoCurriculo ? 'Creando…' : `Confirmar e importar a ${seleccionado.nombrePrograma}`}
                </button>
              </div>
            )}
          </SeccionDrawer>

          <SeccionDrawer titulo="Fichas y trimestres">
            {fichasDelSeleccionado.length === 0 ? (
              <p className="text-sm text-on-surface-variant dark:text-slate-400">Este programa todavía no tiene fichas asociadas.</p>
            ) : (
              <div className="space-y-3">
                {fichasDelSeleccionado.map((ficha) => (
                  <div key={ficha.idFicha} className="rounded-xl border border-outline-variant p-3 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-on-surface dark:text-slate-100">{ficha.codigoFicha}</p>
                        <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">Trimestre: {ficha.trimestre.nombre}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{ficha.trimestre.estado}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SeccionDrawer>
        </DrawerRelacionados>
      )}
    </AppShell>
  )
}
