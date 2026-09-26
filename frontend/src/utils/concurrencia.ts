/**
 * `Promise.all` sobre un map dispara TODAS las peticiones a la vez. Con
 * los 90 bloques que propone el asistente de programación eso son 90
 * requests simultáneos contra un backend de un solo proceso, cada uno
 * costando ~1.6s (9 consultas × ~170ms de ida y vuelta a Supabase): el
 * navegador solo abre 6 conexiones por host, así que las demás se
 * encolan y las últimas superan su propio timeout y se abortan solas.
 *
 * Esto recorre la lista con una ventana fija de trabajadores: siempre
 * hay `limite` peticiones en vuelo y ninguna espera de más en una cola
 * invisible. El orden del resultado es el de entrada, no el de llegada.
 */
export async function mapearConLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(items.length)
  let siguiente = 0

  async function trabajador(): Promise<void> {
    for (let i = siguiente++; i < items.length; i = siguiente++) {
      resultados[i] = await fn(items[i], i)
    }
  }

  const trabajadores = Array.from(
    { length: Math.max(1, Math.min(limite, items.length)) },
    trabajador,
  )
  await Promise.all(trabajadores)

  return resultados
}
