import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

interface DrawerRelacionadosProps {
  iniciales: string
  titulo: string
  subtitulo?: string
  etiquetas?: string[]
  onCerrar: () => void
  children: ReactNode
}

/**
 * Panel base del drawer de relacionados (header con avatar/título/cerrar +
 * slot de secciones) — mockups en
 * `_Docs/Diseño/mockups-nuevo-alcance/01-instructores-relacionados.png` y
 * `02-fichas-relacionados.png`. Lo usan Instructores.tsx (secciones de
 * instructor: carga semanal, fichas asignadas, temas que dicta, ambientes
 * asignados) y, más adelante, Fichas.tsx con sus propias secciones — este
 * componente solo pone el armazón común, no sabe de instructores ni fichas.
 */
export function DrawerRelacionados({ iniciales, titulo, subtitulo, etiquetas, onCerrar, children }: DrawerRelacionadosProps) {
  const contenidoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    contenidoRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [])

  function manejarTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onCerrar}>
      <aside
        ref={contenidoRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onKeyDown={manejarTeclado}
        onClick={(evento) => evento.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-800"
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sena-100 font-bold text-sena-700 dark:bg-sena-950/50">
              {iniciales}
            </span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
              {subtitulo && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>}
              {etiquetas && etiquetas.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {etiquetas.map((etiqueta) => (
                    <span key={etiqueta} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {etiqueta}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="flex flex-col gap-4">{children}</div>
      </aside>
    </div>
  )
}

/** Contenedor con título de sección, reutilizado por todas las secciones
 * del drawer (fichas/temas/ambientes de instructor, y luego las de ficha). */
export function SeccionDrawer({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h3>
      {children}
    </section>
  )
}
