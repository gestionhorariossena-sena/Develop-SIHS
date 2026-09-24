import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Aviso, CategoriaAviso } from '../types/api'

type Filtro = CategoriaAviso | 'todas'

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
 * Tablón de comunicados de coordinación — `GET /avisos/`, que cualquier
 * sesión puede leer (aprendiz, instructor y coordinación ven lo mismo).
 *
 * Mockup: `_Docs/Diseño/mockups-stitch/avisos_oficiales_y_eventos_rol_aprendiz_sihs_sena`.
 * Se respeta su estructura (destacado arriba + lista filtrable por
 * categoría), con una diferencia deliberada: el mockup muestra cosas que
 * el backend no tiene y que no se inventan acá — "ambientes cerrados",
 * "cómo afecta mi horario", ID de circular y descarga de PDF propio. Un
 * aviso es titulo + cuerpo + categoría + destinatario + vigencia + un
 * enlace opcional, y eso es lo que se pinta.
 *
 * Publicar/editar//eliminar (Administrador y Coordinador) todavía no tiene
 * pantalla: es el Prompt 1 de `_Docs/Diseño/PROMPTS_STITCH_VISTAS_PENDIENTES.md`.
 */
export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')

  useEffect(() => {
    apiGet<Aviso[]>('/avisos/')
      .then((lista) => {
        setAvisos(lista)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los comunicados.')
      })
      .finally(() => setCargando(false))
  }, [])

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
    <AppShell activo="Avisos">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Boletín oficial</p>
            <h1 className="mb-1 text-2xl font-bold text-on-surface dark:text-slate-100">
              Comunicados y novedades
            </h1>
            <p className="text-sm text-on-surface-variant dark:text-slate-400">
              Lo que publica la coordinación del centro: reprogramaciones, eventos y avisos de sede.
            </p>
          </div>

          {avisos && avisos.length > 0 && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-right dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs text-on-surface-variant dark:text-slate-400">Vigentes hoy</p>
              <p className="text-lg font-bold text-primary">
                {vigentesHoy} {vigentesHoy === 1 ? 'aviso' : 'avisos'}
              </p>
            </div>
          )}
        </div>

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

        {destacado && <TarjetaAviso aviso={destacado} destacado />}

        {resto.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {resto.map((aviso) => (
              <li key={aviso.idAviso}>
                <TarjetaAviso aviso={aviso} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}

function TarjetaAviso({ aviso, destacado = false }: { aviso: Aviso; destacado?: boolean }) {
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
        {aviso.publicadoPor && <span>Publicado por {aviso.publicadoPor}</span>}

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
    </article>
  )
}
