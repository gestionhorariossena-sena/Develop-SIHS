/** Minutos restantes legibles para el mensaje de bloqueo de login (RNF-06). */
export function formatearTiempoRestante(segundos: number): string {
  const minutos = Math.ceil(segundos / 60)
  return minutos <= 1 ? 'menos de 1 minuto' : `${minutos} minutos`
}
