import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'

interface AprendizListado {
  idUsuario: string
  nombre: string
  correo: string
  documento: string | null
  estado: string
  codigoFicha: string | null
  programa: string | null
  rolEnFicha: string | null
  debeCambiarClave: boolean
}

const campo = 'min-h-10 w-full rounded-md border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

export function Aprendices() {
  const [aprendices, setAprendices] = useState<AprendizListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ficha, setFicha] = useState('todas')
  const [pagina, setPagina] = useState(1)

  async function actualizar() {
    setCargando(true)
    setError(null)
    try {
      const registros = await apiGet<AprendizListado[]>('/aprendices/alta/')
      setAprendices(registros)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo consultar el directorio de aprendices.')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { void actualizar() }, [])

  const fichas = useMemo(
    () => Array.from(new Set(aprendices.map(a => a.codigoFicha).filter((v): v is string => Boolean(v)))).sort(),
    [aprendices],
  )
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es-CO')
    return aprendices.filter(a =>
      (ficha === 'todas' || (ficha === 'sin' ? !a.codigoFicha : a.codigoFicha === ficha))
      && (!texto || [a.nombre, a.correo, a.documento, a.codigoFicha, a.programa]
        .some(valor => valor?.toLocaleLowerCase('es-CO').includes(texto))),
    )
  }, [aprendices, busqueda, ficha])
  const paginas = Math.max(1, Math.ceil(visibles.length / 10))
  const paginaSegura = Math.min(pagina, paginas)
  const filas = visibles.slice((paginaSegura - 1) * 10, paginaSegura * 10)
  const sinFicha = aprendices.filter(a => !a.codigoFicha).length

  return <AppShell activo="Datos académicos">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Datos académicos</p>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Aprendices</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Consulta la vinculación de cada aprendiz con su ficha y administra nuevas altas desde Excel.</p>
      </div>
      <Link to="/aprendices/carga-masiva" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container">
        Carga masiva
      </Link>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {[
        ['Aprendices', aprendices.length],
        ['Con ficha asignada', aprendices.length - sinFicha],
        ['Sin ficha asignada', sinFicha],
      ].map(([etiqueta, valor]) =>
        <div key={etiqueta} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3">
          <p className="text-xs font-medium text-on-surface-variant">{etiqueta}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-on-surface">{valor}</p>
        </div>,
      )}
    </div>

    <div className="mb-4 grid gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-[1fr_220px]">
      <label className="text-xs font-medium text-on-surface-variant">Buscar aprendiz
        <input type="search" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          className={`mt-1.5 ${campo}`} placeholder="Nombre, documento, correo o programa"/>
      </label>
      <label className="text-xs font-medium text-on-surface-variant">Ficha
        <select value={ficha} onChange={e => { setFicha(e.target.value); setPagina(1) }} className={`mt-1.5 ${campo}`}>
          <option value="todas">Todas las fichas</option>
          <option value="sin">Sin ficha asignada</option>
          {fichas.map(codigo => <option key={codigo} value={codigo}>{codigo}</option>)}
        </select>
      </label>
    </div>

    {error && <p role="alert" className="mb-4 rounded-md border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">{error}
      <button type="button" onClick={() => void actualizar()} className="ml-3 font-semibold underline">Reintentar</button>
    </p>}

    <section aria-label="Listado de aprendices" className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
        <h2 className="text-sm font-semibold text-on-surface">Directorio</h2>
        <span className="text-xs tabular-nums text-on-surface-variant">{cargando ? 'Cargando…' : `${visibles.length} registros`}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant">
            <tr><th className="px-4 py-3">Aprendiz</th><th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Ficha</th><th className="px-4 py-3">Programa</th>
              <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acceso</th></tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {!cargando && !error && filas.length === 0 &&
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-on-surface-variant">No hay aprendices que coincidan con los filtros.</td></tr>}
            {filas.map(a => <tr key={a.idUsuario} className="hover:bg-surface-container-low">
              <td className="px-4 py-3"><p className="font-semibold text-on-surface">{a.nombre}</p><p className="mt-1 text-xs text-on-surface-variant">{a.correo}</p></td>
              <td className="px-4 py-3 tabular-nums text-on-surface-variant">{a.documento || '—'}</td>
              <td className="px-4 py-3 font-medium text-on-surface">{a.codigoFicha || <span className="text-error">Sin ficha</span>}</td>
              <td className="px-4 py-3 text-on-surface-variant">{a.programa || '—'}</td>
              <td className="px-4 py-3 text-on-surface-variant">{a.estado}</td>
              <td className="px-4 py-3 text-xs text-on-surface-variant">{a.debeCambiarClave ? 'Cambio de clave pendiente' : 'Acceso habilitado'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!cargando && paginas > 1 && <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
        <span className="text-xs tabular-nums text-on-surface-variant">Página {paginaSegura} de {paginas}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPagina(n => Math.max(1, n - 1))} disabled={paginaSegura === 1} className="rounded-md border border-outline px-3 py-2 text-xs font-semibold disabled:opacity-40">Anterior</button>
          <button type="button" onClick={() => setPagina(n => Math.min(paginas, n + 1))} disabled={paginaSegura === paginas} className="rounded-md border border-outline px-3 py-2 text-xs font-semibold disabled:opacity-40">Siguiente</button>
        </div>
      </div>}
    </section>
  </AppShell>
}
