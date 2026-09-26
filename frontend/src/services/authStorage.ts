/** Supabase usa esta misma interfaz para guardar y renovar la sesión. */
const CLAVE_MODO_SESION = 'sihs-modo-sesion'

export function configurarRecordarme(recordarme: boolean) {
  if (recordarme) {
    localStorage.removeItem(CLAVE_MODO_SESION)
  } else {
    // Compartir el modo entre pestañas impide que una sesión renovada en
    // otra pestaña vuelva a escribir el token en almacenamiento persistente.
    localStorage.setItem(CLAVE_MODO_SESION, 'pestana')
  }
}

function soloEstaPestana() {
  return localStorage.getItem(CLAVE_MODO_SESION) === 'pestana'
}

/**
 * Conserva las sesiones existentes en localStorage. Si la persona entra sin
 * «Recordarme», Supabase pasa a sessionStorage y elimina la copia persistente
 * al guardar el nuevo token. Las renovaciones usan el mismo destino.
 */
export const authStorage = {
  getItem(key: string) {
    return soloEstaPestana() ? sessionStorage.getItem(key) : localStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    const destino = soloEstaPestana() ? sessionStorage : localStorage
    const anterior = soloEstaPestana() ? localStorage : sessionStorage
    destino.setItem(key, value)
    anterior.removeItem(key)
  },
  removeItem(key: string) {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  },
}
