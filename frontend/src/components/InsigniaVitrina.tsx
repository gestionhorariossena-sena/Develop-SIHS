/** Insignia reutilizable para marcar contenido de vitrina (sin backend
 * real todavía) — mismo criterio que el botón deshabilitado de
 * Dashboard.tsx, aplicado a una tarjeta o bloque completo en vez de a un
 * solo botón. Ver también el patrón de botón individual deshabilitado +
 * `title` para acciones puntuales de vitrina. */
export function InsigniaVitrina() {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      Vitrina · sin datos reales aún
    </span>
  )
}
