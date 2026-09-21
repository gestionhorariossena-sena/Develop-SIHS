import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { HorarioDryRunConflict, TipoConflictoHorario } from '../../types/api'

interface ModalCruceProps {
  /** 'Jueves 12:00 p.m – 3:00 p.m · CPL21 — Distribución logística ·
   * David Camelo · Ficha 3068356 · Ambiente 306' — qué se está intentando
   * programar, para dar contexto arriba de los conflictos. */
  bloqueResumen: string
  conflictos: HorarioDryRunConflict[]
  onCancelar: () => void
  onForzar: () => void
}

const TITULO_POR_TIPO: Record<TipoConflictoHorario, string> = {
  cruce_ficha: 'Ficha ocupada',
  cruce_instructor: 'Instructor ocupado',
  cruce_ambiente: 'Ambiente ocupado',
  resultado_repetido: 'Resultado repetido',
  regla_instructor: 'Regla institucional (RF-011)',
}

/**
 * Distingue dos tipos de conflicto solo para EXPLICARLOS mejor (§7.2 de
 * PLAN_INTEGRACION_LOGICA_Y_BD.md, corregido 2026-09-02 — David, product
 * owner, revirtió la primera versión de esta sección): RF-011 (tope de
 * horas, jornada Noche vetada para planta, jornadas continuas) sigue el
 * MISMO patrón que los cruces físicos (ficha/instructor/ambiente,
 * resultado repetido) — el coordinador puede programar de todas formas
 * en ambos casos, y queda auditado. No es una excepción de bloqueo
 * duro; el tratamiento rojo de RF-011 es solo para que el coordinador
 * note que es una regla institucional antes de forzarla, no para
 * impedirlo.
 *
 * Mockup aprobado: _Docs/Diseño/mockups-nuevo-alcance/03-modal-cruce.png
 * (cubre el caso físico — el tratamiento rojo de RF-011 es una extensión
 * de ese mismo lenguaje visual, no está en el mockup literal).
 */
export function ModalCruce({ bloqueResumen, conflictos, onCancelar, onForzar }: ModalCruceProps) {
  const contenidoRef = useRef<HTMLDivElement>(null)

  const conflictosDuros = conflictos.filter((c) => c.tipo === 'regla_instructor')
  const conflictosFisicos = conflictos.filter((c) => c.tipo !== 'regla_instructor')
  const hayConflictos = conflictos.length > 0

  useEffect(() => {
    contenidoRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [])

  function manejarTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      onCancelar()
      return
    }

    if (evento.key !== 'Tab' || !contenidoRef.current) return

    const focables = contenidoRef.current.querySelectorAll<HTMLElement>('button')
    if (focables.length === 0) return

    const primero = focables[0]
    const ultimo = focables[focables.length - 1]

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primero.focus()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cruce-titulo"
      aria-describedby="modal-cruce-descripcion"
      onKeyDown={manejarTeclado}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        ref={contenidoRef}
        className="w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-xl dark:bg-slate-800"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              conflictosDuros.length > 0
                ? 'bg-error-container text-error dark:bg-red-950/50 dark:text-red-400'
                : 'bg-tertiary-container text-tertiary dark:bg-amber-950/50 dark:text-amber-400'
            }`}
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[22px]">warning</span>
          </span>
          <div>
            <h2 id="modal-cruce-titulo" className="text-lg font-bold text-on-surface dark:text-slate-100">
              Se detectó un cruce de horario
            </h2>
            <p id="modal-cruce-descripcion" className="mt-1 text-sm text-on-surface-variant dark:text-slate-400">
              El bloque que estás programando choca con horarios que ya existen o con una regla
              institucional. Revisa el detalle y decide si cancelar o programarlo de todas formas.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-outline-variant bg-surface px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-slate-400">
            Bloque que estás programando
          </p>
          <p className="mt-0.5 text-sm text-on-surface dark:text-slate-200">{bloqueResumen}</p>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto">
          {conflictosDuros.map((conflicto, i) => (
            <div
              key={`duro-${i}`}
              className="rounded-xl border border-error/30 bg-error-container px-3 py-2.5 dark:border-red-900 dark:bg-red-950/40"
            >
              <p className="text-sm font-semibold text-on-error-container dark:text-red-300">
                {TITULO_POR_TIPO[conflicto.tipo]}
              </p>
              <p className="mt-0.5 text-sm text-on-error-container dark:text-red-400">{conflicto.mensaje}</p>
              <p className="mt-1 text-xs text-on-error-container/80 dark:text-red-400">
                Regla institucional — revísala antes de programar de todas formas.
              </p>
            </div>
          ))}

          {conflictosFisicos.map((conflicto, i) => (
            <div
              key={`fisico-${i}`}
              className="rounded-xl border border-tertiary/30 bg-tertiary-container px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
            >
              <p className="text-sm font-semibold text-on-tertiary-container dark:text-amber-300">
                {TITULO_POR_TIPO[conflicto.tipo]}
              </p>
              <p className="mt-0.5 text-sm text-on-tertiary-container dark:text-amber-400">{conflicto.mensaje}</p>
            </div>
          ))}
        </div>

        {hayConflictos && (
          <p className="mb-1 mt-4 flex items-start gap-1.5 text-xs text-on-surface-variant dark:text-slate-400">
            <span className="material-symbols-outlined mt-px shrink-0 text-[14px]">info</span>
            Si programas de todas formas, queda registrado en auditoría quién lo hizo y contra qué.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          {hayConflictos && (
            <button
              type="button"
              onClick={onForzar}
              // orange-600 con texto blanco da ~3.56:1 — no pasa el 4.5:1
              // de WCAG AA (mismo problema que sena-600, ver index.css).
              // orange-700 pasa (~5.2:1).
              className="rounded-xl bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
            >
              Programar de todas formas
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
