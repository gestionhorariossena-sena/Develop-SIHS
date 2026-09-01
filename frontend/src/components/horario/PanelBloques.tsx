import { useState } from 'react'
import type { BloqueClase } from '../../pages/horario/tipos'
import { colorParaBloque } from '../../pages/horario/gridLogic'

interface PanelBloquesProps {
  bloques: BloqueClase[]
  bloqueActivoId: string | null
  onActivar: (id: string) => void
  onNuevo: () => void
  onEditar: (id: string) => void
  onEliminar: (id: string) => void
}

/**
 * Lista de bloques de clase reutilizables ("temática + instructor + ficha +
 * ambiente" definidos una sola vez). Hacer clic en un bloque lo activa: con
 * un bloque activo, un clic en una celda del grid la llena, y Shift-clic
 * rellena todo un rango de celdas de una sola vez — así no hay que escribir
 * lo mismo 30 veces para una clase que se repite toda la semana.
 */
export function PanelBloques({
  bloques,
  bloqueActivoId,
  onActivar,
  onNuevo,
  onEditar,
  onEliminar,
}: PanelBloquesProps) {
  // Confirmación en línea antes de eliminar (no window.confirm — así queda
  // consistente con el resto de la UI y se puede testear como cualquier
  // otro botón). Solo un bloque a la vez puede estar "pidiendo confirmar".
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bloques de clase</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Elige uno y haz clic en el grid para asignarlo.</p>
        </div>
        <button
          type="button"
          onClick={onNuevo}
          className="shrink-0 rounded-lg bg-sena-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sena-800"
        >
          + Nuevo
        </button>
      </div>

      {bloques.length === 0 ? (
<<<<<<< HEAD
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400 dark:bg-slate-900 dark:text-slate-400">
=======
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
>>>>>>> 461bee0a210f8809cd946fb23cdfc26f619e3089
          Todavía no hay bloques. Crea el primero con "+ Nuevo".
        </p>
      ) : (
        <ul className="space-y-1.5">
          {bloques.map((bloque) => {
            const color = colorParaBloque(bloque.id)
            const activo = bloque.id === bloqueActivoId
            const confirmando = confirmandoId === bloque.id

            return (
              <li key={bloque.id}>
                <div
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                    activo ? 'border-sena-600 ring-1 ring-sena-600 dark:bg-slate-700/50' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {confirmando ? (
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
                        ¿Eliminar <strong className="text-slate-800 dark:text-slate-100">{bloque.tematica}</strong>?
                      </span>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onEliminar(bloque.id)
                            setConfirmandoId(null)
                          }}
                          aria-label={`Confirmar eliminar ${bloque.tematica}`}
                          className="rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                        >
                          Sí, eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(null)}
                          aria-label={`Cancelar eliminar ${bloque.tematica}`}
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onActivar(bloque.id)}
                        aria-pressed={activo}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className={`h-3 w-3 shrink-0 rounded-full ${color.fondo} border ${color.borde}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {bloque.tematica}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {bloque.instructor}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditar(bloque.id)}
                        aria-label={`Editar ${bloque.tematica}`}
                        title="Editar"
<<<<<<< HEAD
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
=======
                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
>>>>>>> 461bee0a210f8809cd946fb23cdfc26f619e3089
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(bloque.id)}
                        aria-label={`Eliminar ${bloque.tematica}`}
                        title="Eliminar"
<<<<<<< HEAD
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/50"
=======
                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
>>>>>>> 461bee0a210f8809cd946fb23cdfc26f619e3089
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
