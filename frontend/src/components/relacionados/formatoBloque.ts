/** Formato de bloque día+hora compartido entre SeccionesInstructor.tsx
 * (SCRUM-62) y SeccionesFicha.tsx (SCRUM-68) — en archivo aparte porque
 * react-refresh exige que un archivo de componentes solo exporte
 * componentes. */

export function formatoHora(hora: string) {
  return hora.slice(0, 5)
}

export function nombresDias(dias: number[], diasPorId: Record<number, string>) {
  return dias.map((id) => diasPorId[id] ?? '?').join(' y ')
}
