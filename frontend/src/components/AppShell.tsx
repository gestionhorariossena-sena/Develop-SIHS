import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import senaLogo from '../assets/sena-logo.jpeg'
import { useAuth } from '../hooks/useAuth'
import { apiGet } from '../services/api'
import type { Usuario } from '../types/api'
import { NotificacionesPanel } from './NotificacionesPanel'
import { NOTIFICACIONES } from '../data/notificacionesEjemplo'

interface ItemNav {
  etiqueta: string
  ruta?: string
}

const NAV: ItemNav[] = [
  { etiqueta: 'Inicio', ruta: '/dashboard' },
  { etiqueta: 'Horarios', ruta: '/horarios/nuevo' },
  { etiqueta: 'Historial de horarios', ruta: '/horarios/historial' },
  { etiqueta: 'Ambientes', ruta: '/ambientes' },
  { etiqueta: 'Instructores', ruta: '/instructores' },
  { etiqueta: 'Fichas', ruta: '/fichas' },
  { etiqueta: 'Usuarios', ruta: '/usuarios' },
  { etiqueta: 'Reportes' },
]

function letraInicial(nombre: string) {
  return nombre.trim().charAt(0).toUpperCase()
}

// El menú flota sobre el contenido (position: fixed) en vez de empujarlo —
// así el grid de horarios (mínimo 1100px, ver GridHorario.tsx) siempre
// tiene el ancho completo del viewport disponible y nunca necesita scroll
// lateral, esté el menú abierto o cerrado.
const RETRASO_APERTURA_HOVER_MS = 1500
const RETRASO_CIERRE_HOVER_MS = 300

interface AppShellProps {
  /** Etiqueta del ítem de NAV que debe verse activo (debe matchear `etiqueta` arriba). */
  activo: string
  children: ReactNode
}

/**
 * Sidebar (overlay) + header institucional, compartido por Dashboard.tsx y
 * cualquier pantalla nueva bajo /dashboard. Réplica de
 * _Docs/Diseño/mockups-institucionales/03-dashboard.png — ver
 * _Docs/Diseño/GUIA_DE_MARCA.md para las reglas de color/tipografía que
 * sigue este componente.
 *
 * Los ítems de NAV sin `ruta` son módulos que todavía no existen en el
 * backend (ver backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md) — se muestran
 * deshabilitados. Cuando un módulo nuevo tenga pantalla, agregarle `ruta`
 * acá y aparece habilitado automáticamente.
 */
export function AppShell({ activo, children }: AppShellProps) {
  const { signOut } = useAuth()
  const [miPerfil, setMiPerfil] = useState<Usuario | null>(null)
  const [navAbierta, setNavAbierta] = useState(false)
  const abiertaPorHoverRef = useRef(false)
  const temporizadorAperturaRef = useRef<number | null>(null)
  const temporizadorCierreRef = useRef<number | null>(null)
  const [notifAbiertas, setNotifAbiertas] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const hayNoLeidas = NOTIFICACIONES.some((n) => !n.leida)
  const esAdministrador = miPerfil?.roles.some((rol) => rol.nombre === 'Administrador') ?? false
  // "Usuarios" administra roles de todo el sistema — solo tiene sentido
  // mostrárselo a un Administrador (el backend igual lo protege con
  // require_admin, esto es solo para no ofrecer un enlace que va a fallar).
  const nav = NAV.filter((item) => item.etiqueta !== 'Usuarios' || esAdministrador)

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me')
      .then(setMiPerfil)
      .catch((err) => console.error('No se pudo cargar /usuarios/me:', err))
  }, [])

  useEffect(() => {
    return () => {
      if (temporizadorAperturaRef.current) window.clearTimeout(temporizadorAperturaRef.current)
      if (temporizadorCierreRef.current) window.clearTimeout(temporizadorCierreRef.current)
    }
  }, [])

  useEffect(() => {
    if (!notifAbiertas) return

    function alClicFuera(evento: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(evento.target as Node)) {
        setNotifAbiertas(false)
      }
    }

    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setNotifAbiertas(false)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarTecla)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarTecla)
    }
  }, [notifAbiertas])

  function cancelarTemporizadores() {
    if (temporizadorAperturaRef.current) {
      window.clearTimeout(temporizadorAperturaRef.current)
      temporizadorAperturaRef.current = null
    }
    if (temporizadorCierreRef.current) {
      window.clearTimeout(temporizadorCierreRef.current)
      temporizadorCierreRef.current = null
    }
  }

  function abrirManual() {
    cancelarTemporizadores()
    abiertaPorHoverRef.current = false
    setNavAbierta(true)
  }

  function cerrarManual() {
    cancelarTemporizadores()
    abiertaPorHoverRef.current = false
    setNavAbierta(false)
  }

  /** Borde izquierdo de la pantalla: dejar el cursor ~1.5s la abre solo. */
  function alEntrarBordeHover() {
    if (navAbierta || temporizadorAperturaRef.current) return
    temporizadorAperturaRef.current = window.setTimeout(() => {
      abiertaPorHoverRef.current = true
      setNavAbierta(true)
      temporizadorAperturaRef.current = null
    }, RETRASO_APERTURA_HOVER_MS)
  }

  function alSalirBordeHover() {
    if (temporizadorAperturaRef.current) {
      window.clearTimeout(temporizadorAperturaRef.current)
      temporizadorAperturaRef.current = null
    }
  }

  /** Si se abrió por hover, alejar el cursor del panel vuelve a cerrarlo. */
  function alEntrarPanel() {
    if (temporizadorCierreRef.current) {
      window.clearTimeout(temporizadorCierreRef.current)
      temporizadorCierreRef.current = null
    }
  }

  function alSalirPanel() {
    if (!abiertaPorHoverRef.current) return
    temporizadorCierreRef.current = window.setTimeout(() => {
      setNavAbierta(false)
      abiertaPorHoverRef.current = false
      temporizadorCierreRef.current = null
    }, RETRASO_CIERRE_HOVER_MS)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {!navAbierta && (
        <div
          onMouseEnter={alEntrarBordeHover}
          onMouseLeave={alSalirBordeHover}
          className="fixed left-0 top-0 z-40 h-screen w-4 print:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        onMouseEnter={alEntrarPanel}
        onMouseLeave={alSalirPanel}
        className={`fixed left-0 top-0 z-50 flex h-screen w-60 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-200 print:hidden ${
          navAbierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="mb-8 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <img src={senaLogo} alt="SENA" className="h-9 w-9 rounded-lg object-cover" />
              <div>
                <p className="text-sm font-bold text-slate-900">SIHS</p>
                <p className="text-xs text-slate-500">CGMLTI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cerrarManual}
              title="Ocultar menú"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M4 12h16" />
              </svg>
            </button>
          </div>

          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400">GESTIÓN</p>
          <nav className="space-y-1">
            {nav.map((item) => {
              const esActivo = item.etiqueta === activo

              if (item.ruta) {
                return (
                  <Link
                    key={item.etiqueta}
                    to={item.ruta}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      esActivo
                        ? 'bg-sena-50 text-sena-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 shrink-0 rounded ${
                        esActivo ? 'bg-sena-600' : 'border border-slate-300'
                      }`}
                    />
                    {item.etiqueta}
                  </Link>
                )
              }

              return (
                <span
                  key={item.etiqueta}
                  title="Módulo aún no implementado en el backend"
                  className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400"
                >
                  <span className="h-3.5 w-3.5 shrink-0 rounded border border-slate-300" />
                  {item.etiqueta}
                </span>
              )
            })}
          </nav>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Trimestre 3 · 2026</p>
          <p className="mt-1 text-xs text-slate-500">Programación abierta hasta el 12 de septiembre.</p>
        </div>
      </aside>

      <div>
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (navAbierta ? cerrarManual() : abrirManual())}
              title={navAbierta ? 'Ocultar menú' : 'Mostrar menú (o deja el cursor en el borde izquierdo)'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="relative w-full max-w-sm">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="7" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="m20 20-3-3" />
              </svg>
              <input
                type="search"
                placeholder="Buscar ficha, instructor o ambiente…"
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3.5 text-sm text-slate-400 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700">
              Trimestre 3 · 2026
            </span>

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifAbiertas((abiertas) => !abiertas)}
                title="Notificaciones"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
                  />
                </svg>
                {hayNoLeidas && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500" />
                )}
              </button>

              {notifAbiertas && <NotificacionesPanel onCerrar={() => setNotifAbiertas(false)} />}
            </div>

            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sena-600 text-xs font-semibold text-white">
                {miPerfil ? letraInicial(miPerfil.nombre) : '·'}
              </span>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {miPerfil ? miPerfil.nombre : 'Cargando…'}
                </p>
                <p className="text-xs text-slate-500">{miPerfil?.email ?? ''}</p>
              </div>
            </div>

            <button
              onClick={() => void signOut()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
