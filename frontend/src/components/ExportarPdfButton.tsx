interface ExportarPdfButtonProps {
  etiqueta?: string
  className?: string
}

/**
 * Botón reutilizable para exportar la pantalla actual a PDF: dispara el
 * diálogo nativo de "Imprimir → Guardar como PDF" del navegador en vez de
 * generar el archivo en el cliente — cero librerías nuevas, y el texto
 * queda seleccionable/nítido en el PDF (no es una captura de pantalla).
 *
 * Cada pantalla que lo use marca con la clase `print:hidden` lo que NO debe
 * salir en el PDF (sidebar, botones, encabezados de la app) — lo que quede
 * sin esa clase es lo que se exporta. Ver el ajuste de color de impresión
 * en `frontend/src/index.css` (si no, los fondos de color del horario
 * salen en blanco).
 */
export function ExportarPdfButton({ etiqueta = 'Exportar a PDF', className }: ExportarPdfButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`${
        className ??
        'rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
      } print:hidden`}
    >
      {etiqueta}
    </button>
  )
}
