import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { Programa, TematicaCompetencia, TematicaResultado, Usuario } from '../types/api'

/**
 * T-8 (SCRUM-139): pestaña "Temáticas" del administrador. Una temática es
 * lo que el creador de horarios muestra en cada bloque: un resultado de
 * aprendizaje, agrupado bajo su competencia. La lista sale de
 * GET /tematicas/ (agrega competencias, resultados y cuántos bloques usa
 * cada uno); crear, editar y borrar siguen yendo a /competencias-formacion
 * y /resultados-aprendizaje, que solo acepta el Administrador.
 */

type Formulario =
  | { tipo: 'competencia'; id: number | null; codigo: string; descripcion: string; idPrograma: number }
  | {
      tipo: 'resultado'
      id: number | null
      idCompetencia: number
      codigo: string
      descripcion: string
      horasAsignadas: string
      numeroFase: string
      idGuia: number | null
    }

const CLASE_CAMPO =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sena-600 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
const CLASE_BOTON_SECUNDARIO =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'

function enteroONulo(valor: string): number | null {
  const limpio = valor.trim()
  if (!limpio) return null
  const numero = Number(limpio)
  return Number.isInteger(numero) && numero >= 0 ? numero : null
}

export function Tematicas() {
  const [programas, setProgramas] = useState<Programa[]>([])
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [idPrograma, setIdPrograma] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [tematicas, setTematicas] = useState<TematicaCompetencia[]>([])
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    apiGet<Programa[]>('/programas/')
      .then(setProgramas)
      .catch(() => setProgramas([]))
    apiGet<Usuario>('/usuarios/me')
      .then(setPerfil)
      .catch(() => setPerfil(null))
  }, [])

  // La búsqueda la resuelve el backend; se espera a que la persona deje de
  // escribir para no lanzar una petición por tecla.
  useEffect(() => {
    const parametros = new URLSearchParams()
    if (idPrograma !== null) parametros.set('id_programa', String(idPrograma))
    if (busqueda.trim()) parametros.set('busqueda', busqueda.trim())
    const consulta = parametros.toString()

    const temporizador = window.setTimeout(() => {
      apiGet<TematicaCompetencia[]>(`/tematicas/${consulta ? `?${consulta}` : ''}`)
        .then((datos) => {
          setTematicas(datos)
          setError(null)
        })
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las temáticas.'))
        .finally(() => setCargando(false))
    }, busqueda ? 300 : 0)

    return () => window.clearTimeout(temporizador)
  }, [idPrograma, busqueda, recarga])

  const esAdmin = perfil?.roles.some((rol) => rol.nombre === 'Administrador') ?? false

  const resumen = useMemo(() => {
    const resultados = tematicas.flatMap((t) => t.resultados)
    return {
      competencias: tematicas.length,
      resultados: resultados.length,
      horas: tematicas.reduce((total, t) => total + t.totalHoras, 0),
      sinProgramar: resultados.filter((r) => r.horariosAsignados === 0).length,
    }
  }, [tematicas])

  function alternar(idCompetencia: number) {
    setAbiertas((previas) => {
      const siguientes = new Set(previas)
      if (siguientes.has(idCompetencia)) siguientes.delete(idCompetencia)
      else siguientes.add(idCompetencia)
      return siguientes
    })
  }

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!formulario) return

    const descripcion = formulario.descripcion.trim()
    if (!descripcion) {
      setError('La descripción es obligatoria.')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      if (formulario.tipo === 'competencia') {
        const cuerpo = { codigo: formulario.codigo.trim() || null, descripcion, idPrograma: formulario.idPrograma }
        if (formulario.id === null) await apiPost('/competencias-formacion/', cuerpo)
        else await apiPut(`/competencias-formacion/${formulario.id}`, cuerpo)
      } else {
        const cuerpo = {
          codigo: formulario.codigo.trim() || null,
          descripcion,
          idCompetencia: formulario.idCompetencia,
          horasAsignadas: enteroONulo(formulario.horasAsignadas),
          numeroFase: enteroONulo(formulario.numeroFase),
          idGuia: formulario.idGuia,
        }
        if (formulario.id === null) await apiPost('/resultados-aprendizaje/', cuerpo)
        else await apiPut(`/resultados-aprendizaje/${formulario.id}`, cuerpo)
        setAbiertas((previas) => new Set(previas).add(formulario.idCompetencia))
      }
      setFormulario(null)
      setRecarga((n) => n + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(ruta: string) {
    setError(null)
    try {
      await apiDelete(ruta)
      setRecarga((n) => n + 1)
    } catch (err) {
      // El 409 trae el motivo concreto (bloques o resultados que la usan).
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar.')
    }
  }

  function editarResultado(idCompetencia: number, resultado: TematicaResultado) {
    setFormulario({
      tipo: 'resultado',
      id: resultado.idResultado,
      idCompetencia,
      codigo: resultado.codigo ?? '',
      descripcion: resultado.descripcion,
      horasAsignadas: resultado.horasAsignadas?.toString() ?? '',
      numeroFase: resultado.numeroFase?.toString() ?? '',
      idGuia: resultado.idGuia,
    })
  }

  return (
    <AppShell activo="Temáticas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Temáticas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Competencias y resultados de aprendizaje que se asignan a cada bloque del horario.
          </p>
        </div>
        {esAdmin && (
          <button
            type="button"
            disabled={idPrograma === null}
            title={idPrograma === null ? 'Elige un programa para agregarle una competencia.' : undefined}
            onClick={() =>
              idPrograma !== null &&
              setFormulario({ tipo: 'competencia', id: null, codigo: '', descripcion: '', idPrograma })
            }
            className="rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Nueva competencia
          </button>
        )}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Competencias', resumen.competencias],
          ['Resultados de aprendizaje', resumen.resultados],
          ['Horas del pénsum', resumen.horas],
          ['Resultados sin programar', resumen.sinProgramar],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{etiqueta}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{valor}</p>
          </div>
        ))}
      </section>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-700 dark:bg-slate-800">
        <label className="flex-1 text-sm text-slate-700 dark:text-slate-300">
          <span className="mb-1 block font-medium">Programa</span>
          <select
            aria-label="Programa"
            value={idPrograma ?? ''}
            onChange={(e) => setIdPrograma(e.target.value ? Number(e.target.value) : null)}
            className={CLASE_CAMPO}
          >
            <option value="">Todos los programas</option>
            {programas.map((programa) => (
              <option key={programa.idPrograma} value={programa.idPrograma}>
                {programa.nombrePrograma}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm text-slate-700 dark:text-slate-300">
          <span className="mb-1 block font-medium">Buscar</span>
          <input
            type="search"
            aria-label="Buscar temática"
            placeholder="Código o descripción"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {formulario && (
        <form
          onSubmit={(e) => void guardar(e)}
          aria-label={formulario.tipo === 'competencia' ? 'Formulario de competencia' : 'Formulario de resultado'}
          className="mb-6 grid gap-3 rounded-xl border border-sena-200 bg-white p-4 sm:grid-cols-2 dark:border-sena-900 dark:bg-slate-800"
        >
          <p className="font-semibold text-slate-900 sm:col-span-2 dark:text-slate-100">
            {formulario.id === null ? 'Nuevo' : 'Editar'} {formulario.tipo === 'competencia' ? 'competencia' : 'resultado de aprendizaje'}
          </p>
          <label className="text-sm text-slate-700 dark:text-slate-300">
            Código
            <input
              value={formulario.codigo}
              onChange={(e) => setFormulario({ ...formulario, codigo: e.target.value })}
              className={CLASE_CAMPO}
            />
          </label>
          <label className="text-sm text-slate-700 sm:col-span-2 dark:text-slate-300">
            Descripción
            <textarea
              required
              rows={2}
              value={formulario.descripcion}
              onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
              className={CLASE_CAMPO}
            />
          </label>
          {formulario.tipo === 'resultado' && (
            <>
              <label className="text-sm text-slate-700 dark:text-slate-300">
                Horas asignadas
                <input
                  type="number"
                  min={0}
                  value={formulario.horasAsignadas}
                  onChange={(e) => setFormulario({ ...formulario, horasAsignadas: e.target.value })}
                  className={CLASE_CAMPO}
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-300">
                Fase (trimestre del pénsum)
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={formulario.numeroFase}
                  onChange={(e) => setFormulario({ ...formulario, numeroFase: e.target.value })}
                  className={CLASE_CAMPO}
                />
              </label>
            </>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setFormulario(null)} className={CLASE_BOTON_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando temáticas...</p>
      ) : tematicas.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          No hay temáticas que coincidan con estos filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tematicas.map((competencia) => {
            const abierta = abiertas.has(competencia.idCompetencia)
            return (
              <li key={competencia.idCompetencia} className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => alternar(competencia.idCompetencia)}
                    aria-expanded={abierta}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span aria-hidden="true" className="mt-0.5 text-slate-400 dark:text-slate-500">{abierta ? '▾' : '▸'}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 dark:text-slate-100">
                        {competencia.codigo ? `${competencia.codigo} · ` : ''}
                        {competencia.descripcion}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {competencia.nombrePrograma ?? 'Sin programa'} · {competencia.resultados.length} resultado(s) ·{' '}
                        {competencia.totalHoras} h
                        {competencia.especialidades.length > 0 &&
                          ` · ${competencia.especialidades.map((e) => e.nombre).join(', ')}`}
                      </span>
                    </span>
                  </button>
                  {esAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={CLASE_BOTON_SECUNDARIO}
                        onClick={() =>
                          setFormulario({
                            tipo: 'resultado',
                            id: null,
                            idCompetencia: competencia.idCompetencia,
                            codigo: '',
                            descripcion: '',
                            horasAsignadas: '',
                            numeroFase: '',
                            idGuia: null,
                          })
                        }
                      >
                        Agregar resultado
                      </button>
                      <button
                        type="button"
                        className={CLASE_BOTON_SECUNDARIO}
                        aria-label={`Editar competencia ${competencia.descripcion}`}
                        onClick={() =>
                          setFormulario({
                            tipo: 'competencia',
                            id: competencia.idCompetencia,
                            codigo: competencia.codigo ?? '',
                            descripcion: competencia.descripcion,
                            idPrograma: competencia.idPrograma,
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={CLASE_BOTON_SECUNDARIO}
                        aria-label={`Eliminar competencia ${competencia.descripcion}`}
                        disabled={competencia.resultados.length > 0}
                        title={competencia.resultados.length > 0 ? 'Primero elimina sus resultados de aprendizaje.' : undefined}
                        onClick={() => void eliminar(`/competencias-formacion/${competencia.idCompetencia}`)}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {abierta && (
                  <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
                    {competencia.resultados.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Esta competencia aún no tiene resultados.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-2">Código</th>
                            <th className="px-4 py-2">Resultado</th>
                            <th className="px-4 py-2">Fase</th>
                            <th className="px-4 py-2">Horas</th>
                            <th className="px-4 py-2">Bloques</th>
                            {esAdmin && <th className="px-4 py-2"><span className="sr-only">Acciones</span></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {competencia.resultados.map((resultado) => (
                            <tr key={resultado.idResultado} className="text-slate-700 dark:text-slate-300">
                              <td className="px-4 py-2 font-mono text-xs">{resultado.codigo ?? '—'}</td>
                              <td className="px-4 py-2">{resultado.descripcion}</td>
                              <td className="px-4 py-2">{resultado.numeroFase ?? '—'}</td>
                              <td className="px-4 py-2">{resultado.horasAsignadas ?? '—'}</td>
                              <td className="px-4 py-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    resultado.horariosAsignados > 0
                                      ? 'bg-sena-50 text-sena-700 dark:bg-sena-950/50 dark:text-sena-300'
                                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {resultado.horariosAsignados}
                                </span>
                              </td>
                              {esAdmin && (
                                <td className="whitespace-nowrap px-4 py-2 text-right">
                                  <button
                                    type="button"
                                    className={`${CLASE_BOTON_SECUNDARIO} mr-2`}
                                    aria-label={`Editar resultado ${resultado.descripcion}`}
                                    onClick={() => editarResultado(competencia.idCompetencia, resultado)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className={CLASE_BOTON_SECUNDARIO}
                                    aria-label={`Eliminar resultado ${resultado.descripcion}`}
                                    disabled={resultado.horariosAsignados > 0}
                                    title={
                                      resultado.horariosAsignados > 0
                                        ? 'Está asignado a bloques de horario: reasígnalos antes de eliminarlo.'
                                        : undefined
                                    }
                                    onClick={() => void eliminar(`/resultados-aprendizaje/${resultado.idResultado}`)}
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </AppShell>
  )
}
