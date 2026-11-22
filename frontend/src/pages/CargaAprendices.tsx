import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import {
  PanelCargaMasiva, TituloPasoCarga, botonConfirmarCarga,
  botonSecundarioCarga, estiloArchivoCarga, ejecutarCargaMasiva,
} from '../components/cargaMasiva/FlujoCargaMasiva'
import { apiPost, apiPostForm, ApiError } from '../services/api'

interface FilaAprendiz {
  fila: number
  valido: boolean
  datos: {
    nombre: string
    correo: string
    documento: string
    codigoFicha: string
    programaFormacion: string | null
  }
  error: string | null
}
interface Previa { filas: FilaAprendiz[]; total: number; validas: number }
interface RespuestaAlta { correo: string; estado: string; detalle: string }
interface Resultado extends RespuestaAlta { fila: number }

export function CargaAprendices() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [procesados, setProcesados] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [archivoVerificado, setArchivoVerificado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const descripcionError = (err: unknown) =>
    err instanceof ApiError ? err.message : 'No se pudo completar esta operación.'

  function seleccionarArchivo(nuevo: File | null) {
    setArchivo(nuevo)
    setArchivoVerificado(false)
    setPrevia(null)
    setResultados([])
    setProcesados(0)
    setError(null)
    setAviso(null)
  }

  async function revisarArchivo() {
    if (!archivo || ocupado) return
    setError(null)
    setOcupado(true)
    try {
      const datos = new FormData()
      datos.append('archivo', archivo)
      const respuesta = await apiPostForm<Previa>('/aprendices/alta/importar', datos, 120000)
      setPrevia(respuesta)
      setArchivoVerificado(true)
      if (respuesta.total === 0) setError('El Excel no contiene aprendices para importar.')
    } catch (err) {
      setError(descripcionError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function confirmar() {
    if (!previa || !archivoVerificado || previa.total === 0 || previa.validas !== previa.total || ocupado) return
    setOcupado(true)
    setError(null)
    setAviso(null)
    setResultados([])
    setProcesados(0)
    try {
      await ejecutarCargaMasiva(
        previa.filas,
        async fila => {
          let respuesta: RespuestaAlta
          try {
            respuesta = await apiPost<RespuestaAlta>('/aprendices/alta/', fila.datos, 45000)
          } catch (err) {
            respuesta = { correo: fila.datos.correo, estado: 'error', detalle: descripcionError(err) }
          }
          setResultados(anteriores => [...anteriores, { ...respuesta, fila: fila.fila }])
          if (respuesta.estado !== 'creado') throw new Error(respuesta.detalle)
        },
        progreso => setProcesados(progreso.length),
        fila => fila.datos.correo,
      )
      setAviso('Carga finalizada. Consulta el resultado de cada aprendiz.')
      setPrevia(null)
      setArchivo(null)
      setArchivoVerificado(false)
    } finally {
      setOcupado(false)
    }
  }

  return <AppShell activo="Aprendices">
    <nav className="mb-5 text-xs text-on-surface-variant">
      <Link to="/aprendices" className="hover:text-primary">Aprendices</Link>
      <span className="mx-2">/</span>
      <span className="font-semibold text-on-surface">Carga de aprendices</span>
    </nav>
    <header className="mb-6 max-w-3xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Gestión académica</p>
      <h1 className="text-2xl font-bold tracking-tight text-on-surface">Carga masiva de aprendices</h1>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        Importa aprendices desde un Excel, comprueba su ficha y confirma la creación de cuentas.
        Cada cuenta recibirá una contraseña temporal y quedará asociada a su ficha.
      </p>
    </header>

    <PanelCargaMasiva
      titulo="Importar aprendices"
      descripcion="Primero se validan los datos; ninguna cuenta se crea hasta confirmar."
      columnas="nombre, correo, documento, codigoFicha (requeridas); programaFormacion (opcional)"
      error={error}
      mensaje={aviso}
    >
      <div className="space-y-3">
        <TituloPasoCarga numero={1} titulo="Seleccionar archivo" detalle="Excel .xlsx · hasta 2 MB y 200 aprendices. Las fichas deben existir previamente."/>
        <label className="block text-sm font-medium text-on-surface">
          Archivo Excel
          <input
            type="file" accept=".xlsx" aria-label="Archivo Excel de aprendices"
            disabled={ocupado}
            onChange={evento => seleccionarArchivo(evento.target.files?.[0] ?? null)}
            className={`mt-2 ${estiloArchivoCarga}`}
          />
        </label>
        <p className="text-xs leading-5 text-on-surface-variant">
          Si el archivo de demostración incluye «claveDemoLocal», esa columna se ignora.
          SIHS genera nuevas credenciales, sin exponerlas en esta pantalla.
        </p>
        <button type="button" disabled={!archivo || ocupado} className={botonSecundarioCarga} onClick={() => void revisarArchivo()}>
          {ocupado && !previa ? 'Revisando…' : 'Revisar archivo'}
        </button>
      </div>

      {previa && <section className="space-y-3 border-t border-outline-variant pt-4">
        <TituloPasoCarga numero={2} titulo="Revisar datos" detalle={`${previa.validas} de ${previa.total} registros válidos. Los errores deben corregirse antes de confirmar.`} />
        <div className="max-h-80 overflow-auto rounded-md border border-outline-variant">
          <table className="w-full min-w-[660px] text-left text-xs">
            <thead className="sticky top-0 bg-surface-container-low text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">Fila</th><th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Correo</th><th className="px-3 py-2">Ficha</th>
                <th className="px-3 py-2">Validación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {previa.filas.map(fila => <tr key={fila.fila}>
                <td className="px-3 py-3 tabular-nums text-on-surface-variant">{fila.fila}</td>
                <td className="px-3 py-3 text-on-surface">{fila.datos.nombre}</td>
                <td className="px-3 py-3 text-on-surface-variant">{fila.datos.correo}</td>
                <td className="px-3 py-3 text-on-surface-variant">{fila.datos.codigoFicha}</td>
                <td className={`px-3 py-3 ${fila.valido ? 'text-primary' : 'text-error'}`}>{fila.valido ? 'Lista para importar' : fila.error}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <button
          type="button" disabled={ocupado || previa.total === 0 || previa.validas !== previa.total}
          className={botonConfirmarCarga} onClick={() => void confirmar()}
        >
          {ocupado ? `Procesando ${procesados} de ${previa.total}…` : `Confirmar importación de ${previa.total} ${previa.total === 1 ? 'aprendiz' : 'aprendices'}`}
        </button>
      </section>}

      {resultados.length > 0 && <section aria-label="Resultado de la carga de aprendices" className="space-y-3 border-t border-outline-variant pt-4">
        <TituloPasoCarga numero={3} titulo="Resultado de la carga" detalle={`${resultados.filter(f => f.estado === 'creado').length} cuentas creadas de ${resultados.length} procesadas.`}/>
        <ul className="max-h-64 divide-y divide-outline-variant overflow-y-auto rounded-md border border-outline-variant">
          {resultados.map(r => <li key={r.fila} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm">
            <div><p className="font-medium text-on-surface">{r.correo}</p><p className="mt-1 text-xs text-on-surface-variant">{r.detalle}</p></div>
            <span className={r.estado === 'creado' ? 'text-primary' : 'text-error'}>{r.estado === 'creado' ? 'Creado' : r.estado.replaceAll('_', ' ')}</span>
          </li>)}
        </ul>
      </section>}
    </PanelCargaMasiva>
  </AppShell>
}
