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
  /** No se pasa (o no se llama) cuando hay algún conflicto RF-011 — esos
   * son bloqueo duro, ver puedeForzar más abajo. */
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
 * Distingue dos tipos de conflicto (§7.2 de PLAN_INTEGRACION_LOGICA_Y_BD.md):
 * - FÍSICO (cruce_ficha/instructor/ambiente, resultado_repetido): el
 *   coordinador puede decidir programar igual — "Programar de todas
 *   formas" reintenta con forzar=true y queda auditado.
 * - RF-011 (tope de horas, jornada Noche vetada para planta, jornadas
 *   continuas en otro centro): regla institucional, bloqueo duro — el
 *   backend la rechaza aunque se mande forzar=true (ver
 *   HorarioService.crear/actualizar), así que acá ni se ofrece el botón.
 *
 * Mockup aprobado: _Docs/Diseño/mockups-nuevo-alcance/03-modal-cruce.png
 * (cubre el caso físico — el tratamiento rojo de RF-011 es una extensión
 * de ese mismo lenguaje visual, no está en el mockup literal).
 */
export function ModalCruce({ bloqueResumen, conflictos, onCancelar, onForzar }: ModalCruceProps) {
  const contenidoRef = useRef<HTMLDivElement>(null)

  const conflictosDuros = conflictos.filter((c) => c.tipo === 'regla_instructor')
  const conflictosFisicos = conflictos.filter((c) => c.tipo !== 'regla_instructor')
  const puedeForzar = conflictosDuros.length === 0 && conflictosFisicos.length > 0

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
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              conflictosDuros.length > 0
                ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
            }`}
            aria-hidden="true"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </span>
          <div>
            <h2 id="modal-cruce-titulo" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {conflictosDuros.length > 0 ? 'No se puede programar así' : 'Se detectó un cruce de horario'}
            </h2>
            <p id="modal-cruce-descripcion" className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {conflictosDuros.length > 0
                ? 'El bloque que estás programando viola una regla institucional (RF-011). Ajusta el horario o el instructor para continuar.'
                : 'El bloque que estás programando choca con horarios que ya existen. Revisa el detalle y decide si cancelar o programarlo de todas formas.'}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Bloque que estás programando
          </p>
          <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{bloqueResumen}</p>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto">
          {conflictosDuros.map((conflicto, i) => (
            <div
              key={`duro-${i}`}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/40"
            >
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {TITULO_POR_TIPO[conflicto.tipo]}
              </p>
              <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">{conflicto.mensaje}</p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Regla institucional — no se puede forzar.
              </p>
            </div>
          ))}

          {conflictosFisicos.map((conflicto, i) => (
            <div
              key={`fisico-${i}`}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
            >
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {TITULO_POR_TIPO[conflicto.tipo]}
              </p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">{conflicto.mensaje}</p>
            </div>
          ))}
        </div>

        {puedeForzar && (
          <p className="mb-1 mt-4 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
              />
            </svg>
            Si programas de todas formas, queda registrado en auditoría quién lo hizo y contra qué.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          {puedeForzar && (
            <button
              type="button"
              onClick={onForzar}
              // orange-600 con texto blanco da ~3.56:1 — no pasa el 4.5:1
              // de WCAG AA (mismo problema que sena-600, ver index.css).
              // orange-700 pasa (~5.2:1).
              className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
            >
              Programar de todas formas
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
