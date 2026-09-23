import { BLOQUES } from '../../pages/horario/tipos'
import type { CeldaAsistente } from './celdasAsistente'
import { colorParaBloque } from '../../pages/horario/gridLogic'

/**
 * Grid semanal que muestra CUALQUIER horario real, sin importar si se
 * creó a mano (Constructor, plantilla institucional fija de
 * `pages/horario/tipos.ts` BLOQUES: 2 franjas/jornada) o con el
 * Asistente de Programación (CP-SAT, `app/scheduling/generator.py`
 * FRANJAS_POR_JORNADA: 3 franjas/jornada en Mañana/Tarde) -- las dos
 * plantillas de franjas NO coinciden (se probó alinearlas el
 * 2026-09-14 y resultó inviable: con solo 2 franjas/jornada, cualquier
 * fase del currículo con más de 10 resultados pendientes se vuelve
 * infactible sin importar el catálogo de instructores/ambientes), así
 * que `GridHorario` (que solo dibuja las franjas de BLOQUES) descartaba
 * en silencio cualquier horario creado por el asistente cuya hora de
 * inicio no calzara exacto -- encontrado en vivo el 2026-09-14 en
 * "Horarios completos": un horario visible en la tabla (Horario #44,
 * Lunes 07:00-09:00) no aparecía en su propio grid semanal.
 *
 * Este grid en cambio dibuja la UNIÓN de ambas plantillas de franjas
 * (deduplicada por hora de inicio, ordenada cronológicamente dentro de
 * cada jornada) -- así un horario de cualquier origen siempre tiene una
 * fila donde mostrarse.
 */
const FRANJAS_ASISTENTE: { jornada: 'Mañana' | 'Tarde' | 'Noche'; horaInicio: string; horaFin: string; horaInicio24: string }[] = [
  { jornada: 'Mañana', horaInicio: '7:00 a.m', horaFin: '9:00 a.m', horaInicio24: '07:00:00' },
  { jornada: 'Mañana', horaInicio: '9:00 a.m', horaFin: '11:00 a.m', horaInicio24: '09:00:00' },
  { jornada: 'Mañana', horaInicio: '11:00 a.m', horaFin: '1:00 p.m', horaInicio24: '11:00:00' },
  { jornada: 'Tarde', horaInicio: '1:00 p.m', horaFin: '3:00 p.m', horaInicio24: '13:00:00' },
  { jornada: 'Tarde', horaInicio: '3:00 p.m', horaFin: '5:00 p.m', horaInicio24: '15:00:00' },
  { jornada: 'Tarde', horaInicio: '5:00 p.m', horaFin: '7:00 p.m', horaInicio24: '17:00:00' },
  { jornada: 'Noche', horaInicio: '6:00 p.m', horaFin: '8:00 p.m', horaInicio24: '18:00:00' },
  { jornada: 'Noche', horaInicio: '8:00 p.m', horaFin: '10:00 p.m', horaInicio24: '20:00:00' },
]

const FRANJAS_INSTITUCIONALES: (typeof FRANJAS_ASISTENTE)[number][] = BLOQUES.map((bloque) => ({
  jornada: bloque.jornada,
  horaInicio: bloque.horaInicio,
  horaFin: bloque.horaFin,
  horaInicio24: bloque.horaInicio24,
}))

const ORDEN_JORNADA: Record<string, number> = { Mañana: 0, Tarde: 1, Noche: 2 }

const FRANJAS: (typeof FRANJAS_ASISTENTE)[number][] = [...FRANJAS_INSTITUCIONALES, ...FRANJAS_ASISTENTE]
  .filter((franja, indice, todas) => todas.findIndex((f) => f.horaInicio24 === franja.horaInicio24) === indice)
  .sort((a, b) => ORDEN_JORNADA[a.jornada] - ORDEN_JORNADA[b.jornada] || a.horaInicio24.localeCompare(b.horaInicio24))

// idDia 1=Lunes..5=Viernes -- el generador nunca usa Sábado (ver
// PATRONES_DE_DIA en el backend), así que el grid del asistente no
// necesita esa columna.
const DIAS: { idDia: number; nombre: string }[] = [
  { idDia: 1, nombre: 'Lunes' },
  { idDia: 2, nombre: 'Martes' },
  { idDia: 3, nombre: 'Miércoles' },
  { idDia: 4, nombre: 'Jueves' },
  { idDia: 5, nombre: 'Viernes' },
]

const FONDO_JORNADA: Record<string, string> = {
  Mañana: 'bg-emerald-100 dark:bg-emerald-950/30',
  Tarde: 'bg-blue-100 dark:bg-blue-950/30',
  Noche: 'bg-indigo-100 dark:bg-indigo-950/30',
}

interface GridAsistenteProps {
  celdas: CeldaAsistente[]
  /** Si viene, cada celda "nueva" muestra un botón "Quitar" -- para
   * excluir ese bloque propuesto de lo que se va a confirmar sin tener
   * que regenerar toda la propuesta. Las celdas "existentes" (ya
   * guardadas) nunca lo muestran: para eso está Historial de horarios. */
  onQuitarNuevo?: (id: string) => void
}

/** Grid semanal de solo lectura (con opción de quitar bloques nuevos) que
 * combina lo que ya estaba guardado para estas fichas con lo que el
 * asistente propone -- para verlo todo junto antes de confirmar. */
export function GridAsistente({ celdas, onQuitarNuevo }: GridAsistenteProps) {
  const porCelda = new Map<string, CeldaAsistente[]>()
  for (const celda of celdas) {
    const idxFranja = FRANJAS.findIndex((f) => f.horaInicio24 === celda.horaInicio)
    if (idxFranja === -1) continue
    for (const idDia of celda.dias) {
      const idxDia = DIAS.findIndex((d) => d.idDia === idDia)
      if (idxDia === -1) continue
      const clave = `${idxFranja}-${idxDia}`
      const lista = porCelda.get(clave) ?? []
      lista.push(celda)
      porCelda.set(clave, lista)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant dark:border-slate-700">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: 'minmax(90px, 110px) repeat(5, minmax(0, 1fr))' }}>
        <div className="border-b border-r border-outline-variant bg-slate-900 px-2 py-2 text-xs font-semibold uppercase text-white dark:border-slate-700">
          Hora
        </div>
        {DIAS.map((dia) => (
          <div
            key={dia.idDia}
            className="border-b border-r border-outline-variant bg-slate-900 px-2 py-2 text-center text-xs font-semibold uppercase text-white last:border-r-0 dark:border-slate-700"
          >
            {dia.nombre}
          </div>
        ))}

        {FRANJAS.map((franja, idxFranja) => (
          <FragmentoFila key={idxFranja} franja={franja} idxFranja={idxFranja} porCelda={porCelda} onQuitarNuevo={onQuitarNuevo} />
        ))}
      </div>
    </div>
  )
}

function FragmentoFila({
  franja,
  idxFranja,
  porCelda,
  onQuitarNuevo,
}: {
  franja: (typeof FRANJAS)[number]
  idxFranja: number
  porCelda: Map<string, CeldaAsistente[]>
  onQuitarNuevo?: (id: string) => void
}) {
  const mostrarEncabezadoJornada = idxFranja === 0 || FRANJAS[idxFranja - 1].jornada !== franja.jornada

  return (
    <>
      {mostrarEncabezadoJornada && (
        <div className="col-span-6 bg-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white dark:bg-slate-800">
          Jornada {franja.jornada}
        </div>
      )}
      <div className={`border-b border-r border-outline-variant px-2 py-2 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100 ${FONDO_JORNADA[franja.jornada]}`}>
        <div className="truncate">{franja.horaInicio}</div>
        <div className="truncate">– {franja.horaFin}</div>
      </div>
      {DIAS.map((dia, idxDia) => {
        const ocupantes = porCelda.get(`${idxFranja}-${idxDia}`) ?? []
        return (
          <div
            key={dia.idDia}
            className={`min-h-16 space-y-1 border-b border-r border-outline-variant p-1 last:border-r-0 dark:border-slate-700 ${
              ocupantes.length === 0 ? FONDO_JORNADA[franja.jornada] : ''
            }`}
          >
            {ocupantes.map((celda) => (
              <CeldaBloque key={celda.id} celda={celda} onQuitarNuevo={onQuitarNuevo} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function CeldaBloque({ celda, onQuitarNuevo }: { celda: CeldaAsistente; onQuitarNuevo?: (id: string) => void }) {
  const color = colorParaBloque(celda.id)
  const esConflicto = celda.estado === 'conflicto'

  return (
    <div
      className={`group relative space-y-0.5 rounded-md border-l-2 px-2 py-1.5 text-left text-[11px] leading-tight ${color.fondo} ${
        esConflicto ? 'border-red-600' : color.borde
      } ${color.texto}`}
      title={`${celda.resultadoDescripcion ?? 'Sin tema'} · ${celda.instructorNombre} · ${celda.ambienteNombre}`}
    >
      <p className="flex items-center gap-1 truncate font-semibold">
        {celda.origen === 'nuevo' && (
          <span className="rounded-full bg-sena-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Nuevo</span>
        )}
        {celda.resultadoDescripcion ?? `Ficha ${celda.fichaCodigo}`}
      </p>
      <p className="truncate">Ficha {celda.fichaCodigo} · {celda.instructorNombre}</p>
      <p className="truncate opacity-80">{celda.ambienteNombre}</p>
      {esConflicto && <p className="truncate font-semibold text-red-700 dark:text-red-400">⚠ Cruce -- no se guardará</p>}

      {celda.origen === 'nuevo' && onQuitarNuevo && (
        <button
          type="button"
          onClick={() => onQuitarNuevo(celda.id)}
          aria-label={`Quitar bloque nuevo de ficha ${celda.fichaCodigo}`}
          title="Quitar este bloque de la propuesta"
          className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[10px] leading-none text-slate-500 hover:bg-white hover:text-red-600 group-hover:flex dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          ✕
        </button>
      )}
    </div>
  )
}
