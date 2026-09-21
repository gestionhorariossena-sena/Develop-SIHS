import { Link } from 'react-router-dom'
import type { Horario } from '../../types/api'
import type { Jornada } from '../../pages/horario/tipos'

const DIAS_GRID = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const

const JORNADAS_GRID: { valor: Jornada; horas: string }[] = [
  { valor: 'Mañana', horas: '06:00 – 12:00' },
  { valor: 'Tarde', horas: '12:00 – 18:00' },
  { valor: 'Noche', horas: '18:00 – 22:00' },
]

/** Igual a la de MiHorario.tsx/CalendarioGeneral.tsx/HorariosCompletos.tsx —
 * se repite acá a propósito (mismo patrón ya usado en esas páginas) para
 * que este grid no dependa del módulo de horario/editor completo. */
function jornadaDeHorario(horaInicio: string): Jornada {
  const hora = Number(horaInicio.split(':')[0])
  if (hora < 12) return 'Mañana'
  if (hora < 18) return 'Tarde'
  return 'Noche'
}

interface GridSemanalInstructorProps {
  horarios: Horario[]
  /** Qué filas de jornada dibujar — controlado por el filtro de jornada de
   * MiHorario.tsx (Todas/Mañana/Tarde/Noche). */
  jornadasVisibles: Jornada[]
  /** idFicha -> aprendicesTotales (de GET /fichas/) para "aprendices
   * convocados" en cada tarjeta — Horario no trae ese dato. */
  aprendicesPorFicha: Record<number, number>
}

/**
 * Grid semanal Lunes-Viernes x Mañana/Tarde/Noche del instructor — una
 * tarjeta por bloque real (ficha, tema, ambiente, aprendices convocados) y
 * "Franja Libre" en los huecos. Distinto de `GridHorario` (grid de 6
 * bloques institucionales + Receso que usa el Constructor de Horarios):
 * este es de solo lectura, una celda por jornada×día, pensado para el
 * mockup "Mi Horario Semanal" del instructor.
 */
export function GridSemanalInstructor({ horarios, jornadasVisibles, aprendicesPorFicha }: GridSemanalInstructorProps) {
  const filas = JORNADAS_GRID.filter((jornada) => jornadasVisibles.includes(jornada.valor))

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant">
      <div className="grid grid-cols-[minmax(84px,120px)_repeat(5,minmax(0,1fr))] bg-surface-container-low text-xs font-semibold text-on-surface-variant">
        <div className="px-3 py-2">Jornada</div>
        {DIAS_GRID.map((dia) => (
          <div key={dia} className="truncate px-2 py-2 text-center">
            {dia}
          </div>
        ))}
      </div>

      {filas.map((jornada) => (
        <div key={jornada.valor} className="grid grid-cols-[minmax(84px,120px)_repeat(5,minmax(0,1fr))] border-t border-outline-variant">
          <div className="flex flex-col justify-center gap-0.5 border-r border-outline-variant bg-surface-container-low px-3 py-3">
            <span className="text-xs font-bold uppercase text-on-surface">{jornada.valor}</span>
            <span className="text-[11px] text-on-surface-variant">{jornada.horas}</span>
          </div>

          {DIAS_GRID.map((dia, diaIdx) => {
            const idDia = diaIdx + 1
            const bloques = horarios.filter((h) => jornadaDeHorario(h.horaInicio) === jornada.valor && h.dias.includes(idDia))

            return (
              <div key={dia} className="flex flex-col gap-1.5 border-l border-outline-variant p-1.5">
                {bloques.length === 0 ? (
                  <div className="flex h-full min-h-[84px] flex-col items-center justify-center gap-0.5 rounded-lg bg-surface-container-low/60 text-center">
                    <span className="text-[11px] font-semibold text-on-surface-variant">Franja Libre</span>
                    <span className="text-[10px] text-on-surface-variant/80">Sin asignación</span>
                  </div>
                ) : (
                  bloques.map((bloque) => {
                    const aprendices = aprendicesPorFicha[bloque.idFicha]
                    return (
                      <div key={bloque.idHorario} className="flex flex-col gap-1 rounded-lg bg-primary-container/60 p-2 text-left">
                        <span className="w-max rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-on-primary">
                          {bloque.fichaCodigo ?? `Ficha ${bloque.idFicha}`}
                        </span>
                        <p className="text-xs leading-tight font-bold text-on-primary-container">
                          {bloque.resultadoDescripcion ?? bloque.resultadoCodigo ?? 'Sin tema'}
                        </p>
                        <p className="truncate text-[11px] text-on-surface-variant">{bloque.ambienteNombre ?? 'Sin ambiente'}</p>
                        {aprendices != null && (
                          <p className="text-[10px] font-semibold text-on-primary-container">{aprendices} aprendices convocados</p>
                        )}
                        <Link
                          to={`/mi-horario/detalle-franja?horario=${bloque.idHorario}&dia=${encodeURIComponent(dia)}`}
                          className="mt-0.5 text-right text-[10px] font-bold text-primary hover:underline"
                        >
                          Detalle →
                        </Link>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
