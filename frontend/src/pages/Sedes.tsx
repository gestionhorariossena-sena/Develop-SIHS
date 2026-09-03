import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../services/api'
import type { Ambiente, Sede, Usuario } from '../types/api'

type TipoFiltro = 'todos' | NonNullable<Sede['tipoSede']>

type SedeForm = {
  nombreSede: string
  direccion: string
  tipoSede: NonNullable<Sede['tipoSede']>
}

const TIPO_SEDE_LABELS: Record<NonNullable<Sede['tipoSede']>, string> = {
  principal: 'Principal',
  secundaria: 'Secundaria',
  alterna: 'Alterna',
}

const FORM_VACIO: SedeForm = {
  nombreSede: '',
  direccion: '',
  tipoSede: 'principal',
}

function formatearTipo(tipo: Sede['tipoSede']) {
  if (!tipo) return 'Sin tipo'
  return TIPO_SEDE_LABELS[tipo]
}

export function Sedes() {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [seleccionada, setSeleccionada] = useState<Sede | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<SedeForm>(FORM_VACIO)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Sede[]>('/sedes/'), apiGet<Ambiente[]>('/ambientes/'), apiGet<Usuario>('/usuarios/me')])
      .then(([sedesResponse, ambientesResponse, perfilResponse]) => {
        setSedes(sedesResponse)
        setAmbientes(ambientesResponse)
        setPerfil(perfilResponse)
        setError(null)
      })
      .catch((err: unknown) => {
        const mensaje = err instanceof ApiError ? err.message : 'No se pudo cargar el listado de sedes.'
        setError(mensaje)
      })
      .finally(() => setCargando(false))
  }, [])

  const puedeGestionarSedes =
    perfil?.roles.some((rol) => rol.nombre === 'Administrador' || rol.nombre === 'Coordinador') ?? false

  const ambientesPorSede = useMemo(() => {
    const mapa = new Map<number, Ambiente[]>()
    for (const ambiente of ambientes) {
      const actuales = mapa.get(ambiente.idSede) ?? []
      actuales.push(ambiente)
      mapa.set(ambiente.idSede, actuales)
    }
    return mapa
  }, [ambientes])

  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const visibles = sedes.filter((sede) => {
    const coincideTipo = tipoFiltro === 'todos' || sede.tipoSede === tipoFiltro
    const coincideTexto =
      !texto ||
      `${sede.nombreSede} ${sede.direccion ?? ''} ${formatearTipo(sede.tipoSede)}`
        .toLocaleLowerCase('es-CO')
        .includes(texto)

    return coincideTipo && coincideTexto
  })

  const abrirCrear = () => {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setModalAbierto(true)
    setError(null)
  }

  const abrirEditar = (sede: Sede) => {
    setEditandoId(sede.idSede)
    setForm({
      nombreSede: sede.nombreSede,
      direccion: sede.direccion ?? '',
      tipoSede: sede.tipoSede ?? 'principal',
    })
    setModalAbierto(true)
    setError(null)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  const handleSubmit = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()

    const nombreSede = form.nombreSede.trim()
    if (!nombreSede) {
      setError('El nombre de la sede es obligatorio.')
      return
    }

    const payload = {
      nombreSede,
      direccion: form.direccion.trim() || null,
      tipoSede: form.tipoSede,
    }

    try {
      setGuardando(true)
      setError(null)

      if (editandoId !== null) {
        const actualizada = await apiPut<Sede>(`/sedes/${editandoId}`, payload)
        setSedes((anterior) => anterior.map((sede) => (sede.idSede === editandoId ? actualizada : sede)))
        setSeleccionada(actualizada)
      } else {
        const creada = await apiPost<Sede>('/sedes/', payload)
        setSedes((anterior) => [creada, ...anterior])
        setSeleccionada(creada)
      }

      cerrarModal()
    } catch (err: unknown) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar la sede.'
      setError(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  const handleDelete = async (sede: Sede) => {
    const asociados = ambientesPorSede.get(sede.idSede)?.length ?? 0

    if (asociados > 0) {
      setError(
        `No se puede eliminar "${sede.nombreSede}" porque tiene ${asociados} ambiente${asociados === 1 ? '' : 's'} asociado${asociados === 1 ? '' : 's'}.`,
      )
      return
    }

    const confirmado = window.confirm(`¿Deseas eliminar la sede "${sede.nombreSede}"?`)
    if (!confirmado) return

    try {
      setError(null)
      await apiDelete(`/sedes/${sede.idSede}`)
      setSedes((anterior) => anterior.filter((item) => item.idSede !== sede.idSede))
      if (seleccionada?.idSede === sede.idSede) setSeleccionada(null)
    } catch (err: unknown) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo eliminar la sede.'
      setError(mensaje)
    }
  }

  const totalAmbientes = ambientes.length

  return (
    <AppShell activo="Sedes">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Sedes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Catálogo de sedes del proyecto con información operativa y tipo de ubicación.
          </p>
        </div>

        {puedeGestionarSedes && (
          <button
            type="button"
            onClick={abrirCrear}
            className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-600"
          >
            Nueva sede
          </button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sedes registradas</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{sedes.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Ambientes asociados</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{totalAmbientes}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Principales</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {sedes.filter((sede) => sede.tipoSede === 'principal').length}
          </p>
        </div>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="buscar-sede" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Buscar
            </label>
            <input
              id="buscar-sede"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Nombre, dirección o tipo"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="filtro-tipo-sede" className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Tipo
            </label>
            <select
              id="filtro-tipo-sede"
              value={tipoFiltro}
              onChange={(evento) => setTipoFiltro(evento.target.value as TipoFiltro)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="todos">Todos</option>
              <option value="principal">Principal</option>
              <option value="secundaria">Secundaria</option>
              <option value="alterna">Alterna</option>
            </select>
          </div>
        </div>
      </section>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando sedes...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">Dirección</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3">Ambientes</th>
                  {puedeGestionarSedes && <th scope="col" className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visibles.map((sede) => {
                  const asociados = ambientesPorSede.get(sede.idSede)?.length ?? 0

                  return (
                    <tr
                      key={sede.idSede}
                      onClick={() => setSeleccionada(sede)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{sede.nombreSede}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{sede.direccion || 'Sin dirección'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-sena-50 px-2.5 py-1 text-xs font-semibold text-sena-700 dark:bg-sena-950/50 dark:text-sena-300">
                          {formatearTipo(sede.tipoSede)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{asociados} ambiente{asociados === 1 ? '' : 's'}</td>

                      {puedeGestionarSedes && (
                        <td className="px-4 py-3" onClick={(evento) => evento.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditar(sede)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(sede)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              Borrar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {seleccionada && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={() => setSeleccionada(null)}>
          <aside
            className="h-full w-full max-w-md bg-white p-6 shadow-2xl dark:bg-slate-800"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sena-700 dark:text-sena-400">Sede</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{seleccionada.nombreSede}</h2>
              </div>

              <button
                type="button"
                onClick={() => setSeleccionada(null)}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Cerrar
              </button>
            </div>

            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Dirección</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {seleccionada.direccion || 'Sin dirección registrada'}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500 dark:text-slate-400">Tipo</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{formatearTipo(seleccionada.tipoSede)}</dd>
              </div>

              <div>
                <dt className="text-slate-500 dark:text-slate-400">Ambientes asociados</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                  {(ambientesPorSede.get(seleccionada.idSede)?.length ?? 0)} ambiente
                  {(ambientesPorSede.get(seleccionada.idSede)?.length ?? 0) === 1 ? '' : 's'}
                </dd>
              </div>
            </dl>

            {puedeGestionarSedes && (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => abrirEditar(seleccionada)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Editar sede
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(seleccionada)}
                  className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Borrar sede
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onClick={cerrarModal}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sena-700 dark:text-sena-400">
                  {editandoId === null ? 'Nueva sede' : 'Editar sede'}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {editandoId === null ? 'Crear sede' : 'Actualizar información'}
                </h3>
              </div>

              <button
                type="button"
                onClick={cerrarModal}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="nombre-sede" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nombre de la sede
                </label>
                <input
                  id="nombre-sede"
                  value={form.nombreSede}
                  onChange={(evento) => setForm((actual) => ({ ...actual, nombreSede: evento.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Ej: Sede principal"
                />
              </div>

              <div>
                <label htmlFor="direccion-sede" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Dirección
                </label>
                <input
                  id="direccion-sede"
                  value={form.direccion}
                  onChange={(evento) => setForm((actual) => ({ ...actual, direccion: evento.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Ej: Calle 30 # 45-67"
                />
              </div>

              <div>
                <label htmlFor="tipo-sede" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Tipo de sede
                </label>
                <select
                  id="tipo-sede"
                  value={form.tipoSede}
                  onChange={(evento) =>
                    setForm((actual) => ({ ...actual, tipoSede: evento.target.value as NonNullable<Sede['tipoSede']> }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="principal">Principal</option>
                  <option value="secundaria">Secundaria</option>
                  <option value="alterna">Alterna</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-sena-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : 'Guardar sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
