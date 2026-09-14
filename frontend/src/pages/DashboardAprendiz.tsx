import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Ficha, Usuario } from '../types/api'

interface AccesoDirecto {
  etiqueta: string
  descripcion: string
  ruta: string
  icono: ReactNode
}

function IconoCalendario() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z" />
    </svg>
  )
}

function IconoMensaje() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25h7.5m-7.5 3h4.5m-8.55 5.4L4.5 19.5v-3.87a2.25 2.25 0 0 1-1.5-2.13v-6A2.25 2.25 0 0 1 5.25 5.25h13.5a2.25 2.25 0 0 1 2.25 2.25v6a2.25 2.25 0 0 1-2.25 2.25H8.06l-2.36 2.1c-.5.44-1.25.09-1.25-.58v-.02Z" />
    </svg>
  )
}

function IconoAviso() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 3.94c.68-1.12 2.32-1.12 3 0l7.14 11.7c.7 1.15-.12 2.61-1.46 2.61H4.66c-1.34 0-2.16-1.46-1.46-2.61l7.14-11.7ZM12 9v4.5m0 3h.008" />
    </svg>
  )
}

function IconoCampana() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
    </svg>
  )
}

const ACCESOS: AccesoDirecto[] = [
  { etiqueta: 'Mi Horario', descripcion: 'Tu grilla semanal, próxima clase e instructores.', ruta: '/mi-horario', icono: <IconoCalendario /> },
  { etiqueta: 'Mensajes Docentes', descripcion: 'Escríbele a los instructores que te dictan clase.', ruta: '/mensajes-docentes', icono: <IconoMensaje /> },
  { etiqueta: 'Avisos & Eventos', descripcion: 'Comunicados oficiales de Coordinación.', ruta: '/avisos', icono: <IconoAviso /> },
  { etiqueta: 'Notificaciones', descripcion: 'Cambios de horario, ambiente y novedades.', ruta: '/notificaciones', icono: <IconoCampana /> },
]

const fechaHoy = (() => {
  const texto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
})()

/**
 * Home del Aprendiz — accesos directos a las 4 pantallas de su Epic (Mi
 * Horario, Mensajes Docentes, Avisos & Eventos, Notificaciones). Elegida
 * por DashboardRouter.tsx en vez de Dashboard.tsx (pensado para
 * Coordinador/Administrador, dispara fetches de gestión que un Aprendiz
 * no tiene permiso de ver).
 */
export function DashboardAprendiz() {
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => setPerfil(null))
    apiGet<Ficha>('/ficha-usuario/mi-ficha')
      .then(setFicha)
      .catch((err: unknown) => {
        // Sin ficha vinculada (404) u otro error: la tarjeta de ficha
        // simplemente no se muestra, no bloquea el resto del home.
        if (!(err instanceof ApiError)) throw err
      })
  }, [])

  return (
    <AppShell activo="Inicio">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {perfil ? `Hola, ${perfil.nombre.split(' ')[0]}` : 'Hola'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{fechaHoy}</p>
      </div>

      {ficha && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <span className="rounded-md bg-sena-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-sena-700 dark:bg-sena-950/50 dark:text-sena-400">
            Ficha {ficha.codigoFicha}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-300">{ficha.programa.nombrePrograma}</span>
          <span className="text-sm text-slate-400">·</span>
          <span className="text-sm text-slate-600 dark:text-slate-300">{ficha.trimestre.nombre}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ACCESOS.map((acceso) => (
          <Link
            key={acceso.ruta}
            to={acceso.ruta}
            className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sena-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sena-700"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sena-50 text-sena-700 dark:bg-sena-950/50 dark:text-sena-400">
              {acceso.icono}
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-900 dark:text-slate-100">{acceso.etiqueta}</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">{acceso.descripcion}</span>
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
