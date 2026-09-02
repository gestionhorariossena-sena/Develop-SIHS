import type { Horario } from '../../types/api'
import { SeccionDrawer } from './DrawerRelacionados'

function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

function nombresDias(dias: number[], diasPorId: Record<number, string>) {
  return dias.map((id) => diasPorId[id] ?? '?').join(' y ')
}

/** SCRUM-62: fichas únicas derivadas de los horarios del instructor — cada
 * una con sus bloques (día(s) + hora), no solo el código. */
export function SeccionFichasAsignadas({ horarios, diasPorId }: { horarios: Horario[]; diasPorId: Record<number, string> }) {
  const porFicha = new Map<number, { codigo: string; bloques: Horario[] }>()
  for (const horario of horarios) {
    const entrada = porFicha.get(horario.idFicha) ?? { codigo: horario.fichaCodigo ?? `Ficha ${horario.idFicha}`, bloques: [] }
    entrada.bloques.push(horario)
    porFicha.set(horario.idFicha, entrada)
  }
  const fichas = [...porFicha.values()]

  return (
    <SeccionDrawer titulo="Fichas asignadas">
      {fichas.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sin fichas asignadas en el trimestre actual.</p>
      ) : (
        <ul className="space-y-2">
          {fichas.map((ficha) => (
            <li key={ficha.codigo} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ficha.codigo}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ficha.bloques.map((bloque) => `${nombresDias(bloque.dias, diasPorId)} ${formatoHora(bloque.horaInicio)}-${formatoHora(bloque.horaFin)}`).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SeccionDrawer>
  )
}

/** SCRUM-63: resultados de aprendizaje únicos (temáticas) que dicta,
 * derivados de los mismos horarios. */
export function SeccionTemasQueDicta({ horarios }: { horarios: Horario[] }) {
  const temas = new Map<number, string>()
  for (const horario of horarios) {
    if (horario.resultadoCodigo || horario.resultadoDescripcion) {
      temas.set(horario.idResultado, horario.resultadoCodigo ? `${horario.resultadoCodigo} — ${horario.resultadoDescripcion}` : (horario.resultadoDescripcion ?? ''))
    }
  }
  const lista = [...temas.values()]

  return (
    <SeccionDrawer titulo="Temas que dicta">
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sin temas asignados en el trimestre actual.</p>
      ) : (
        <ul className="space-y-1.5">
          {lista.map((tema) => (
            <li key={tema} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {tema}
            </li>
          ))}
        </ul>
      )}
    </SeccionDrawer>
  )
}

/** SCRUM-64: ambientes únicos derivados de los horarios del instructor. */
export function SeccionAmbientesAsignados({ horarios }: { horarios: Horario[] }) {
  const ambientes = [...new Set(horarios.map((h) => h.ambienteNombre).filter((nombre): nombre is string => Boolean(nombre)))]

  return (
    <SeccionDrawer titulo="Ambientes asignados">
      {ambientes.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sin ambientes asignados en el trimestre actual.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ambientes.map((nombre) => (
            <span key={nombre} className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
              {nombre}
            </span>
          ))}
        </div>
      )}
    </SeccionDrawer>
  )
}
