import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import senaLogo from '../assets/sena-logo.jpeg'
import { useAuth } from '../hooks/useAuth'
import { apiGet } from '../services/api'
import type { Notificacion, Usuario } from '../types/api'
import { NotificacionesPanel } from './NotificacionesPanel'
import { ThemeSelector } from './ThemeSelector'

interface ItemNav {
  etiqueta: string
  ruta?: string
  /** Solo Administrador/Coordinador — mismo criterio que ya tenía "Usuarios". */
  soloGestion?: boolean
  /** Solo para quien tenga el rol Instructor — pantallas de autoservicio
   * ("Mi horario"), no tiene sentido que las vea un Coordinador/Aprendiz. */
  soloInstructor?: boolean
}

interface GrupoNav {
  grupo: string
  items: ItemNav[]
}

/**
 * Navbar superior con menús desplegables por grupo — rediseño 2026-09-06
 * siguiendo los mockups Stitch al pie de la letra (ver GUIA_DE_MARCA.md).
 * Los grupos (Programación/Formación/Recursos/Operación/Administración) son
 * los mismos de siempre, solo que ahora cada uno es un desplegable del
 * navbar en vez de una sección del sidebar — la lista de rutas/roles no
 * cambió. Los ítems sin `ruta` son módulos que todavía no existen (misma
 * convención que ya había: se muestran deshabilitados con tooltip).
 *
 * Todo el set de herramientas de coordinación (Programación/Formación/
 * Recursos/Operación, no solo Administración) es `soloGestion: true`
 * (pedido 2026-09-03: un Instructor no debe ni ver en el navbar algo para
 * lo que no tiene permiso). Esto es solo la vitrina — lo que de verdad
 * protege los datos son los permisos del backend
 * (`require_lectura_catalogo` en cada endpoint de catálogo); ocultar acá
 * evita la confusión de "por qué me deja hacer clic y después falla", no
 * reemplaza esa protección.
 */
const INICIO: ItemNav = { etiqueta: 'Inicio', ruta: '/dashboard' }

const NAV: GrupoNav[] = [
  {
    grupo: 'Mi trabajo',
    items: [
      { etiqueta: 'Mi horario', ruta: '/mi-horario', soloInstructor: true },
    ],
  },
  {
    grupo: 'Programación',
    items: [
      { etiqueta: 'Horarios', ruta: '/horarios/nuevo', soloGestion: true },
      { etiqueta: 'Horarios completos', ruta: '/horarios/completos', soloGestion: true },
      { etiqueta: 'Historial de horarios', ruta: '/horarios/historial', soloGestion: true },
      { etiqueta: 'Vista por fichas', ruta: '/vista-fichas', soloGestion: true },
      { etiqueta: 'Vista por instructores', ruta: '/vista-instructores', soloGestion: true },
      { etiqueta: 'Vista por ambientes', ruta: '/vista-ambientes', soloGestion: true },
      { etiqueta: 'Calendario general', ruta: '/calendario', soloGestion: true },
      { etiqueta: 'Auditoría de cruces', ruta: '/horarios/auditoria', soloGestion: true },
    ],
  },
  {
    grupo: 'Formación',
    items: [
      { etiqueta: 'Fichas', ruta: '/fichas', soloGestion: true },
      { etiqueta: 'Programas', ruta: '/programas', soloGestion: true },
      { etiqueta: 'Temáticas', soloGestion: true },
    ],
  },
  {
    grupo: 'Recursos',
    items: [
      { etiqueta: 'Instructores', ruta: '/instructores', soloGestion: true },
      { etiqueta: 'Ambientes', ruta: '/ambientes', soloGestion: true },
      { etiqueta: 'Sedes', ruta: '/sedes', soloGestion: true },
    ],
  },
  {
    grupo: 'Operación',
    items: [
      { etiqueta: 'Aprobar solicitudes de registro', ruta: '/aprobar-solicitudes', soloGestion: true },
      { etiqueta: 'Cambios', soloGestion: true },
      { etiqueta: 'Notificaciones', soloGestion: true },
    ],
  },
  {
    grupo: 'Administración',
    items: [
      { etiqueta: 'Usuarios', ruta: '/usuarios', soloGestion: true },
      { etiqueta: 'Código de instructor', ruta: '/codigo-instructor', soloGestion: true },
      { etiqueta: 'Roles', ruta: '/roles', soloGestion: true },
      { etiqueta: 'Configuración', soloGestion: true },
    ],
  },
]

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

interface AppShellProps {
  /** Etiqueta del ítem de NAV que debe verse activo (debe matchear `etiqueta` arriba). */
  activo: string
  children: ReactNode
}

/**
 * Navbar superior + contenido, compartido por toda pantalla autenticada.
 * Réplica de los mockups Stitch (stitch_sena_schedule_management_mockups)
 * — ver _Docs/Diseño/GUIA_DE_MARCA.md para tokens de color/tipografía.
 *
 * Los ítems de NAV sin `ruta` son módulos que todavía no existen en el
 * backend (ver backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md) — se muestran
 * deshabilitados. Cuando un módulo nuevo tenga pantalla, agregarle `ruta`
 * acá y aparece habilitado automáticamente.
 */
export function AppShell({ activo, children }: AppShellProps) {
  const { signOut } = useAuth()

  const [miPerfil, setMiPerfil] = useState<Usuario | null>(null)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [notifAbiertas, setNotifAbiertas] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const notifRef = useRef<HTMLDivElement>(null)

  const hayNoLeidas = notificaciones.some((n) => !n.leida)

  const puedeGestionarUsuarios =
    miPerfil?.roles.some(
      (rol) => rol.nombre === 'Administrador' || rol.nombre === 'Coordinador',
    ) ?? false

  const esInstructor =
    miPerfil?.roles.some((rol) => rol.nombre === 'Instructor') ?? false

  // Los ítems marcados soloGestion solo tienen sentido para un
  // Administrador o Coordinador — mismo criterio que antes tenía "Usuarios".
  // soloInstructor es el espejo para el grupo "Mi trabajo".
  const nav = NAV.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter(
      (item) =>
        (!item.soloGestion || puedeGestionarUsuarios) &&
        (!item.soloInstructor || esInstructor),
    ),
  })).filter((grupo) => grupo.items.length > 0)

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me')
      .then((perfil) => {
        setMiPerfil(perfil)
        setErrorPerfil(null)
      })
      .catch((err) => {
        const mensaje =
          err instanceof Error
            ? err.message
            : 'No se pudo cargar tu perfil.'

        setErrorPerfil(mensaje)
      })
  }, [])

  useEffect(() => {
    apiGet<Notificacion[]>('/notificaciones/')
      .then((datos) => {
        setNotificaciones(datos)
      })
      .catch(() => {
        setNotificaciones([])
      })
  }, [])

  useEffect(() => {
    if (!notifAbiertas) return

    function alClicFuera(evento: MouseEvent) {
      if (
        notifRef.current &&
        !notifRef.current.contains(evento.target as Node)
      ) {
        setNotifAbiertas(false)
      }
    }

    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setNotifAbiertas(false)
      }
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarTecla)

    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarTecla)
    }
  }, [notifAbiertas])

  useEffect(() => {
    if (!grupoAbierto) return

    function alClicFuera(evento: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(evento.target as Node)
      ) {
        setGrupoAbierto(null)
      }
    }

    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setGrupoAbierto(null)
      }
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarTecla)

    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarTecla)
    }
  }, [grupoAbierto])

  function renderItemNavFlat(item: ItemNav) {
    const esActivo = item.etiqueta === activo

    if (!item.ruta) {
      return (
        <span
          key={item.etiqueta}
          title="Módulo aún no implementado en el backend"
          className="cursor-not-allowed rounded-full px-3.5 py-1.5 text-sm font-semibold text-on-surface-variant/50"
        >
          {item.etiqueta}
        </span>
      )
    }

    return (
      <Link
        key={item.etiqueta}
        to={item.ruta}
        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all ${
          esActivo
            ? 'bg-primary-container text-on-primary-container'
            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
        }`}
      >
        {item.etiqueta}
      </Link>
    )
  }

  function renderItemNavDropdown(item: ItemNav) {
    const esActivo = item.etiqueta === activo

    if (item.ruta) {
      return (
        <Link
          key={item.etiqueta}
          to={item.ruta}
          onClick={() => setGrupoAbierto(null)}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            esActivo
              ? 'bg-primary-container text-on-primary-container font-bold'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          }`}
        >
          {item.etiqueta}
        </Link>
      )
    }

    return (
      <span
        key={item.etiqueta}
        title="Módulo aún no implementado en el backend"
        className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-on-surface-variant/50"
      >
        {item.etiqueta}
      </span>
    )
  }

  const grupoTieneActivo = (grupo: GrupoNav) => grupo.items.some((item) => item.etiqueta === activo)

  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed top-0 z-50 w-full bg-surface-container-lowest/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl print:hidden dark:bg-inverse-surface/90">
        <div className="flex h-16 w-full items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={senaLogo} alt="SENA" className="h-9 w-9 rounded-xl object-cover shadow-sm" />
              <div className="hidden flex-col sm:flex">
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="font-display text-base font-bold tracking-tight text-primary">SENA</span>
                  <span className="font-display text-base font-semibold tracking-tight text-on-surface">SIHS</span>
                </div>
                <span className="text-[11px] font-semibold tracking-wide text-on-surface-variant">CGMLTI Calle 52</span>
              </div>
            </Link>

            <span
              title="Programación abierta hasta el 12 de septiembre."
              className="hidden items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-1 text-[11px] font-medium text-on-secondary-container xl:flex"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Trimestre 3 · Sincronizado
            </span>
          </div>

          <nav ref={dropdownRef} className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            <Link
              to={INICIO.ruta!}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all ${
                activo === INICIO.etiqueta
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              {INICIO.etiqueta}
            </Link>

            {nav.map((grupo) =>
              /* Un grupo con un solo ítem (ej. "Mi trabajo" → "Mi horario")
               * no necesita desplegable: se renderiza plano, igual que
               * "Inicio". Evita un clic extra para llegar a un destino
               * único y mantiene ese ítem alcanzable sin abrir nada — lo
               * que además esperan los tests de MiHorario.test.tsx. */
              grupo.items.length === 1 ? (
                <div key={grupo.grupo}>{renderItemNavFlat(grupo.items[0])}</div>
              ) : (
              <div key={grupo.grupo} className="relative">
                <button
                  type="button"
                  onClick={() => setGrupoAbierto((actual) => (actual === grupo.grupo ? null : grupo.grupo))}
                  aria-haspopup="true"
                  aria-expanded={grupoAbierto === grupo.grupo}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all ${
                    grupoTieneActivo(grupo)
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  {grupo.grupo}
                </button>

                {grupoAbierto === grupo.grupo && (
                  <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {grupo.items.map((item) => renderItemNavDropdown(item))}
                  </div>
                )}
              </div>
              ),
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative hidden md:flex">
              <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                search
              </span>
              <input
                type="search"
                aria-label="Buscar ficha, instructor o ambiente"
                placeholder="Buscar ficha, instructor o ambiente…"
                disabled
                className="h-9 w-48 rounded-xl bg-surface pl-8 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none dark:bg-slate-700 xl:w-56"
              />
            </div>

            <ThemeSelector />

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifAbiertas((abiertas) => !abiertas)}
                title="Notificaciones"
                aria-label="Notificaciones"
                aria-haspopup="true"
                aria-expanded={notifAbiertas}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface dark:bg-slate-700"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {hayNoLeidas && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-tertiary ring-2 ring-surface-container-lowest" />
                )}
              </button>

              {notifAbiertas && (
                <NotificacionesPanel
                  notificaciones={notificaciones}
                  onNotificacionesActualizadas={setNotificaciones}
                  onCerrar={() => setNotifAbiertas(false)}
                />
              )}
            </div>

            <div className="hidden items-center gap-2 pl-1 xl:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                {miPerfil ? letraInicial(miPerfil.nombre) : '·'}
              </span>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-on-surface">
                  {miPerfil ? miPerfil.nombre : 'Cargando…'}
                </p>
                <p className="text-[11px] text-on-surface-variant">{miPerfil?.email ?? ''}</p>
              </div>
            </div>

            <button
              onClick={() => void signOut()}
              className="rounded-xl border border-outline px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container-high dark:border-slate-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {errorPerfil && (
        <div className="fixed top-16 z-40 w-full border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 print:hidden">
          {errorPerfil}
        </div>
      )}

      <main className="w-full bg-[radial-gradient(ellipse_at_top,_#eaf7ec_0%,_#f8fafc_60%,_#faf8ff_100%)] pt-16 dark:bg-none">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
