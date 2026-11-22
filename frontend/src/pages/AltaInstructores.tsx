import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiPost, apiPostForm, ApiError } from '../services/api'
import { PanelCargaMasiva, TituloPasoCarga, botonConfirmarCarga, botonSecundarioCarga, estiloArchivoCarga, ejecutarCargaMasiva } from '../components/cargaMasiva/FlujoCargaMasiva'

interface Alta {
  nombre: string
  correo: string
  documento: string
  tipoContrato: string
  horasContratadasSemana: string
  sigla: string
}
interface Resultado { correo: string; estado: string; detalle: string; fila?: number }
interface FilaExcel {
  fila: number
  valido: boolean
  datos: Record<string, string | number | null>
  error: string | null
}
interface Previa { confirmado: false; filas: FilaExcel[]; total: number; validas: number }

const vacio: Alta = { nombre: '', correo: '', documento: '', tipoContrato: '', horasContratadasSemana: '', sigla: '' }
const clase = 'mt-1.5 w-full min-h-10 rounded-md border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
const etiqueta = 'block text-xs font-medium text-on-surface-variant'
const primario = botonConfirmarCarga
const secundario = botonSecundarioCarga

export function AltaInstructores() {
  const [modo, setModo] = useState<'individual' | 'excel'>('individual')
  const [datos, setDatos] = useState<Alta>(vacio)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState(0)

  function actualizar(campo: keyof Alta, valor: string) {
    setDatos((actual) => ({ ...actual, [campo]: valor }))
    setError(null)
    setResultados([])
  }

  function detalleError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 503) return 'No se pudo completar el alta. Revisa la configuración del correo o del servicio de cuentas con administración.'
      return err.message
    }
    return 'No se pudo completar la operación.'
  }

  async function registrar(evento: FormEvent) {
    evento.preventDefault()
    if (procesando) return
    setError(null)
    setMensaje(null)
    setProcesando(true)
    try {
      const respuesta = await apiPost<Resultado>('/instructores/alta/', {
        ...datos,
        horasContratadasSemana: datos.horasContratadasSemana ? Number(datos.horasContratadasSemana) : null,
        tipoContrato: datos.tipoContrato || null,
        sigla: datos.sigla || null,
      }, 45000)
      setResultados([respuesta])
      if (respuesta.estado === 'creado') {
        setDatos(vacio)
        setMensaje('Cuenta creada. Se enviaron las credenciales temporales al instructor.')
      } else {
        setError(respuesta.detalle)
      }
    } catch (err) {
      setError(detalleError(err))
    } finally {
      setProcesando(false)
    }
  }

  function seleccionarArchivo(file: File | null) {
    setArchivo(file)
    setPrevia(null)
    setResultados([])
    setProgreso(0)
    setMensaje(null)
    setError(null)
  }

  async function enviarExcel(confirmar: boolean) {
    if (!archivo || procesando) return
    setProcesando(true)
    setError(null)
    setMensaje(null)
    try {
      if (!confirmar) {
        const form = new FormData()
        form.append('archivo', archivo)
        const respuesta = await apiPostForm<Previa>('/instructores/alta/importar', form, 120000)
        setPrevia(respuesta)
        return
      }
      if (!previa || previa.total === 0 || previa.validas !== previa.total) return

      // Cada fila se confirma individualmente: un lote grande no queda
      // colgado detrás del timeout de una sola petición HTTP.
      setResultados([])
      setProgreso(0)
      await ejecutarCargaMasiva(
        previa.filas,
        async (fila) => {
          let resultado: Resultado
          try {
            resultado = await apiPost<Resultado>('/instructores/alta/', fila.datos, 45000)
          } catch (err) {
            resultado = { correo: String(fila.datos.correo ?? ''), estado: 'error', detalle: detalleError(err) }
          }
          setResultados((anteriores) => [...anteriores, { ...resultado, fila: fila.fila }])
          if (resultado.estado !== 'creado') throw new Error(resultado.detalle)
        },
        (parciales) => setProgreso(parciales.length),
        (fila) => String(fila.datos.correo ?? ''),
      )
      setPrevia(null)
      setArchivo(null)
      setMensaje('Importación procesada. Revisa el resultado de cada instructor.')
    } catch (err) {
      setError(detalleError(err))
    } finally {
      setProcesando(false)
    }
  }

  return (
    <AppShell activo="Instructores">
      <nav className="mb-5 text-xs text-on-surface-variant"><Link className="hover:text-primary" to="/instructores">Instructores</Link><span className="mx-2">/</span><span className="font-semibold text-on-surface">Registrar</span></nav>
      <header className="mb-6 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Gestión de instructores</p>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Registrar instructores</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Crea cuentas para docentes del centro. El instructor recibirá un correo con su usuario y contraseña temporal, y deberá cambiarla al ingresar.</p>
      </header>

      <div role="tablist" aria-label="Método de registro" className="mb-5 inline-flex gap-1 rounded-md border border-outline-variant bg-surface-container-low p-1">
        <button role="tab" type="button" aria-selected={modo === 'individual'} onClick={() => { setModo('individual'); setError(null) }} className={`rounded px-4 py-2 text-sm font-medium ${modo === 'individual' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Uno por uno</button>
        <button role="tab" type="button" aria-selected={modo === 'excel'} onClick={() => { setModo('excel'); setError(null) }} className={`rounded px-4 py-2 text-sm font-medium ${modo === 'excel' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Desde Excel</button>
      </div>

      {error && <p role="alert" className="mb-4 max-w-3xl rounded-md border border-error/30 bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      {mensaje && <p role="status" className="mb-4 max-w-3xl rounded-md border border-primary/25 bg-primary-container p-3 text-sm text-on-primary-container">{mensaje}</p>}

      {modo === 'individual' ? (
        <form onSubmit={(e) => void registrar(e)} className="max-w-3xl overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
          <div className="border-b border-outline-variant px-5 py-4">
            <h2 className="text-base font-semibold text-on-surface">Datos del instructor</h2>
            <p className="mt-1 text-xs text-on-surface-variant">El correo y el documento deben corresponder a una persona que aún no tenga cuenta en SIHS.</p>
          </div>
          <div className="grid gap-x-4 gap-y-5 p-5 sm:grid-cols-2">
            <label className={etiqueta}>Nombre completo <input className={clase} required maxLength={100} minLength={3} autoComplete="name" value={datos.nombre} onChange={(e) => actualizar('nombre', e.target.value)} /></label>
            <label className={etiqueta}>Correo institucional <input className={clase} required type="email" autoComplete="email" value={datos.correo} onChange={(e) => actualizar('correo', e.target.value)} /></label>
            <label className={etiqueta}>Número de documento <input className={clase} required minLength={4} maxLength={30} value={datos.documento} onChange={(e) => actualizar('documento', e.target.value)} /></label>
            <label className={etiqueta}>Sigla (opcional) <input className={clase} maxLength={10} value={datos.sigla} onChange={(e) => actualizar('sigla', e.target.value)} placeholder="Ej. JP" /></label>
            <label className={etiqueta}>Tipo de contrato (opcional) <select className={clase} value={datos.tipoContrato} onChange={(e) => actualizar('tipoContrato', e.target.value)}><option value="">Sin especificar</option><option value="planta">Planta</option><option value="contrato">Contrato</option></select></label>
            <label className={etiqueta}>Horas contratadas por semana (opcional) <input className={clase} type="number" min={1} max={60} value={datos.horasContratadasSemana} onChange={(e) => actualizar('horasContratadasSemana', e.target.value)} /></label>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-5 py-4">
            <p className="max-w-sm text-xs leading-5 text-on-surface-variant">No se mostrará ni almacenará la contraseña temporal en esta pantalla.</p>
            <button disabled={procesando} type="submit" className={primario}>{procesando ? 'Creando cuenta…' : 'Crear y enviar acceso'}</button>
          </footer>
        </form>
      ) : (
        <PanelCargaMasiva
          titulo="Carga masiva de instructores"
          descripcion="Selecciona un Excel, revisa las filas y confirma el alta de cuentas. Cada instructor recibirá una invitación independiente."
          columnas="nombre, correo, documento (obligatorias); tipoContrato, horasContratadasSemana, sigla (opcionales)"
          error={null}
        >
          <div className="space-y-4">
            <TituloPasoCarga numero={1} titulo="Seleccionar archivo" detalle="Excel .xlsx · máximo 2 MB · hasta 200 instructores." />

            <label className={etiqueta}>Archivo de coordinación <input aria-label="Archivo Excel de instructores" type="file" accept=".xlsx" onChange={(e) => seleccionarArchivo(e.target.files?.[0] ?? null)} className={estiloArchivoCarga} /></label>
            <button type="button" className={secundario} disabled={!archivo || procesando} onClick={() => void enviarExcel(false)}>{procesando ? 'Revisando…' : 'Revisar archivo'}</button>
            {previa && <div className="overflow-x-auto border-t border-outline-variant pt-4">
              <TituloPasoCarga numero={2} titulo="Revisar datos" detalle="Los datos todavía no se han guardado. Confirma cuando todas las filas sean válidas." />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-on-surface">Vista previa · {previa.validas} de {previa.total} filas válidas</h3><button type="button" className={primario} disabled={procesando || previa.validas !== previa.total || previa.total === 0} onClick={() => void enviarExcel(true)}>{procesando ? 'Importando…' : 'Confirmar e invitar'}</button></div>
              <table className="min-w-[620px] w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Correo</th><th className="px-3 py-2">Validación</th></tr></thead>
                <tbody className="divide-y divide-outline-variant">{previa.filas.map((f) => <tr key={f.fila}><td className="px-3 py-3 tabular-nums">{f.fila}</td><td className="px-3 py-3">{String(f.datos.nombre ?? '')}</td><td className="px-3 py-3">{String(f.datos.correo ?? '')}</td><td className={`px-3 py-3 ${f.valido ? 'text-primary' : 'text-error'}`}>{f.valido ? 'Formato válido' : f.error}</td></tr>)}</tbody>
              </table>
            </div>}
          </div>
        </PanelCargaMasiva>
      )}

      {modo === 'excel' && procesando && previa && progreso > 0 && <p role="status" className="mt-4 text-sm text-on-surface-variant">Enviando invitaciones: {progreso} de {previa.total} instructores procesados.</p>}
      {resultados.length > 0 && <section aria-label="Resultados del registro" className="mt-6 max-w-4xl border-t border-outline-variant pt-4">
        <TituloPasoCarga numero={3} titulo="Resultado de la importación" detalle="Revisa los correos enviados, omitidos y pendientes." />
        <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant bg-surface-container-lowest">{resultados.map((r, i) => <li key={`${r.correo}-${i}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"><div><p className="font-medium text-on-surface">{r.correo}</p><p className="mt-1 text-xs text-on-surface-variant">{r.detalle}</p></div><span className={`text-xs font-semibold ${r.estado === 'creado' ? 'text-primary' : 'text-tertiary'}`}>{r.estado === 'creado' ? 'Invitado' : r.estado.replaceAll('_', ' ')}</span></li>)}</ul>
      </section>}
    </AppShell>
  )
}
