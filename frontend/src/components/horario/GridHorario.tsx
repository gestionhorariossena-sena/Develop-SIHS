import { BLOQUES, DIAS } from '../../pages/horario/tipos'
import type { BloqueClase, GridAsignaciones, Jornada, PosicionCelda } from '../../pages/horario/tipos'
import { CeldaHorario } from './CeldaHorario'

// Sin variante `dark:` a propósito — mismo tono en claro y oscuro (ver
// GUIA_DE_MARCA.md, sección "Grid de horario en modo oscuro"). Antes estas
// celdas eran casi blancas (`-50`) y el texto usaba `dark:text-slate-200`,
// pensado para fondo oscuro: en modo oscuro la celda seguía clara (no tenía
// `dark:bg-...`) y el texto quedaba claro sobre claro, casi ilegible. La
// solución no es agregar un fondo oscuro (para eso habría que poner texto
// blanco, no negro), sino un tono ya suficientemente saturado para que el
// texto negro fijo tenga buen contraste en cualquier tema.
const colorFondoJornada: Record<Jornada, { celda: string; celdaAlt: string }> = {
  Mañana: { celda: 'bg-emerald-200', celdaAlt: 'bg-emerald-300/70' },
  Tarde: { celda: 'bg-blue-200', celdaAlt: 'bg-blue-300/70' },
  Noche: { celda: 'bg-emerald-200', celdaAlt: 'bg-emerald-300/70' },
}

// La columna de hora usa minmax en vez de un px fijo, y las columnas de día
// usan minmax(0, 1fr) — el 0 anula el ancho mínimo automático que un track
// normalmente toma del contenido, así el grid SIEMPRE cabe en el ancho
// disponible (nunca fuerza scroll lateral), aunque las celdas se achiquen;
// el texto largo se trunca con "truncate" en vez de desbordar.
const ESTILO_COLUMNAS = { gridTemplateColumns: 'minmax(64px, 88px) repeat(6, minmax(0, 1fr))' }

interface GridHorarioProps {
  bloques: BloqueClase[]
  grid: GridAsignaciones
  hayBloqueActivo: boolean
  /** Modo historial/exportación: celdas sin interacción, sin botón de quitar. */
  soloLectura?: boolean
  /** Mini-grid del drawer de relacionados: oculta filas de bloque horario
   * (y la fila "Receso" y el encabezado de jornada) que no tienen ninguna
   * celda asignada en ningún día — para no mostrar toda la plantilla
   * institucional vacía cuando solo interesa ver lo que sí está
   * programado. El editor completo (con hayBloqueActivo) sigue mostrando
   * todo, para poder hacer clic y asignar celdas vacías. */
  ocultarFilasVacias?: boolean
  onClicCelda?: (posicion: PosicionCelda, shiftKey: boolean) => void
  onQuitarCelda?: (posicion: PosicionCelda) => void
}

/** Grid semanal (jornada → bloque horario → día), plantilla institucional. Presentacional puro. */
export function GridHorario({
  bloques,
  grid,
  hayBloqueActivo,
  soloLectura = false,
  ocultarFilasVacias = false,
  onClicCelda,
  onQuitarCelda,
}: GridHorarioProps) {
  return (
    <div>
      <div
        className="grid gap-px overflow-hidden rounded-t-lg bg-slate-200 text-xs font-semibold uppercase text-white dark:bg-slate-700"
        style={ESTILO_COLUMNAS}
      >
        <div className="truncate bg-slate-900 px-2 py-2">Hora</div>
        {DIAS.map((dia) => (
          <div key={dia} className="truncate bg-slate-900 px-1.5 py-2 text-center">
            {dia}
          </div>
        ))}
      </div>

      {(['Mañana', 'Tarde', 'Noche'] as const).map((jornada) => {
        const indicesJornada = BLOQUES.map((b, i) => (b.jornada === jornada ? i : -1)).filter((i) => i !== -1)
        const indices = ocultarFilasVacias
          ? indicesJornada.filter((bloqueIdx) => grid[bloqueIdx].some(Boolean))
          : indicesJornada
        const fondos = colorFondoJornada[jornada]

        if (indices.length === 0) return null

        return (
          <div key={jornada}>
            <div className="bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
              Jornada {jornada}
            </div>

            {indices.map((bloqueIdx, posicion) => (
              <div key={bloqueIdx}>
                <div className="grid gap-px bg-slate-200 dark:bg-slate-700" style={ESTILO_COLUMNAS}>
                  <div className={`${fondos.celda} flex flex-col justify-center px-2 py-2 text-xs font-semibold text-slate-900`}>
                    <span className="truncate">{BLOQUES[bloqueIdx].horaInicio}</span>
                    <span className="truncate">– {BLOQUES[bloqueIdx].horaFin}</span>
                  </div>

                  {DIAS.map((dia, diaIdx) => {
                    const bloqueId = grid[bloqueIdx][diaIdx]
                    const bloqueCelda = bloqueId ? bloques.find((b) => b.id === bloqueId) : undefined
                    const { horaInicio, horaFin } = BLOQUES[bloqueIdx]

                    return (
                      <CeldaHorario
                        key={diaIdx}
                        bloque={bloqueCelda}
                        etiqueta={`${dia}, ${horaInicio} – ${horaFin}`}
                        fondoVacio={diaIdx % 2 === 0 ? fondos.celda : fondos.celdaAlt}
                        hayBloqueActivo={hayBloqueActivo}
                        soloLectura={soloLectura}
                        onClic={(shiftKey) => onClicCelda?.({ bloqueIdx, diaIdx }, shiftKey)}
                        onQuitar={() => onQuitarCelda?.({ bloqueIdx, diaIdx })}
                      />
                    )
                  })}
                </div>

                {!ocultarFilasVacias && posicion === 0 && (
                  <div className="grid gap-px bg-slate-200 dark:bg-slate-700" style={ESTILO_COLUMNAS}>
                    <div className="truncate bg-slate-100 px-2 py-1 text-center text-[11px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      Receso
                    </div>
                    {DIAS.map((dia) => (
                      <div
                        key={dia}
                        className="truncate bg-slate-100 px-1.5 py-1 text-center text-[11px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      >
                        Receso
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
