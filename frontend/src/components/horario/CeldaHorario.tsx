import type { MouseEvent } from 'react'
import type { BloqueClase } from '../../pages/horario/tipos'
import { colorParaBloque } from '../../pages/horario/gridLogic'

interface CeldaHorarioProps {
  bloque: BloqueClase | undefined
  /** "Lunes, 6:15 a.m – 9:00 a.m" — identifica la celda para lectores de pantalla y tests. */
  etiqueta: string
  /** Clase Tailwind de fondo cuando la celda está vacía (color de la jornada). */
  fondoVacio: string
  hayBloqueActivo: boolean
  /** Modo historial/exportación: sin interacción, sin botón de quitar. */
  soloLectura?: boolean
  onClic: (shiftKey: boolean) => void
  onQuitar: () => void
}

/**
 * Una celda del grid de horario. Vacía: placeholder tenue con el color de la
 * jornada, invita a hacer clic si hay un bloque activo. Asignada: tarjeta
 * compacta de solo lectura con el color propio del bloque — clic sin bloque
 * activo abre el modal de edición (lo decide `NuevoHorario`, acá solo se
 * reenvía el evento); Shift-clic desde otra celda rellena el rango entero.
 */
export function CeldaHorario({
  bloque,
  etiqueta,
  fondoVacio,
  hayBloqueActivo,
  soloLectura = false,
  onClic,
  onQuitar,
}: CeldaHorarioProps) {
  function manejarClic(evento: MouseEvent<HTMLButtonElement>) {
    onClic(evento.shiftKey)
  }

  if (!bloque) {
    if (soloLectura) {
      return <div aria-label={`${etiqueta}, vacía`} className={`h-full min-h-16 w-full ${fondoVacio}`} />
    }

    return (
      <button
        type="button"
        onClick={manejarClic}
        aria-label={hayBloqueActivo ? `Asignar bloque activo a ${etiqueta}` : `${etiqueta}, vacía`}
        className={`flex h-full min-h-16 w-full select-none flex-col items-center justify-center gap-1 border border-dashed border-transparent px-2 py-2 text-[11px] text-slate-500 transition ${fondoVacio} ${
          hayBloqueActivo ? 'cursor-pointer hover:border-slate-400 hover:text-slate-500' : 'cursor-default'
        }`}
      >
        {hayBloqueActivo && <span aria-hidden="true">+ asignar</span>}
      </button>
    )
  }

  const color = colorParaBloque(bloque.id)

  if (soloLectura) {
    return (
      <div
        aria-label={`${etiqueta}: ${bloque.tematica}`}
        title={`${bloque.tematica} · ${bloque.instructor} · ${bloque.ambiente}`}
        className={`h-full min-h-16 space-y-0.5 border-l-2 px-2 py-1.5 text-left text-[11px] leading-tight ${color.fondo} ${color.borde} ${color.texto}`}
      >
        <p className="truncate font-semibold">{bloque.tematica}</p>
        <p className="truncate">{bloque.instructor}</p>
        <p className="truncate opacity-80">{bloque.ambiente}</p>
      </div>
    )
  }

  return (
    <div className={`group relative h-full min-h-16 ${color.fondo}`}>
      <button
        type="button"
        onClick={manejarClic}
        aria-label={`${etiqueta}: ${bloque.tematica}`}
        title={`${bloque.tematica} · ${bloque.instructor} · ${bloque.ambiente}`}
        className={`block h-full w-full select-none space-y-0.5 border-l-2 px-2 py-1.5 text-left text-[11px] leading-tight ${color.borde} ${color.texto}`}
      >
        <p className="truncate font-semibold">{bloque.tematica}</p>
        <p className="truncate">{bloque.instructor}</p>
        <p className="truncate opacity-80">{bloque.ambiente}</p>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onQuitar()
        }}
        aria-label={`Quitar ${bloque.tematica} de esta celda`}
        title="Quitar de esta celda"
        className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[10px] leading-none text-slate-500 hover:bg-white hover:text-red-600 group-hover:flex"
      >
        ✕
      </button>
    </div>
  )
}
