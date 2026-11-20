import { useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiDelete, apiGet, apiPostForm, ApiError } from '../services/api'

type Instructor = { fila: number; documento: string; nombre: string; correo: string; contrato: string; horas: number; especialidades: string[] }
type ErrorFila = { fila: number; mensaje: string }
type Preview = { validos: Instructor[]; errores: ErrorFila[] }
type Resultado = { creados: number; existentes: number; errores: ErrorFila[]; credencialesTemporales: { correo: string; passwordTemporal: string }[]; idLote: string | null }
type Lote = { idLote: string; fechaCreacion: string; creados: number }

export function CargaMasivaInstructores() {
  const selectorArchivo = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [lotes, setLotes] = useState<Lote[]>([])

  async function cargarLotes() {
    try {
      setLotes(await apiGet<Lote[]>('/usuarios/instructores/importar/lotes'))
    } catch {
      // La importación sigue disponible aunque el historial no pueda cargar.
    }
  }

  useEffect(() => { void cargarLotes() }, [])

  function seleccionarArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const seleccionado = evento.target.files?.[0] ?? null
    // Esto habilita volver a elegir el mismo archivo después de corregirlo.
    evento.target.value = ''
    setArchivo(seleccionado)
    setPreview(null)
    setResultado(null)
    setError(null)
    setMensaje(null)
  }

  const enviar = async (ruta: string) => {
    if (!archivo) return
    const data = new FormData()
    data.append('archivo', archivo)
    return apiPostForm<Preview | Resultado>(ruta, data, 60000)
  }

  async function revisar() {
    if (!archivo) return
    setCargando(true)
    setError(null)
    setMensaje(null)
    setResultado(null)
    try {
      setPreview(await enviar('/usuarios/instructores/importar/previsualizar') as Preview)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setCargando(false)
    }
  }

  async function importar() {
    if (!archivo) return
    setCargando(true)
    setError(null)
    try {
      const respuesta = await enviar('/usuarios/instructores/importar') as Resultado
      setResultado(respuesta)
      if (respuesta.idLote) await cargarLotes()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo importar el archivo.')
    } finally {
      setCargando(false)
    }
  }

  async function eliminarLote(lote: Lote) {
    if (!window.confirm(`¿Quieres eliminar los ${lote.creados} instructores creados por este lote? Esta acción eliminará sus cuentas creadas por la importación y permitirá cargarlos de nuevo.`)) return
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      const respuesta = await apiDelete<{ eliminados: number }>(`/usuarios/instructores/importar/lotes/${lote.idLote}`)
      setMensaje(`Se eliminaron ${respuesta.eliminados} instructores del lote. Ya puedes corregir el CSV y volver a importarlo.`)
      await cargarLotes()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo eliminar el lote.')
    } finally {
      setCargando(false)
    }
  }

  return <AppShell activo="Carga masiva de instructores"><div className="mx-auto max-w-6xl space-y-6">
    <div><h1 className="text-2xl font-bold text-on-surface dark:text-slate-100">Carga masiva de instructores</h1><p className="mt-1 text-sm text-on-surface-variant">Carga un CSV UTF-8, revisa sus filas y confirma la creación de cuentas. Se exige 32 h para planta y 40 h para contrato.</p></div>
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
      <label className="block text-sm font-semibold" htmlFor="archivo-instructores">Archivo CSV</label>
      <input ref={selectorArchivo} id="archivo-instructores" className="sr-only" type="file" accept=".csv,text/csv" onChange={seleccionarArchivo} />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => selectorArchivo.current?.click()} disabled={cargando} className="rounded-lg border border-sena-600 px-4 py-2 text-sm font-semibold text-sena-700 hover:bg-sena-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sena-300">Seleccionar archivo</button>
        <output aria-live="polite" className="text-sm text-on-surface-variant">{archivo ? archivo.name : 'Sin archivos seleccionados'}</output>
      </div>
      <p className="mt-2 text-xs text-on-surface-variant">Formato admitido: CSV codificado en UTF-8.</p>
      <button type="button" disabled={!archivo || cargando} onClick={() => void revisar()} className="mt-4 rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{cargando ? 'Procesando…' : 'Revisar archivo'}</button>
    </section>
    {error && <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container" role="alert">{error}</p>}
    {mensaje && <p className="rounded-lg bg-primary-container p-3 text-sm text-on-primary-container" role="status">{mensaje}</p>}
    {preview && <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800"><h2 className="font-semibold">Previsualización: {preview.validos.length} filas válidas y {preview.errores.length} con errores</h2>{preview.errores.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-error">{preview.errores.map(x => <li key={`${x.fila}-${x.mensaje}`}>Fila {x.fila}: {x.mensaje}</li>)}</ul>}
      {preview.validos.length > 0 && <><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Nombre</th><th>Documento</th><th>Contrato</th><th>Horas</th><th>Especialidades</th></tr></thead><tbody>{preview.validos.map(x => <tr key={x.fila}><td>{x.nombre}</td><td>{x.documento}</td><td>{x.contrato}</td><td>{x.horas}</td><td>{x.especialidades.join(', ') || 'Sin asignar'}</td></tr>)}</tbody></table></div><button type="button" disabled={cargando} onClick={() => void importar()} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50">{cargando ? 'Importando…' : `Confirmar importación de ${preview.validos.length} filas válidas`}</button></>}</section>}
    {resultado && <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800" aria-live="polite"><h2 className="font-semibold">Resultado de la importación</h2><p className="mt-2 text-sm">Creados: {resultado.creados}. Ya existentes: {resultado.existentes}. Rechazados: {resultado.errores.length}.</p>{resultado.errores.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-error">{resultado.errores.map(x => <li key={`${x.fila}-${x.mensaje}`}>Fila {x.fila}: {x.mensaje}</li>)}</ul>}{resultado.credencialesTemporales.length > 0 && <p className="mt-2 text-sm text-error">Guarda las claves temporales ahora: no volverán a mostrarse.</p>}<ul className="mt-2 text-sm">{resultado.credencialesTemporales.map(x => <li key={x.correo}>{x.correo}: <code>{x.passwordTemporal}</code></li>)}</ul></section>}
    {lotes.length > 0 && <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800"><h2 className="font-semibold">Lotes de importación reversibles</h2><p className="mt-1 text-sm text-on-surface-variant">Solo puedes eliminar instructores creados por estos lotes y sin horarios asignados.</p><ul className="mt-3 space-y-2">{lotes.map(lote => <li key={lote.idLote} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 text-sm"><span>{lote.creados} instructores · {new Date(lote.fechaCreacion).toLocaleString('es-CO')}</span><button type="button" disabled={cargando} onClick={() => void eliminarLote(lote)} className="rounded-lg border border-error px-3 py-1.5 font-semibold text-error disabled:cursor-not-allowed disabled:opacity-50">Eliminar lote</button></li>)}</ul></section>}
  </div></AppShell>
}
