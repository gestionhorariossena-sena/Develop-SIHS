import type { Horario } from '../../types/api'
import { SeccionDrawer } from './DrawerRelacionados'
import { formatoHora, nombresDias } from './formatoBloque'

/** SCRUM-68: instructores únicos derivados de los horarios de la ficha —
 * análogo a SeccionFichasAsignadas (SCRUM-62) pero agrupando por
 * instructor en vez de por ficha. Temas/ambientes reusan directamente
 * SeccionTemasQueDicta/SeccionAmbientesAsignados (SCRUM-63/64) — no
 * dependen de si el horario viene de un instructor o de una ficha. */
export function SeccionInstructoresAsignados({ horarios, diasPorId }: { horarios: Horario[]; diasPorId: Record<number, string> }) {
  const porInstructor = new Map<string, { nombre: string; bloques: Horario[] }>()
  for (const horario of horarios) {
    const entrada = porInstructor.get(horario.idInstructor) ?? { nombre: horario.instructorNombre ?? `Instructor ${horario.idInstructor}`, bloques: [] }
    entrada.bloques.push(horario)
    porInstructor.set(horario.idInstructor, entrada)
  }
  const instructores = [...porInstructor.values()]

  return (
    <SeccionDrawer titulo="Instructores">
      {instructores.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sin instructores asignados en el trimestre actual.</p>
      ) : (
        <ul className="space-y-2">
          {instructores.map((instructor) => (
            <li key={instructor.nombre} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{instructor.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {instructor.bloques.map((bloque) => `${nombresDias(bloque.dias, diasPorId)} ${formatoHora(bloque.horaInicio)}-${formatoHora(bloque.horaFin)}`).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SeccionDrawer>
  )
}
