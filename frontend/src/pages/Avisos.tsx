import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { InsigniaVitrina } from '../components/InsigniaVitrina'
import { apiGet, ApiError } from '../services/api'
import type { Aviso, CategoriaAviso } from '../types/api'

type FiltroCategoria = 'all' | 'reprog' | 'eventos' | 'sede'

const PILLS: { id: FiltroCategoria; etiqueta: string }[] = [
  { id: 'all', etiqueta: 'Todos los comunicados' },
  { id: 'reprog', etiqueta: 'Cancelaciones & Reprogramaciones' },
  { id: 'eventos', etiqueta: 'Eventos & Convocatorias' },
  { id: 'sede', etiqueta: 'Circulares de Sede' },
]

const ETIQUETA_CATEGORIA: Record<CategoriaAviso, string> = {
  reprog: 'Cancelación / Reprogramación',
  eventos: 'Evento / Convocatoria',
  sede: 'Circular de Sede',
  extraordinario: 'Comunicado Extraordinario',
}

const CLASE_BADGE_CATEGORIA: Record<CategoriaAviso, string> = {
  reprog: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  eventos: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  sede: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  extraordinario: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState<FiltroCategoria>('all')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    apiGet<Aviso[]>('/avisos/')
      .then(setAvisos)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar los avisos.'))
      .finally(() => setCargando(false))
  }, [])

  // El aviso extraordinario más reciente se destaca como hero; si no hay
  // ninguno, se destaca el aviso más reciente en general (GET /avisos/ ya
  // llega ordenado por fechaPublicacion desc).
  const destacado = useMemo(() => {
    const extraordinarios = avisos.filter((aviso) => aviso.categoria === 'extraordinario')
    return extraordinarios[0] ?? avisos[0] ?? null
  }, [avisos])

  // Filtro por categoría (píldoras) y buscador: ambos client-side sobre el
  // resultado ya traído por GET /avisos/, igual que hace el mockup.
  const texto = busqueda.trim().toLocaleLowerCase('es-CO')
  const feed = avisos
    .filter((aviso) => aviso.idAviso !== destacado?.idAviso)
    .filter((aviso) => categoriaFiltro === 'all' || aviso.categoria === categoriaFiltro)
    .filter((aviso) => !texto || `${aviso.titulo} ${aviso.cuerpo}`.toLocaleLowerCase('es-CO').includes(texto))

  const vigentesHoy = avisos.filter((aviso) => !aviso.vigenteHasta || new Date(aviso.vigenteHasta) >= new Date()).length

  return (
    <AppShell activo="Avisos y Eventos">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Avisos & Eventos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Comunicados y novedades oficiales de Coordinación: cancelaciones, reprogramaciones, eventos y circulares de sede.
          </p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {vigentesHoy} vigente{vigentesHoy === 1 ? '' : 's'} de {avisos.length}
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros de avisos">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setCategoriaFiltro(pill.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  categoriaFiltro === pill.id
                    ? 'bg-sena-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {pill.etiqueta}
              </button>
            ))}
          </div>
          <div className="lg:w-64">
            <label htmlFor="buscar-aviso" className="sr-only">
              Buscar por tema, ficha o ambiente
            </label>
            <input
              id="buscar-aviso"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por tema, ficha o ambiente..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sena-600 focus:ring-1 focus:ring-sena-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando avisos...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
            {destacado && (
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${CLASE_BADGE_CATEGORIA[destacado.categoria]}`}>
                    {destacado.categoria === 'extraordinario' ? 'COMUNICADO EXTRAORDINARIO' : ETIQUETA_CATEGORIA[destacado.categoria]}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Publicado {formatearFecha(destacado.fechaPublicacion)}</span>
                </div>
                <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{destacado.titulo}</h2>
                <p className="mb-4 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{destacado.cuerpo}</p>
                {destacado.publicadorNombre && (
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Publicado por {destacado.publicadorNombre}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {destacado.adjuntoUrl && (
                    <a
                      href={destacado.adjuntoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700"
                    >
                      Descargar adjunto
                    </a>
                  )}
                  <button
                    disabled
                    title="Aún no implementado en el backend: requiere relacionar el aviso con un bloque de horarios."
                    className="cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                  >
                    Ver cómo afecta mi horario
                  </button>
                </div>
              </article>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tablón de comunicados</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando {feed.length} aviso{feed.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {feed.map((aviso) => (
                <article key={aviso.idAviso} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CLASE_BADGE_CATEGORIA[aviso.categoria]}`}>
                      {ETIQUETA_CATEGORIA[aviso.categoria]}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatearFecha(aviso.fechaPublicacion)}</span>
                  </div>
                  <h4 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">{aviso.titulo}</h4>
                  <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{aviso.cuerpo}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {aviso.publicadorNombre && <span>{aviso.publicadorNombre}</span>}
                    {aviso.adjuntoUrl && (
                      <a href={aviso.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-sena-700 hover:underline dark:text-sena-400">
                        Ver adjunto
                      </a>
                    )}
                  </div>
                </article>
              ))}

              {feed.length === 0 && (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  No hay avisos que coincidan con los filtros.
                </p>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-6 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Estado de Sede Calle 52</p>
                <InsigniaVitrina />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                El aforo y la disponibilidad de ambientes en tiempo real no tienen tabla propia en el backend todavía —
                fuera de alcance de este ticket (ver descripción). Cuando exista ese módulo, esta tarjeta se conecta a
                un fetch real igual que el resto de la página.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hitos del trimestre</p>
                <InsigniaVitrina />
              </div>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                El calendario institucional de hitos no tiene tabla propia en el backend todavía — fuera de alcance de
                este ticket (ver descripción).
              </p>
              <button
                disabled
                title="Aún no implementado en el backend"
                className="w-full cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Descargar calendario completo (PDF)
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Directorio de Coordinación</p>
                <InsigniaVitrina />
              </div>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Se revisó si GET /coordinaciones/ o GET /usuarios/ ya exponían nombre/correo/rol para armar esta
                tarjeta con datos reales: ambos endpoints exigen rol Coordinador o Administrador
                (require_admin/require_lectura_catalogo), así que un Aprendiz autenticado no puede consultarlos —
                queda como vitrina hasta que exista un endpoint de solo lectura accesible para Aprendiz.
              </p>
              <a
                href="https://mesadeayuda.sena.edu.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sena-700"
              >
                Crear Radicado en Mesa de Ayuda
              </a>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  )
}
