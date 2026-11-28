import { useState, type ChangeEvent } from 'react'
import { apiGet, apiPost, apiPostForm, ApiError } from '../../services/api'
import type { CompetenciaFormacionResponse, PreviewCurriculoResponse, Programa, TematicaCompetencia } from '../../types/api'
import { PanelCargaMasiva, TituloPasoCarga, ResumenCargaMasiva } from '../cargaMasiva/FlujoCargaMasiva'
import { botonConfirmarCarga, estiloArchivoCarga, ejecutarCargaMasiva, type ResultadoCargaMasiva } from '../cargaMasiva/utilidadesCargaMasiva'

interface Props { programas: Programa[]; idPrograma: number | null; onTerminado: () => void; onCerrar: () => void }

export function CargaMasivaTematicas({ programas, idPrograma, onTerminado, onCerrar }: Props) {
  const [programa, setPrograma] = useState<number | null>(idPrograma)
  const [previa, setPrevia] = useState<PreviewCurriculoResponse | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<ResultadoCargaMasiva[] | null>(null)

  async function revisar(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    setPrevia(null)
    setResultados(null)
    setError(null)
    if (!archivo) return
    if (!archivo.name.toLowerCase().endsWith('.xlsx')) { setError('Selecciona un archivo .xlsx.'); return }
    if (archivo.size > 2 * 1024 * 1024) { setError('El archivo supera 2 MB.'); return }
    setSubiendo(true)
    try {
      const cuerpo = new FormData()
      cuerpo.append('archivo', archivo)
      const vista = await apiPostForm<PreviewCurriculoResponse>('/competencias-formacion/importar-vista-previa', cuerpo, 120000)
      if (!vista.competencias.length) { setError('El Excel no contiene competencias para importar.'); return }
      setPrevia(vista)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo leer el Excel.')
    } finally { setSubiendo(false) }
  }

  async function confirmar() {
    if (!previa || programa === null || confirmando) return
    setConfirmando(true)
    setError(null)
    try {
      // El mismo Excel puede haberse importado antes desde Programas:
      // reutilizar competencias y resultados existentes evita duplicados.
      const existentes = await apiGet<TematicaCompetencia[]>(`/tematicas/?id_programa=${programa}`)
      const normalizar = (valor: string) => valor.trim().toLocaleLowerCase('es-CO').replace(/\s+/g, ' ')
      const porDescripcion = new Map(existentes.map(item => [normalizar(item.descripcion), item]))
      const resultado = await ejecutarCargaMasiva(
        previa.competencias,
        async competencia => {
          const clave = normalizar(competencia.descripcion)
          let previaCompetencia = porDescripcion.get(clave)
          let idCompetencia = previaCompetencia?.idCompetencia
          if (idCompetencia === undefined) {
            const creada = await apiPost<CompetenciaFormacionResponse>('/competencias-formacion/', {
              idPrograma: programa, descripcion: competencia.descripcion,
            })
            idCompetencia = creada.idCompetencia
            previaCompetencia = {
              idCompetencia, codigo: null, descripcion: competencia.descripcion,
              idPrograma: programa, nombrePrograma: null, especialidades: [], resultados: [], totalHoras: 0,
            }
            porDescripcion.set(clave, previaCompetencia)
          }
          if (!previaCompetencia) throw new Error('No se pudo preparar la competencia para importar sus resultados.')
          for (const item of competencia.resultados) {
            if (previaCompetencia.resultados.some(actual => normalizar(actual.descripcion) === normalizar(item.descripcion))) continue
            await apiPost('/resultados-aprendizaje/', {
              idCompetencia, descripcion: item.descripcion,
              horasAsignadas: item.horasAsignadas, numeroFase: item.numeroFase,
            })
            previaCompetencia.resultados.push({
              idResultado: -1, codigo: null, descripcion: item.descripcion,
              horasAsignadas: item.horasAsignadas, numeroFase: item.numeroFase,
              idGuia: null, horariosAsignados: 0,
            })
          }
        },
        setResultados,
        competencia => competencia.descripcion,
      )
      setResultados(resultado)
      onTerminado()
    } finally { setConfirmando(false) }
  }

  return <PanelCargaMasiva
    titulo="Carga masiva de temáticas"
    descripcion="Importa competencias y resultados de aprendizaje para un programa. Es el mismo formato del plan curricular de Programas."
    columnas="COMPETENCIA · RESULTADOS DE APRENDIZAJE · DURACIÓN (si está disponible)"
    error={error} onCerrar={onCerrar}
  >
    <div className="space-y-3">
      <TituloPasoCarga numero={1} titulo="Seleccionar archivo y programa" detalle="Excel de planeación pedagógica (.xlsx). Los datos no se guardan hasta confirmar." />
      <label className="block text-sm font-medium text-on-surface">Programa de destino
        <select aria-label="Programa para importar temáticas" value={programa ?? ''} disabled={confirmando} onChange={e => { setPrograma(e.target.value ? Number(e.target.value) : null); setResultados(null) }} className="mt-1.5 min-h-10 w-full rounded-md border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface">
          <option value="">Selecciona un programa</option>
          {programas.map(p => <option key={p.idPrograma} value={p.idPrograma}>{p.nombrePrograma} · {p.codigoPrograma}</option>)}
        </select>
      </label>
      <input type="file" accept=".xlsx" aria-label="Archivo Excel de temáticas" disabled={subiendo || confirmando} onChange={e => void revisar(e)} className={estiloArchivoCarga} />
      {subiendo && <p role="status" className="text-sm text-on-surface-variant">Leyendo y validando el Excel…</p>}
    </div>

    {previa && <section className="space-y-3 border-t border-outline-variant pt-4">
      <TituloPasoCarga numero={2} titulo="Revisar datos" detalle={`${previa.totalCompetencias} competencias y ${previa.totalResultados} resultados detectados en «${previa.hoja}».`} />
      <div className="max-h-60 overflow-y-auto rounded-md border border-outline-variant">
        <ul className="divide-y divide-outline-variant">
          {previa.competencias.map((competencia, i) => <li key={i} className="px-3 py-3">
            <p className="text-sm font-semibold text-on-surface">{competencia.descripcion}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{competencia.resultados.length} resultados asociados · {competencia.resultados.reduce((n, r) => n + (r.horasAsignadas ?? 0), 0)} h informadas</p>
          </li>)}
        </ul>
      </div>
      <p className="text-xs leading-5 text-on-surface-variant">Si una competencia o resultado ya existe con la misma descripción en este programa, se reutiliza. Comprueba los datos antes de confirmar.</p>
      <button type="button" className={botonConfirmarCarga} disabled={programa === null || confirmando || resultados !== null} onClick={() => void confirmar()}>
        {confirmando ? 'Importando…' : 'Confirmar carga masiva'}
      </button>
    </section>}
    {resultados && <ResumenCargaMasiva resultados={resultados} total={previa?.competencias.length ?? resultados.length} />}
  </PanelCargaMasiva>
}
