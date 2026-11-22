import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import senaLogo from '../assets/sena-logo.jpeg'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { apiGet } from '../services/api'
import { getPerfil, guardarPreferenciaTema } from '../services/perfil'
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
  /** Espejo de `soloInstructor` para el autoservicio del Aprendiz. */
  soloAprendiz?: boolean
  /** Solo Administrador — más estricto que `soloGestion` (que también deja
   * pasar a Coordinador). Panel de Administración de solicitudes de acceso
   * (SCRUM-121): "Ni Coordinador ni ningún otro rol la ve" es regla de
   * negocio explícita, un Coordinador no debe aprobar otros Coordinadores. */
  soloAdmin?: boolean
}

interface GrupoNav {
  grupo: string
  items: ItemNav[]
}

interface DestinoRapido extends ItemNav {
  grupo: string
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
      // Pasar lista: solo el instructor, y solo de sus propias clases.
      { etiqueta: 'Asistencia', ruta: '/asistencia', soloInstructor: true },
      { etiqueta: 'Mi horario', ruta: '/mi-horario-aprendiz', soloAprendiz: true },
      // Solo el Aprendiz abre conversaciones (lo valida el backend), así
      // que por ahora el ítem es suyo; la bandeja del Instructor es otra
      // pantalla pendiente de diseño.
      { etiqueta: 'Mi asistencia', ruta: '/mi-asistencia', soloAprendiz: true },
      // Antes se llamaba "Mensajes", pero la pantalla es un directorio de
      // instructores -- solo el vocero/subvocero de la ficha puede además
      // escribirles (ver puedeEscribir en MensajesAprendiz.tsx). El nombre
      // ya no prometía algo que la mayoría no puede usar.
      { etiqueta: 'Mis instructores', ruta: '/mensajes', soloAprendiz: true },
      // Centro de notificaciones del Aprendiz (pantalla propia, distinta
      // de la campana del navbar: ahí caben el historial y el detalle).
      { etiqueta: 'Notificaciones', ruta: '/notificaciones', soloAprendiz: true },
    ],
  },
  {
    grupo: 'Programación',
    items: [
      // `/horarios/nuevo` es el editor manual vigente. `/horarios/crear`
      // permanece registrado solo para enlaces históricos.
      { etiqueta: 'Crear horario', ruta: '/horarios/nuevo', soloGestion: true },
      { etiqueta: 'Importar con IA', ruta: '/horarios/asistente-ia', soloGestion: true },
      { etiqueta: 'Gestionar horarios', ruta: '/horarios/completos', soloGestion: true },
      { etiqueta: 'Publicaciones programadas', ruta: '/horarios/publicaciones-programadas', soloGestion: true },
      { etiqueta: 'Registro y versiones', ruta: '/horarios/historial', soloGestion: true },
    ],
  },
  {
    grupo: 'Datos académicos',
    items: [
      { etiqueta: 'Datos académicos', ruta: '/datos-academicos', soloGestion: true },
    ],
  },
  {
    grupo: 'Operación',
    items: [
      { etiqueta: 'Solicitudes de cambio', ruta: '/cambios', soloGestion: true },
      { etiqueta: 'Mis solicitudes', ruta: '/mis-solicitudes-cambio', soloInstructor: true },
      { etiqueta: 'Comunicados', ruta: '/avisos' },
    ],
  },
  {
    grupo: 'Administración',
    items: [
      // H-6: asignar y quitar roles exige Administrador en el backend
      // (`usuario_rol.py`), así que un Coordinador entraba a las dos
      // pantallas, veía los botones y se comía un 403 al usarlos. La regla
      // real es que repartir roles es del Administrador, y el menú ahora
      // dice lo mismo que el backend.
      { etiqueta: 'Usuarios', ruta: '/usuarios', soloAdmin: true },
      { etiqueta: 'Roles', ruta: '/roles', soloAdmin: true },
      // Dos caminos de alta, cada uno con su caso (H-7):
      //  - "Solicitudes de acceso": gente SIN cuenta, que la pidió desde el
      //    registro. Aprobar crea la cuenta (`/solicitudes-acceso`).
      //  - "Usuarios sin rol": gente que YA se registró por el formulario
      //    normal (Instructor/Aprendiz) y quedó sin ningún rol, así que no
      //    puede usar nada. El Panel no los ve: no hay solicitud detrás.
      { etiqueta: 'Solicitudes de acceso', ruta: '/panel-administracion', soloAdmin: true },
      { etiqueta: 'Usuarios sin rol', ruta: '/aprobar-solicitudes', soloAdmin: true },
    ],
  },
]

function normalizarBusqueda(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-CO').trim()
}

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

/**
 * Pestañas de "Mi trabajo" para el Aprendiz, visibles solo mientras está en
 * una de estas 4 pantallas (igual que el menú desplegable de arriba, pero
 * siempre a la vista en vez de un clic extra). `etiqueta` debe matchear
 * exactamente el `activo` que pasa cada página (MiHorarioAprendiz.tsx,
 * MensajesAprendiz.tsx, MiAsistencia.tsx, Notificaciones.tsx).
 */
const APRENDIZ_SUBNAV = [
  { etiqueta: 'Mi horario', ruta: '/mi-horario-aprendiz', icono: 'calendar_month' },
  { etiqueta: 'Mis instructores', ruta: '/mensajes', icono: 'forum' },
  // Solo vocero/subvocero: ver dónde se arma esta lista más abajo (esVocero).
  { etiqueta: 'Mensajes', ruta: '/mensajes/chat', icono: 'chat', soloVocero: true },
  { etiqueta: 'Mi asistencia', ruta: '/mi-asistencia', icono: 'fact_check' },
  { etiqueta: 'Notificaciones', ruta: '/notificaciones', icono: 'notifications' },
]

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
  const { signOut, session } = useAuth()
  const { setTema } = useTheme()
  const idUsuario = session?.user?.id ?? ''

  const [miPerfil, setMiPerfil] = useState<Usuario | null>(null)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)

  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null)
  // En ventanas estrechas, los grupos pasan al menú compacto para que no
  // se superpongan con el logo ni con las acciones de la derecha. El menú
  // central aparece a partir de xl para dejar espacio suficiente a los grupos.
  const [menuCompactoAbierto, setMenuCompactoAbierto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dialogoBusquedaRef = useRef<HTMLDialogElement>(null)
  const primerResultadoRef = useRef<HTMLAnchorElement>(null)
  const [consultaNavegacion, setConsultaNavegacion] = useState('')

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

  const esAprendiz =
    miPerfil?.roles.some((rol) => rol.nombre === 'Aprendiz') ?? false

  // Solo para mostrar (o no) la pestaña "Mensajes" del subnav -- quien de
  // verdad hace cumplir "solo vocero/subvocero escribe" es el backend
  // (RemitenteNoAutorizadoError en mensajeria_service.py).
  const [rolEnFicha, setRolEnFicha] = useState<string | null>(null)
  const esVocero = rolEnFicha === 'vocero' || rolEnFicha === 'subvocero'

  useEffect(() => {
    if (!esAprendiz) return
    apiGet<{ rolEnFicha: string | null }>('/ficha-usuario/mi-rol')
      .then((r) => setRolEnFicha(r.rolEnFicha))
      .catch(() => setRolEnFicha(null))
  }, [esAprendiz])

  const esAdministrador =
    miPerfil?.roles.some((rol) => rol.nombre === 'Administrador') ?? false

  // Los ítems marcados soloGestion solo tienen sentido para un
  // Administrador o Coordinador — mismo criterio que antes tenía "Usuarios".
  // soloInstructor es el espejo para el grupo "Mi trabajo". soloAdmin es más
  // estricto: ni Coordinador la ve (Panel de Administración, SCRUM-121).
  const nav = NAV.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter(
      (item) =>
        (!item.soloGestion || puedeGestionarUsuarios) &&
        (!item.soloInstructor || esInstructor) &&
        (!item.soloAprendiz || esAprendiz) &&
        (!item.soloAdmin || esAdministrador),
    ),
  })).filter((grupo) => grupo.items.length > 0)

  const destinosRapidos: DestinoRapido[] = [
    { ...INICIO, grupo: 'General' },
    ...nav.flatMap(({ grupo, items }) => items.map((item) => ({ ...item, grupo }))),
    ...(esAprendiz && esVocero ? [{ etiqueta: 'Mensajes', ruta: '/mensajes/chat', grupo: 'Mi trabajo' }] : []),
    ...(puedeGestionarUsuarios ? [
      { etiqueta: 'Calendario de horarios', ruta: '/calendario', grupo: 'Programación' },
      { etiqueta: 'Conflictos de horarios', ruta: '/horarios/auditoria', grupo: 'Programación' },
    ] : []),
  ]
  const palabrasBusqueda = normalizarBusqueda(consultaNavegacion).split(/\s+/)
  const resultadosNavegacion = destinosRapidos.filter(({ etiqueta, grupo }) => {
    const texto = normalizarBusqueda(`${etiqueta} ${grupo}`)
    return palabrasBusqueda.every((palabra) => texto.includes(palabra))
  })

  function abrirBuscador() {
    const dialogo = dialogoBusquedaRef.current
    if (!dialogo || dialogo.open) return
    setConsultaNavegacion('')
    dialogo.showModal()
  }

  // Mismo perfil cacheado que consulta ProtectedRoute al entrar a la
  // pantalla: los dos corren siempre juntos, así que comparten el request.
  useEffect(() => {
    if (!idUsuario) return

    getPerfil(idUsuario)
      .then((perfil) => {
        setMiPerfil(perfil)
        setErrorPerfil(null)
        // T-9: el tema guardado en el backend manda sobre el del
        // localStorage, para que la elección siga a la persona entre
        // navegadores y dispositivos.
        if (perfil.preferenciaTema) setTema(perfil.preferenciaTema)
      })
      .catch((err) => {
        const mensaje =
          err instanceof Error
            ? err.message
            : 'No se pudo cargar tu perfil.'

        setErrorPerfil(mensaje)
      })
  }, [idUsuario, setTema])

  useEffect(() => {
    function alAtajo(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        abrirBuscador()
      }
    }

    document.addEventListener('keydown', alAtajo)
    return () => document.removeEventListener('keydown', alAtajo)
  }, [])

  useEffect(() => {
    apiGet<Notificacion[]>('/notificaciones/')
      .then((datos) => {
        setNotificaciones(datos)
      })
      .catch(() => {
        setNotificaciones([])
      })

    // Los avisos nacen en el backend (publicaciones, cruces forzados,
    // solicitudes) mientras la persona sigue con la pestaña abierta: sin
    // este refresco el globo rojo solo se enteraba al recargar. Se salta
    // si la pestaña está oculta para no gastar peticiones en segundo plano.
    const intervalo = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      apiGet<Notificacion[]>('/notificaciones/')
        .then(setNotificaciones)
        .catch(() => {})
    }, 60_000)

    return () => window.clearInterval(intervalo)
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
          title="Esta sección aún no está disponible"
          className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-on-surface-variant/50"
        >
          {item.etiqueta}
        </span>
      )
    }

    return (
      <Link
        key={item.ruta}
        to={item.ruta}
        aria-current={esActivo ? 'page' : undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
          key={item.ruta}
          to={item.ruta}
          aria-current={esActivo ? 'page' : undefined}
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
        title="Esta sección aún no está disponible"
        className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-on-surface-variant/50"
      >
        {item.etiqueta}
      </span>
    )
  }

  const grupoTieneActivo = (grupo: GrupoNav) => grupo.items.some((item) => item.etiqueta === activo)

  const subnavAprendiz = APRENDIZ_SUBNAV.filter((item) => !item.soloVocero || esVocero)
  const mostrarSubnavAprendiz = esAprendiz && subnavAprendiz.some((item) => item.etiqueta === activo)
  const notificacionesSinLeer = notificaciones.filter((n) => !n.leida).length

  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed top-0 z-50 w-full border-b border-outline-variant/60 bg-surface-container-lowest print:hidden">
        <div className="flex h-16 w-full items-center justify-between gap-2 px-2 min-[360px]:px-3 sm:gap-3 sm:px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMenuCompactoAbierto((abierto) => !abierto)}
              aria-label="Menú de navegación"
              aria-expanded={menuCompactoAbierto}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface xl:hidden dark:border-slate-700"
            >
              <span className="material-symbols-outlined text-[20px]">
                {menuCompactoAbierto ? 'close' : 'menu'}
              </span>
            </button>

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

          </div>

          {/* `min-w-0` es lo que mantiene visible el bloque de la derecha:
            * un item flex tiene `min-width: auto` por defecto, así que sin
            * esto la nav se niega a encogerse por debajo del ancho de sus
            * botones y empuja las acciones (shrink-0) fuera de la pantalla.
            * Con los roles que abren más grupos de menú — Coordinador,
            * Administrador — eso dejaba "Cerrar sesión" cortado al borde
            * derecho en casi todas las vistas. */}
          {/* Sin `overflow-hidden`: los desplegables se abren debajo de la barra. */}
          <nav
            ref={dropdownRef}
            aria-label="Navegación principal"
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap xl:flex"
          >
            <Link
              to={INICIO.ruta!}
              aria-current={activo === INICIO.etiqueta ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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

          <div className="flex shrink-0 items-center gap-1 min-[360px]:gap-2">
            <button
              type="button"
              onClick={abrirBuscador}
              className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-lg border border-outline text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface lg:w-auto lg:px-3 dark:border-slate-700"
              aria-label="Buscar módulo"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
            >
              <span className="material-symbols-outlined text-[19px]" aria-hidden="true">search</span>
              <span className="hidden lg:inline">Buscar</span>
              <kbd className="hidden rounded border border-outline-variant px-1 font-mono text-[10px] text-on-surface-variant 2xl:inline dark:border-slate-600">Ctrl K</kbd>
            </button>
            <ThemeSelector
              alCambiar={(nuevo) => {
                if (idUsuario) guardarPreferenciaTema(idUsuario, nuevo).catch(() => {})
              }}
            />

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  const abrir = !notifAbiertas
                  setNotifAbiertas(abrir)
                  if (abrir) {
                    // El worker puede publicar mientras esta pestaña sigue
                    // abierta: refresca las notificaciones persistidas al
                    // abrir el panel, sin fabricar eventos en el cliente.
                    apiGet<Notificacion[]>('/notificaciones/')
                      .then(setNotificaciones)
                      .catch(() => {})
                  }
                }}
                title="Notificaciones"
                aria-label="Notificaciones"
                aria-haspopup="true"
                aria-expanded={notifAbiertas}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:bg-slate-700"
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

            <div className="hidden items-center gap-2 pl-1 2xl:flex">
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

            {/* Botón de icono (h-9 w-9, como notificaciones) y no uno con
              * texto: el de antes medía ~120px y era lo primero que se
              * salía de la barra cuando la nav crecía. El texto vive en
              * aria-label/title, así que sigue siendo alcanzable por
              * lectores de pantalla y por getByRole(..., { name }). */}
            <button
              onClick={() => void signOut()}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:border-slate-700"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>

        {menuCompactoAbierto && (
          <nav
            aria-label="Navegación principal"
            className="max-h-[70vh] overflow-y-auto border-t border-outline-variant bg-surface-container-lowest px-4 py-3 xl:hidden"
          >
            <Link
              to={INICIO.ruta!}
              aria-current={activo === INICIO.etiqueta ? 'page' : undefined}
              onClick={() => setMenuCompactoAbierto(false)}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                activo === INICIO.etiqueta
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {INICIO.etiqueta}
            </Link>

            {nav.map((grupo) => (
              <div key={grupo.grupo} className="mt-3">
                <p className="px-3 pb-1 text-[11px] font-medium text-on-surface-variant">
                  {grupo.grupo}
                </p>
                <div onClick={() => setMenuCompactoAbierto(false)}>
                  {grupo.items.map((item) => renderItemNavDropdown(item))}
                </div>
              </div>
            ))}
          </nav>
        )}
      </header>

      <dialog
        ref={dialogoBusquedaRef}
        aria-label="Buscar módulo"
        className="fixed inset-x-0 top-12 mx-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-lg backdrop:bg-slate-950/35 sm:top-24"
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) evento.currentTarget.close()
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            evento.preventDefault()
            evento.currentTarget.close()
          }
        }}
      >
        <div>
          <form
            className="flex items-center gap-3 border-b border-outline-variant px-4"
            onSubmit={(evento) => {
              evento.preventDefault()
              primerResultadoRef.current?.click()
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">search</span>
            <input
              autoFocus
              type="search"
              aria-label="Buscar módulo"
              value={consultaNavegacion}
              onChange={(evento) => setConsultaNavegacion(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'ArrowDown' && primerResultadoRef.current) {
                  evento.preventDefault()
                  primerResultadoRef.current.focus()
                }
              }}
              placeholder="Buscar módulo"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
            />
            <button type="button" onClick={() => dialogoBusquedaRef.current?.close()} className="rounded-md px-2 py-1 font-mono text-xs text-on-surface-variant hover:bg-surface-container" aria-label="Cerrar buscador">Esc</button>
          </form>
          <div className="max-h-[min(62dvh,440px)] overflow-y-auto p-2">
            {resultadosNavegacion.map((destino, indice) => (
              <Link
                key={destino.ruta}
                ref={indice === 0 ? primerResultadoRef : undefined}
                to={destino.ruta!}
                aria-label={destino.etiqueta}
                onClick={() => dialogoBusquedaRef.current?.close()}
                className="flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-container focus-visible:bg-surface-container"
              >
                <span>{destino.etiqueta}</span>
                <span className="text-right text-xs text-on-surface-variant">{destino.grupo}</span>
              </Link>
            ))}
            {resultadosNavegacion.length === 0 && <p role="status" className="px-3 py-8 text-center text-sm text-on-surface-variant">No hay módulos que coincidan</p>}
          </div>
        </div>
      </dialog>

      {mostrarSubnavAprendiz && (
        <nav
          aria-label="Mi trabajo"
          className="fixed top-16 z-40 flex w-full gap-1.5 overflow-x-auto border-b border-outline-variant bg-surface-container-low px-4 py-2.5 md:px-6 print:hidden"
        >
          {subnavAprendiz.map((item) => {
            const esActivo = item.etiqueta === activo
            return (
              <Link
                key={item.ruta}
                to={item.ruta}
                aria-current={esActivo ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  esActivo
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  {item.icono}
                </span>
                {item.etiqueta}
                {item.etiqueta === 'Notificaciones' && notificacionesSinLeer > 0 && (
                  <span
                    className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      esActivo ? 'bg-white/30 text-on-primary' : 'bg-error text-white'
                    }`}
                  >
                    {notificacionesSinLeer}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      )}

      {errorPerfil && (
        <div
          className={`fixed z-40 w-full border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 print:hidden ${
            mostrarSubnavAprendiz ? 'top-28' : 'top-16'
          }`}
        >
          {errorPerfil}
        </div>
      )}

      <main
        className={`w-full bg-surface ${
          mostrarSubnavAprendiz ? 'pt-28' : 'pt-16'
        }`}
      >
        <div className="min-w-0 p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
