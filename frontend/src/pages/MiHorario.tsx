import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { GridHorario } from '../components/horario/GridHorario'
import { convertirHorariosAGrid } from '../components/horario/convertirHorarios'
import { apiGet, ApiError } from '../services/api'
import type { Horario } from '../types/api'

/**
 * Autoservicio del instructor — "Mi horario" (pedido 2026-09-03). A
 * diferencia de Vista por instructores (que un Coordinador usa para
 * elegir CUALQUIER instructor de una lista), acá no hay nada que elegir:
 * siempre es el usuario logueado, vía `GET /usuarios/me/horarios`, que ya
 * viene filtrado a solo lo publicado — un instructor nunca ve acá un
 * borrador que el coordinador todavía está armando (ver
 * HorarioService.obtener_publicados_por_instructor en el backend).
 *
 * Solo aparece en el sidebar para quien tenga el rol Instructor
 * (`AppShell.tsx`, ítem "Mi horario" con `soloInstructor: true`), pero la
 * ruta en sí no está restringida por rol — cualquier usuario autenticado
 * puede visitarla y ve sus propias clases (o ninguna, si no dicta clases).
 */
export function MiHorario() {
  const [horarios, setHorarios] = useState<Horario[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Horario[]>('/usuarios/me/horarios')
      .then(setHorarios)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu horario.'))
  }, [])

  const { bloques, grid } = convertirHorariosAGrid(horarios ?? [])

  return (
    <AppShell activo="Mi horario">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Mi horario</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tu horario semanal publicado por tu coordinador. Si falta una clase que sabés que ya te
          asignaron, puede que todavía esté en borrador — hablalo con tu coordinador.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        {!horarios && !error ? (
          <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Cargando tu horario…</p>
        ) : bloques.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            Todavía no tenés clases publicadas en este trimestre.
          </p>
        ) : (
          <GridHorario bloques={bloques} grid={grid} hayBloqueActivo={false} soloLectura />
        )}
      </div>
    </AppShell>
  )
}
