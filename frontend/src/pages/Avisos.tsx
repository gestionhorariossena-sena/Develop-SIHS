import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../services/api'
import { getPerfil } from '../services/perfil'
import type { Aviso, AvisoInput, CategoriaAviso, Ficha, Sede, Usuario } from '../types/api'

type Filtro = CategoriaAviso | 'todas'

interface FormularioAviso {
  titulo: string
  cuerpo: string
  categoria: CategoriaAviso
  idFicha: string
  idSede: string
  adjuntoUrl: string
  vigenteHasta: string
}

const FORMULARIO_VACIO: FormularioAviso = {
  titulo: '',
  cuerpo: '',
  categoria: 'eventos',
  idFicha: '',
  idSede: '',
  adjuntoUrl: '',
  vigenteHasta: '',
}

const CATEGORIAS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todos los comunicados' },
  { valor: 'reprog', etiqueta: 'Cancelaciones y reprogramaciones' },
  { valor: 'eventos', etiqueta: 'Eventos y convocatorias' },
  { valor: 'sede', etiqueta: 'Sede' },
  { valor: 'extraordinario', etiqueta: 'Extraordinarios' },
]

/** Cada categoría con su color, siguiendo la regla de la guía de marca:
 * fondo "container" claro + texto oscuro del mismo matiz, nunca saturado. */
const ESTILO_CATEGORIA: Record<CategoriaAviso, string> = {
  reprog: 'bg-tertiary-container text-on-tertiary-container',
  eventos: 'bg-primary-container text-on-primary-container',
  sede: 'bg-surface-container text-on-surface-variant',
  extraordinario: 'bg-error-container text-on-error-container',
}

const ETIQUETA_CATEGORIA: Record<CategoriaAviso, string> = {
  reprog: 'Reprogramación',
  eventos: 'Evento',
  sede: 'Sede',
  extraordinario: 'Comunicado extraordinario',
}

const ICONO_CATEGORIA: Record<CategoriaAviso, string> = {
  reprog: 'event_repeat',
  eventos: 'celebration',
  sede: 'domain',
  extraordinario: 'campaign',
}

function formatFechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "hace 3 horas" / "hace 2 días" — el mockup lo muestra así, y para un
 * comunicado importa más lo reciente que la fecha exacta. */
function hace(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)

  if (minutos < 1) return 'recién publicado'
  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`

  const dias = Math.round(horas / 24)
  if (dias < 31) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`

  return `el ${formatFechaLarga(iso)}`
}

/** Un aviso está vencido cuando su vigencia ya pasó. El backend guarda
 * `vigenteHasta` pero no filtra por él: los vencidos siguen llegando y acá
 * se atenúan en vez de esconderse — que algo haya vencido es información. */
function estaVencido(aviso: Aviso): boolean {
  if (!aviso.vigenteHasta) return false
  const hoy = new Date().toISOString().slice(0, 10)
  return aviso.vigenteHasta < hoy
}

function destinatario(aviso: Aviso): string {
  if (aviso.fichaCodigo) return `Ficha ${aviso.fichaCodigo}`
  if (aviso.sedeNombre) return aviso.sedeNombre
  if (aviso.idFicha) return 'Una ficha'
  if (aviso.idSede) return 'Una sede'
  return 'Todo el centro'
}

/**
 * Tablón de comunicados de coordinación — `GET /avisos/`, con resultados
 * limitados por el backend a la ficha/sede del usuario y avisos generales.
 *
 * Mockup: `_Docs/Diseño/mockups-stitch/avisos_oficiales_y_eventos_rol_aprendiz_sihs_sena`.
 * Se respeta su estructura (destacado arriba + lista filtrable por
 * categoría), con una diferencia deliberada: el mockup muestra cosas que
 * el backend no tiene y que no se inventan acá — "ambientes cerrados",
 * "cómo afecta mi horario", ID de circular y descarga de PDF propio. Un
 * aviso es titulo + cuerpo + categoría + destinatario + vigencia + un
 * enlace opcional, y eso es lo que se pinta.
 *
 */
export function Avisos() {
  const { session } = useAuth()
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [avisoEditando, setAvisoEditando] = useState<number | null>(null)
  const [formulario, setFormulario] = useState<FormularioAviso>(FORMULARIO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)

  const puedeGestionar = perfil?.roles.some((rol) => rol.nombre === 'Administrador' || rol.nombre === 'Coordinador') ?? false

  useEffect(() => {
    let cancelado = false

    apiGet<Aviso[]>('/avisos/')
      .then((lista) => {
        if (!cancelado) {
          setAvisos(lista)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los comunicados.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    if (session) {
      getPerfil(session.user.id)
        .then((datos) => {
          if (!cancelado) setPerfil(datos)
        })
        .catch(() => {
          if (!cancelado) setPerfil(null)
        })
    }

    return () => {
      cancelado = true
    }
  }, [session])

  useEffect(() => {
    if (!puedeGestionar) return

    let cancelado = false
    Promise.all([apiGet<Ficha[]>('/fichas/'), apiGet<Sede[]>('/sedes')])
      .then(([listaFichas, listaSedes]) => {
        if (!cancelado) {
          setFichas(listaFichas)
          setSedes(listaSedes)
          setErrorCatalogos(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErrorCatalogos(err instanceof ApiError ? err.message : 'No se pudieron cargar las opciones de destinatario.')
        }
      })

    return () => {
      cancelado = true
    }
  }, [puedeGestionar])

  function abrirNuevoAviso() {
    setAvisoEditando(null)
    setFormulario(FORMULARIO_VACIO)
    setError(null)
    setEditorAbierto(true)
  }

  function abrirEdicion(aviso: Aviso) {
    setAvisoEditando(aviso.idAviso)
    setFormulario({
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      categoria: aviso.categoria,
      idFicha: aviso.idFicha?.toString() ?? '',
      idSede: aviso.idSede?.toString() ?? '',
      adjuntoUrl: aviso.adjuntoUrl ?? '',
      vigenteHasta: aviso.vigenteHasta ?? '',
    })
    setError(null)
    setEditorAbierto(true)
  }

  async function guardarAviso(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return

    const data: AvisoInput = {
      titulo: formulario.titulo.trim(),
      cuerpo: formulario.cuerpo.trim(),
      categoria: formulario.categoria,
      idFicha: formulario.idFicha ? Number(formulario.idFicha) : null,
      idSede: formulario.idSede ? Number(formulario.idSede) : null,
      adjuntoUrl: formulario.adjuntoUrl.trim() || null,
      vigenteHasta: formulario.vigenteHasta || null,
    }

    setGuardando(true)
    setError(null)
    try {
      if (avisoEditando === null) {
        const creado = await apiPost<Aviso>('/avisos/', data)
        setAvisos((actuales) => [creado, ...(actuales ?? [])])
        setMensajeExito('Comunicado publicado.')
      } else {
        const actualizado = await apiPut<Aviso>(`/avisos/${avisoEditando}`, data)
        setAvisos((actuales) => (actuales ?? []).map((aviso) => (aviso.idAviso === actualizado.idAviso ? actualizado : aviso)))
        setMensajeExito('Comunicado actualizado.')
      }
      setEditorAbierto(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el comunicado.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarAviso(aviso: Aviso) {
    if (!window.confirm(`¿Eliminar el comunicado "${aviso.titulo}"?`)) return

    setEliminandoId(aviso.idAviso)
    setError(null)
    try {
      await apiDelete(`/avisos/${aviso.idAviso}`)
      setAvisos((actuales) => (actuales ?? []).filter((item) => item.idAviso !== aviso.idAviso))
      setMensajeExito('Comunicado eliminado.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el comunicado.')
    } finally {
      setEliminandoId(null)
    }
  }

  // El filtro se aplica en el cliente aunque el endpoint acepte
  // `?categoria=`: los contadores de cada píldora necesitan la lista
  // completa, y son pocos avisos por definición.
  const visibles = useMemo(
    () => (avisos ?? []).filter((a) => filtro === 'todas' || a.categoria === filtro),
    [avisos, filtro],
  )

  const vigentesHoy = useMemo(() => (avisos ?? []).filter((a) => !estaVencido(a)).length, [avisos])

  const [destacado, ...resto] = visibles

  return (
    <AppShell activo="Comunicados">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Comunicaciones · Boletín oficial</p>
            <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">
              Comunicados del centro
            </h1>
            <p className="text-sm text-on-surface-variant dark:text-slate-400">
              Lo que publica la coordinación del centro: reprogramaciones, eventos y avisos de sede.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {avisos && avisos.length > 0 && (
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-right dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-on-surface-variant dark:text-slate-400">Vigentes hoy</p>
                <p className="text-lg font-bold text-primary">
                  {vigentesHoy} {vigentesHoy === 1 ? 'aviso' : 'avisos'}
                </p>
              </div>
            )}
            {puedeGestionar && (
              <button
                type="button"
                onClick={abrirNuevoAviso}
                className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                Publicar comunicado
              </button>
            )}
          </div>
        </div>

        {mensajeExito && (
          <p role="status" className="mb-4 rounded-xl border border-primary/20 bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container">
            {mensajeExito}
          </p>
        )}

        {errorCatalogos && puedeGestionar && (
          <p role="alert" className="mb-4 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {errorCatalogos}
          </p>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          {CATEGORIAS.map((categoria) => {
            const cantidad =
              categoria.valor === 'todas'
                ? (avisos ?? []).length
                : (avisos ?? []).filter((a) => a.categoria === categoria.valor).length

            return (
              <button
                key={categoria.valor}
                type="button"
                onClick={() => setFiltro(categoria.valor)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  filtro === categoria.valor
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {categoria.etiqueta}
                {cantidad > 0 && <span className="ml-1.5 opacity-70">{cantidad}</span>}
              </button>
            )
          })}
        </div>

        {cargando && <p className="text-sm text-on-surface-variant dark:text-slate-400">Cargando comunicados…</p>}

        {error && (
          <p className="rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {error}
          </p>
        )}

        {!cargando && !error && visibles.length === 0 && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800">
            <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-on-surface-variant">
              campaign
            </span>
            <p className="mt-2 text-sm font-semibold text-on-surface dark:text-slate-100">
              {filtro === 'todas'
                ? 'Todavía no hay comunicados publicados'
                : 'No hay comunicados en esta categoría'}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">
              Cuando la coordinación publique uno, aparecerá acá.
            </p>
          </div>
        )}

        {destacado && (
          <TarjetaAviso
            aviso={destacado}
            destacado
            puedeGestionar={puedeGestionar}
            eliminando={eliminandoId === destacado.idAviso}
            onEditar={() => abrirEdicion(destacado)}
            onEliminar={() => void eliminarAviso(destacado)}
          />
        )}

        {resto.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {resto.map((aviso) => (
              <li key={aviso.idAviso}>
                <TarjetaAviso
                  aviso={aviso}
                  puedeGestionar={puedeGestionar}
                  eliminando={eliminandoId === aviso.idAviso}
                  onEditar={() => abrirEdicion(aviso)}
                  onEliminar={() => void eliminarAviso(aviso)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {editorAbierto && (
        <EditorAviso
          titulo={avisoEditando === null ? 'Publicar comunicado' : 'Editar comunicado'}
          formulario={formulario}
          fichas={fichas}
          sedes={sedes}
          guardando={guardando}
          error={error}
          editando={avisoEditando !== null}
          onChange={setFormulario}
          onCerrar={() => setEditorAbierto(false)}
          onSubmit={(evento) => void guardarAviso(evento)}
        />
      )}
    </AppShell>
  )
}

function TarjetaAviso({
  aviso,
  destacado = false,
  puedeGestionar = false,
  eliminando = false,
  onEditar,
  onEliminar,
}: {
  aviso: Aviso
  destacado?: boolean
  puedeGestionar?: boolean
  eliminando?: boolean
  onEditar?: () => void
  onEliminar?: () => void
}) {
  const vencido = estaVencido(aviso)

  return (
    <article
      className={`rounded-xl border bg-surface-container-lowest shadow-sm dark:bg-slate-800 ${
        destacado ? 'border-primary/30 p-6' : 'border-outline-variant p-5 dark:border-slate-700'
      } ${vencido ? 'opacity-60' : ''}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_CATEGORIA[aviso.categoria]}`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            {ICONO_CATEGORIA[aviso.categoria]}
          </span>
          {ETIQUETA_CATEGORIA[aviso.categoria]}
        </span>

        <span className="rounded-full bg-surface-container-low px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
          {destinatario(aviso)}
        </span>

        {vencido && (
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
            Vencido
          </span>
        )}

        <span className="ml-auto text-xs text-on-surface-variant dark:text-slate-400">{hace(aviso.fechaPublicacion)}</span>
      </div>

      <h2
        className={`font-bold text-on-surface dark:text-slate-100 ${destacado ? 'text-lg' : 'text-base'}`}
      >
        {aviso.titulo}
      </h2>

      <p className="mt-1 whitespace-pre-line text-sm text-on-surface-variant dark:text-slate-300">{aviso.cuerpo}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant dark:text-slate-400">
        {aviso.publicadorNombre && <span>Publicado por {aviso.publicadorNombre}</span>}

        {aviso.vigenteHasta && <span>Vigente hasta el {formatFechaLarga(aviso.vigenteHasta)}</span>}

        {aviso.adjuntoUrl && (
          <a
            href={aviso.adjuntoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              description
            </span>
            Ver documento adjunto
          </a>
        )}
      </div>

      {puedeGestionar && (
        <div className="mt-4 flex gap-2 border-t border-outline-variant pt-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onEditar}
            className="h-9 rounded-lg border border-outline-variant px-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container dark:border-slate-600 dark:text-slate-300"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onEliminar}
            disabled={eliminando}
            className="h-9 rounded-lg border border-error/30 px-3 text-sm font-semibold text-error hover:bg-error-container disabled:opacity-50"
          >
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      )}
    </article>
  )
}

function EditorAviso({
  titulo,
  formulario,
  fichas,
  sedes,
  guardando,
  error,
  editando,
  onChange,
  onCerrar,
  onSubmit,
}: {
  titulo: string
  formulario: FormularioAviso
  fichas: Ficha[]
  sedes: Sede[]
  guardando: boolean
  error: string | null
  editando: boolean
  onChange: (formulario: FormularioAviso) => void
  onCerrar: () => void
  onSubmit: (evento: React.FormEvent<HTMLFormElement>) => void
}) {
  function actualizar<K extends keyof FormularioAviso>(campo: K, valor: FormularioAviso[K]) {
    onChange({ ...formulario, [campo]: valor })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editor-aviso"
        className="my-8 w-full max-w-2xl rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 id="titulo-editor-aviso" className="mb-5 text-xl font-bold text-on-surface dark:text-slate-100">
          {titulo}
        </h2>
        <form onSubmit={onSubmit} className="grid gap-4">
          <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
            Título
            <input
              required
              maxLength={200}
              value={formulario.titulo}
              onChange={(evento) => actualizar('titulo', evento.target.value)}
              className="h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
            Categoría
            <select
              value={formulario.categoria}
              onChange={(evento) => actualizar('categoria', evento.target.value as CategoriaAviso)}
              className="h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {CATEGORIAS.filter((categoria) => categoria.valor !== 'todas').map((categoria) => (
                <option key={categoria.valor} value={categoria.valor}>
                  {categoria.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
            Contenido
            <textarea
              required
              rows={5}
              value={formulario.cuerpo}
              onChange={(evento) => actualizar('cuerpo', evento.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
              Dirigido a una ficha
              <select
                value={formulario.idFicha}
                onChange={(evento) => actualizar('idFicha', evento.target.value)}
                className="h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Todas las fichas</option>
                {fichas.map((ficha) => (
                  <option key={ficha.idFicha} value={ficha.idFicha}>
                    {ficha.codigoFicha}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
              Dirigido a una sede
              <select
                value={formulario.idSede}
                onChange={(evento) => actualizar('idSede', evento.target.value)}
                className="h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Todas las sedes</option>
                {sedes.map((sede) => (
                  <option key={sede.idSede} value={sede.idSede}>
                    {sede.nombreSede}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="-mt-2 text-xs text-on-surface-variant dark:text-slate-400">
            Si eliges una ficha o sede, solo sus usuarios verán el comunicado. Si eliges ambas, basta pertenecer a una de ellas.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
              Vigente hasta (opcional)
              <input
                type="date"
                value={formulario.vigenteHasta}
                onChange={(evento) => actualizar('vigenteHasta', evento.target.value)}
                className="h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-on-surface-variant dark:text-slate-300">
              Enlace adjunto (opcional)
              <input
                type="url"
                value={formulario.adjuntoUrl}
                onChange={(evento) => actualizar('adjuntoUrl', evento.target.value)}
                placeholder="https://…"
                className="h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 font-normal text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-error/20 bg-error-container px-3 py-2 text-sm text-on-error-container">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="h-10 rounded-xl px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
