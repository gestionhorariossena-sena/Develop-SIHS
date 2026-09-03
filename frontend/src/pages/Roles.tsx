import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { Rol } from '../types/api'

const POR_PAGINA = 10

export function Roles() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [eliminacionPendiente, setEliminacionPendiente] = useState<Rol | null>(null)

  useEffect(() => {
    apiGet<Rol[]>('/roles/')
      .then((datos) => {
        setRoles(datos)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo de roles.')
      })
      .finally(() => setCargando(false))
  }, [])

  function limpiarFormulario() {
    setNombre('')
    setEditandoId(null)
  }

  function comenzarEdicion(rol: Rol) {
    setEditandoId(rol.idRol)
    setNombre(rol.nombre)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardarRol(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const nombreNormalizado = nombre.trim()
    if (!nombreNormalizado) {
      setError('Escribe un nombre para el rol.')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      if (editandoId === null) {
        const creado = await apiPost<Rol>('/roles/', { nombre: nombreNormalizado })
        setRoles((anteriores) => [...anteriores, creado])
        setMensaje('Rol creado correctamente.')
      } else {
        const actualizado = await apiPut<Rol>(`/roles/${editandoId}`, { nombre: nombreNormalizado })
        setRoles((anteriores) => anteriores.map((rol) => rol.idRol === actualizado.idRol ? actualizado : rol))
        setMensaje('Rol actualizado correctamente.')
      }
      limpiarFormulario()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el rol.')
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarEliminacion() {
    if (!eliminacionPendiente) return
    setEliminandoId(eliminacionPendiente.idRol)
    setError(null)
    try {
      await apiDelete(`/roles/${eliminacionPendiente.idRol}`)
      setRoles((anteriores) => anteriores.filter((rol) => rol.idRol !== eliminacionPendiente.idRol))
      setMensaje('Rol eliminado correctamente.')
      setEliminacionPendiente(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el rol.')
    } finally {
      setEliminandoId(null)
    }
  }

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const visibles = roles.filter((rol) => rol.nombre.toLocaleLowerCase('es-CO').includes(texto))
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const rolesPagina = visibles.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  return (
    <AppShell activo="Roles">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Roles</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Catálogo de roles y permisos disponibles en el sistema.</p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {visibles.length} de {roles.length} roles
        </p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de roles">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Buscar roles</p>
          <div className="flex gap-4">
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{roles.length}</p></div>
            <div className="text-right"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Visibles</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{visibles.length}</p></div>
          </div>
        </div>
        <label htmlFor="buscar-rol" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label>
        <input id="buscar-rol" value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setPaginaActual(1) }} placeholder="Nombre del rol" className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
      </section>

      {mensaje && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{mensaje}</p>}
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <form onSubmit={guardarRol} className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="nombre-rol" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{editandoId === null ? 'Nuevo rol' : 'Editar rol'}</label>
            <input id="nombre-rol" value={nombre} onChange={(evento) => setNombre(evento.target.value)} placeholder="Ej. Coordinador" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={guardando} className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-800 disabled:cursor-not-allowed disabled:opacity-60">{guardando ? 'Guardando…' : editandoId === null ? 'Crear rol' : 'Guardar cambios'}</button>
            {editandoId !== null && <button type="button" onClick={limpiarFormulario} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>}
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Identificador</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {cargando ? <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Cargando roles…</td></tr> : rolesPagina.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No hay roles que coincidan con la búsqueda.</td></tr> : rolesPagina.map((rol) => (
                <tr key={rol.idRol} className="hover:bg-slate-50 dark:hover:bg-slate-700/60">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{rol.nombre}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">#{rol.idRol}</td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => comenzarEdicion(rol)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Editar</button><button type="button" onClick={() => setEliminacionPendiente(rol)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40">Borrar</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibles.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700"><p className="text-xs text-slate-500 dark:text-slate-400">Página {paginaSegura} de {totalPaginas}</p><div className="flex gap-2"><button type="button" onClick={() => setPaginaActual((pagina) => Math.max(1, pagina - 1))} disabled={paginaSegura === 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Anterior</button><button type="button" onClick={() => setPaginaActual((pagina) => Math.min(totalPaginas, pagina + 1))} disabled={paginaSegura === totalPaginas} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Siguiente</button></div></div>}
      </div>

      {eliminacionPendiente && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-labelledby="confirmar-borrado-rol"><div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"><h2 id="confirmar-borrado-rol" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Confirmar eliminación</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Vas a eliminar el rol <strong>{eliminacionPendiente.nombre}</strong>. Esta acción puede afectar a los usuarios que lo tienen asignado.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEliminacionPendiente(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button><button type="button" onClick={() => void confirmarEliminacion()} disabled={eliminandoId !== null} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{eliminandoId ? 'Borrando…' : 'Confirmar eliminación'}</button></div></div></div>}
    </AppShell>
  )
}
