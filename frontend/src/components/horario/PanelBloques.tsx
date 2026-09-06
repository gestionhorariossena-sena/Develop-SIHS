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
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-on-surface dark:text-slate-100">
            <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
            Piezas para Asignar
          </p>
          <p className="text-xs text-on-surface-variant dark:text-slate-400">
            {bloques.length} {bloques.length === 1 ? 'bloque listo' : 'bloques listos'} — elige uno y haz clic en el grid.
          </p>
        </div>
        <button
          type="button"
          onClick={onNuevo}
          className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-on-primary-container"
        >
          + Nuevo
        </button>
      </div>

      {bloques.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-4 text-center text-xs text-on-surface-variant dark:bg-slate-900 dark:text-slate-400">
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
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 transition ${
                    activo ? 'border-primary ring-1 ring-primary dark:bg-slate-700/50' : 'border-outline-variant dark:border-slate-700'
                  }`}
                >
                  {confirmando ? (
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-on-surface-variant dark:text-slate-300">
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
                          className="rounded border border-outline px-2 py-1 text-[11px] font-medium text-on-surface-variant hover:bg-surface dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
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
                          <span className="block truncate text-[11px] text-on-surface-variant dark:text-slate-400">
                            {bloque.instructor}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-[10px] font-semibold text-on-secondary-container">
                              Ficha {bloque.ficha}
                            </span>
                            <span className="rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant dark:bg-slate-700">
                              {bloque.ambiente}
                            </span>
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditar(bloque.id)}
                        aria-label={`Editar ${bloque.tematica}`}
                        title="Editar"
                        className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface-variant dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(bloque.id)}
                        aria-label={`Eliminar ${bloque.tematica}`}
                        title="Eliminar"
                        className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50"
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
