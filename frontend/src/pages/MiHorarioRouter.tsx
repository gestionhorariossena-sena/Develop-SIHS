import { useEffect, useState } from 'react'
import { apiGet } from '../services/api'
import type { Usuario } from '../types/api'
import { MiHorario } from './MiHorario'
import { MiHorarioAprendiz } from './MiHorarioAprendiz'

type EstadoRol = 'cargando' | 'aprendiz' | 'otro'

/**
 * Punto de entrada de /mi-horario: elige qué vista mostrar según el rol
 * del usuario autenticado -- mismo patrón que DashboardRouter.tsx.
 *
 * MiHorario.tsx es la vista de carga lectiva del Instructor (mockup
 * mi_horario_semanal_vista_principal_sihs_sena); MiHorarioAprendiz.tsx es
 * la grilla semanal de solo lectura + organizador personal del Aprendiz
 * (mockup mi_horario_rol_aprendiz_sihs_sena). Ambas comparten la misma
 * ruta y el mismo ítem de nav "Mi horario" -- son pantallas distintas,
 * no una sola pantalla con permisos distintos, así que hace falta este
 * router en vez de un solo componente con un `if` interno.
 *
 * Si falla el fetch de perfil, cae en MiHorario.tsx -- falla abierto,
 * mismo criterio que ProtectedRoute.tsx/DashboardRouter.tsx.
 */
export function MiHorarioRouter() {
  const [estado, setEstado] = useState<EstadoRol>('cargando')

  useEffect(() => {
    let cancelado = false

    apiGet<Usuario>('/usuarios/me')
      .then((perfil) => {
        if (cancelado) return
        const esAprendiz = perfil.roles.some((rol) => rol.nombre === 'Aprendiz')
        setEstado(esAprendiz ? 'aprendiz' : 'otro')
      })
      .catch(() => {
        if (!cancelado) setEstado('otro')
      })

    return () => {
      cancelado = true
    }
  }, [])

  if (estado === 'cargando') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Cargando…
      </div>
    )
  }

  return estado === 'aprendiz' ? <MiHorarioAprendiz /> : <MiHorario />
}
