import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Aviso, Ficha, Horario, MiAsistencia as MiAsistenciaDatos, Notificacion, Usuario } from '../types/api'
import { proximaClase } from './horario/vistaReal'

interface AccesoDirecto {
  etiqueta: string
  descripcion: string
  ruta: string
  /** Nombre del ícono en Material Symbols Outlined (mismo set que AppShell/MiHorarioAprendiz). */
  icono: string
}

const ACCESOS: AccesoDirecto[] = [
  { etiqueta: 'Mi Horario', descripcion: 'Tu grilla semanal, próxima clase e instructores.', ruta: '/mi-horario-aprendiz', icono: 'calendar_month' },
  { etiqueta: 'Mis instructores', descripcion: 'Quién te dicta clase, su materia y su correo.', ruta: '/mensajes', icono: 'forum' },
  { etiqueta: 'Comunicados del centro', descripcion: 'Comunicados oficiales de Coordinación.', ruta: '/avisos', icono: 'campaign' },
  { etiqueta: 'Notificaciones', descripcion: 'Cambios de horario, ambiente y novedades.', ruta: '/notificaciones', icono: 'notifications' },
]

/** Mismo umbral del reglamento del aprendiz que usa MiAsistencia.tsx. */
const UMBRAL_ASISTENCIA = 85

const ETIQUETA_CATEGORIA_AVISO: Record<Aviso['categoria'], string> = {
  reprog: 'Reprogramación',
  eventos: 'Evento',
  sede: 'Sede',
  extraordinario: 'Comunicado extraordinario',
}

const VER_TEXTO: Record<string, string> = {
  '/mi-horario-aprendiz': 'Ver horario',
  '/mensajes': 'Ver instructores',
  '/avisos': 'Ver todos',
  '/notificaciones': 'Ver todas',
}

const fechaHoy = (() => {
  const texto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
})()

function diaLegible(fecha: Date): string {
  const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return nombres[fecha.getDay()]
}

function formatearHora(hhmmss: string) {
  return hhmmss.slice(0, 5)
}

/** "hace 2 horas" / "hace 1 día" a partir de un ISO -- mismo criterio simple que usan los previews del resto de pantallas. */
function tiempoRelativo(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutos < 60) return minutos <= 1 ? 'Hace un momento' : `Hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  const dias = Math.round(horas / 24)
  return `Hace ${dias} día${dias === 1 ? '' : 's'}`
}

/**
 * Home del Aprendiz — accesos directos a las 4 pantallas de su Epic (Mi
 * Horario, Mensajes Docentes, Avisos & Eventos, Notificaciones), cada una
 * con un preview de dato real (no solo el acceso directo), más una franja
 * de asistencia arriba. Elegida por DashboardRouter.tsx en vez de
 * Dashboard.tsx (pensado para Coordinador/Administrador, dispara fetches
 * de gestión que un Aprendiz no tiene permiso de ver).
 *
 * Cada preview sale de un fetch independiente, con su propio catch a un
 * valor por defecto -- que a un aprendiz recién creado le falle "mi
 * horario" (sin ficha todavía) no debe tumbar el resto del home, igual
 * que ya hacía la tarjeta de ficha con el 404 de "mi-ficha".
 */
export function DashboardAprendiz() {
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [asistencia, setAsistencia] = useState<MiAsistenciaDatos | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me').then(setPerfil).catch(() => setPerfil(null))
    apiGet<Ficha>('/ficha-usuario/mi-ficha')
      .then(setFicha)
      .catch((err: unknown) => {
        // Sin ficha vinculada (404) u otro error: la tarjeta de ficha
        // simplemente no se muestra, no bloquea el resto del home.
        if (!(err instanceof ApiError)) throw err
      })

    apiGet<Horario[]>('/ficha-usuario/mi-horario').then(setHorarios).catch(() => setHorarios([]))
    apiGet<MiAsistenciaDatos>('/asistencias/mias').then(setAsistencia).catch(() => setAsistencia(null))
    apiGet<Aviso[]>('/avisos/').then(setAvisos).catch(() => setAvisos([]))
    apiGet<Notificacion[]>('/notificaciones/').then(setNotificaciones).catch(() => setNotificaciones([]))
  }, [])

  const proxima = useMemo(() => proximaClase(horarios, new Date()), [horarios])

  const instructores = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const h of horarios) {
      if (!mapa.has(h.idInstructor)) mapa.set(h.idInstructor, h.instructorNombre ?? 'Instructor')
    }
    return [...mapa.values()]
  }, [horarios])

  const ultimoAviso = avisos[0] ?? null
  const ultimaNotificacion = notificaciones[0] ?? null
  const notificacionesSinLeer = notificaciones.filter((n) => !n.leida).length

  const resumenAsistencia = asistencia?.resumen
  const mostrarAsistencia = resumenAsistencia != null && resumenAsistencia.registradas > 0
  const asistenciaAlDia = mostrarAsistencia && resumenAsistencia.porcentaje >= UMBRAL_ASISTENCIA

  function pieIzquierdo(ruta: string): string {
    switch (ruta) {
      case '/mi-horario-aprendiz':
        return proxima?.horario.instructorNombre ? `Con ${proxima.horario.instructorNombre}` : ''
      case '/mensajes':
        return 'Según tu horario actual'
      case '/avisos':
        return ultimoAviso ? `${tiempoRelativo(ultimoAviso.fechaPublicacion)} · ${ultimoAviso.publicadorNombre ?? 'Coordinación'}` : ''
      case '/notificaciones':
        return ultimaNotificacion ? tiempoRelativo(ultimaNotificacion.fechaCreacion) : ''
      default:
        return ''
    }
  }

  return (
    <AppShell activo="Inicio">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-on-surface">
          {perfil ? `Hola, ${perfil.nombre.split(' ')[0]}` : 'Hola'}
        </h1>
        <p className="text-sm text-on-surface-variant">{fechaHoy}</p>
      </div>

      {ficha && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
            Ficha {ficha.codigoFicha}
          </span>
          <span className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
            {ficha.programa.nombrePrograma}
          </span>
          <span className="rounded-md border border-primary/30 bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container">
            {ficha.trimestre.nombre}
          </span>
        </div>
      )}

      <p className="mb-6 max-w-2xl text-sm text-on-surface-variant">
        Un vistazo rápido a lo que necesitas antes de entrar a cada pantalla.
      </p>

      {mostrarAsistencia && (
        <Link
          to="/mi-asistencia"
          className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4 transition hover:border-primary/40 hover:shadow-sm"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">fact_check</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Mi asistencia</span>
            <span className="block text-sm font-semibold text-on-surface">
              {resumenAsistencia.registradas} sesión{resumenAsistencia.registradas === 1 ? '' : 'es'} registrada
              {resumenAsistencia.registradas === 1 ? '' : 's'} este trimestre
            </span>
          </span>
          <span className="font-display text-2xl font-bold text-on-surface">{resumenAsistencia.porcentaje}%</span>
          <span className="text-xs text-on-surface-variant">mínimo {UMBRAL_ASISTENCIA}%</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              asistenciaAlDia ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'
            }`}
          >
            {asistenciaAlDia ? 'Al día' : 'Por debajo del mínimo'}
          </span>
          <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">chevron_right</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ACCESOS.map((acceso) => (
          <Link
            key={acceso.ruta}
            to={acceso.ruta}
            className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 transition hover:border-primary/40 hover:shadow-sm"
          >
            <span className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{acceso.icono}</span>
              </span>
              <span>
                <span className="block text-base font-semibold text-on-surface">{acceso.etiqueta}</span>
                <span className="block text-sm text-on-surface-variant">{acceso.descripcion}</span>
              </span>
            </span>

            {acceso.ruta === '/mi-horario-aprendiz' && (
              <span className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                {proxima ? (
                  <>
                    <span className="block font-semibold uppercase tracking-wide text-on-surface-variant">Próxima clase</span>
                    <span className="block font-semibold text-on-surface">
                      {proxima.horario.resultadoCodigo ?? proxima.horario.resultadoDescripcion ?? 'Clase'}
                    </span>
                    <span className="block text-on-surface-variant">
                      {diaLegible(proxima.fecha)} · {formatearHora(proxima.horario.horaInicio)} – {formatearHora(proxima.horario.horaFin)}
                      {proxima.horario.ambienteNombre ? ` · Ambiente ${proxima.horario.ambienteNombre}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">Todavía no tienes clases programadas.</span>
                )}
              </span>
            )}

            {acceso.ruta === '/mensajes' && (
              <span className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                {instructores.length > 0 ? (
                  <>
                    <span className="block font-semibold uppercase tracking-wide text-on-surface-variant">
                      {instructores.length} instructor{instructores.length === 1 ? '' : 'es'} asignado{instructores.length === 1 ? '' : 's'}
                    </span>
                    <span className="block text-on-surface-variant">{instructores.slice(0, 3).join(' · ')}{instructores.length > 3 ? ` y ${instructores.length - 3} más` : ''}</span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">Según tu horario actual.</span>
                )}
              </span>
            )}

            {acceso.ruta === '/avisos' && (
              <span className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                {ultimoAviso ? (
                  <>
                    <span className="block font-semibold uppercase tracking-wide text-on-surface-variant">
                      {ETIQUETA_CATEGORIA_AVISO[ultimoAviso.categoria]}
                    </span>
                    <span className="block truncate font-semibold text-on-surface">{ultimoAviso.titulo}</span>
                    <span className="block text-on-surface-variant">{tiempoRelativo(ultimoAviso.fechaPublicacion)}</span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">Todavía no hay comunicados publicados.</span>
                )}
              </span>
            )}

            {acceso.ruta === '/notificaciones' && (
              <span className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                {ultimaNotificacion ? (
                  <>
                    <span className="block font-semibold uppercase tracking-wide text-on-surface-variant">
                      {notificacionesSinLeer > 0 ? `${notificacionesSinLeer} sin leer` : 'Al día'}
                    </span>
                    <span className="block truncate text-on-surface-variant">{ultimaNotificacion.mensaje}</span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">Sin notificaciones pendientes.</span>
                )}
              </span>
            )}

            <span className="mt-auto flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-on-surface-variant">{pieIzquierdo(acceso.ruta)}</span>
              <span className="flex shrink-0 items-center gap-0.5 font-semibold text-primary">
                {VER_TEXTO[acceso.ruta]}
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_right</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
