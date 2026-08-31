export type TipoNotificacion = 'cruce' | 'horario' | 'ambiente' | 'sistema'
export type GrupoNotificacion = 'Hoy' | 'Ayer' | 'Esta semana'

export interface Notificacion {
  id: string
  tipo: TipoNotificacion
  titulo: string
  descripcion: string
  grupo: GrupoNotificacion
  hora: string
  leida: boolean
}

// El módulo de notificaciones real (triggers, persistencia, WebSocket/polling)
// todavía no existe en el backend — este arreglo queda vacío a propósito (ya
// no lleva datos de ejemplo) para que la campana y el punto rojo del header
// (ver AppShell/NotificacionesPanel) solo se enciendan cuando haya una
// notificación real. Reemplazar por un fetch real (GET /notificaciones)
// siguiendo el patrón de apiGet en cuanto el endpoint exista.
export const NOTIFICACIONES: Notificacion[] = []
