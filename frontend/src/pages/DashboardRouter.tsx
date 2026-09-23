import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { apiGet, ApiError } from '../services/api'
import type { Usuario } from '../types/api'
import { Dashboard } from './Dashboard'
import { DashboardInstructor } from './DashboardInstructor'

/**
 * `/dashboard` decide acá qué home mostrar según el rol — antes todo
 * usuario caía siempre en Dashboard.tsx (pensado para Coordinador), así
 * que un Instructor puro veía "Accesos de coordinación" sin sentido para
 * su rol. Mismo criterio de "puede gestionar" que ya usa AppShell.tsx
 * (Administrador/Coordinador) para decidir qué ítems de nav mostrar — acá
 * se reutiliza para decidir qué HOME mostrar, no solo qué nav.
 *
 * Mientras se resuelve el perfil se muestra un spinner, NO Dashboard.tsx
 * directamente — la primera versión de esto defaulteaba a Dashboard.tsx
 * mientras cargaba, pero Dashboard.tsx dispara de una sus propios fetches
 * (`/horarios/`, `/usuarios/`, etc., que requieren permiso de gestión) sin
 * esperar a saber el rol, así que un Instructor puro veía un "No
 * autorizado" de esas llamadas por un instante en cada navegación de
 * vuelta a /dashboard (ej. desde "Mi horario" con el ítem "Inicio" del
 * navbar), antes de que el rol resolviera y recién ahí cambiara a
 * DashboardInstructor. Esperar acá el perfil evita ese flash para
 * cualquier rol, a costa de un spinner breve en vez de contenido
 * inmediato.
 */
export function DashboardRouter() {
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiGet<Usuario>('/usuarios/me')
      .then(setPerfil)
      .catch((err: unknown) => setError(err instanceof ApiError))
  }, [])

  if (!perfil) {
    // Si /usuarios/me falla, se cae a Dashboard.tsx (el comportamiento de
    // siempre) en vez de quedar el spinner girando para siempre.
    if (error) return <Dashboard />

    return (
      <AppShell activo="Inicio">
        <div className="flex min-h-[60vh] items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-[28px] text-primary">progress_activity</span>
        </div>
      </AppShell>
    )
  }

  const puedeGestionar = perfil.roles.some((rol) => rol.nombre === 'Administrador' || rol.nombre === 'Coordinador')
  const esInstructor = perfil.roles.some((rol) => rol.nombre === 'Instructor')
  const esAprendiz = perfil.roles.some((rol) => rol.nombre === 'Aprendiz')

  // Un Aprendiz puro (sin rol de gestión ni Instructor) no tiene un "home"
  // propio como Dashboard.tsx/DashboardInstructor.tsx -- su autoservicio
  // es "Mi horario" (MiHorarioAprendiz.tsx). Antes caía en Dashboard.tsx
  // (pensado para Coordinador) y esos fetches con permiso de gestión le
  // devolvían "No autorizado" -- encontrado en vivo el 2026-09-14
  // logueado con una cuenta de prueba real con rol Aprendiz.
  if (esAprendiz && !puedeGestionar && !esInstructor) {
    return <Navigate to="/mi-horario-aprendiz" replace />
  }

  return esInstructor && !puedeGestionar ? <DashboardInstructor /> : <Dashboard />
}
