import { useState } from 'react'
import { apiDelete, apiGet, ApiError } from '../services/api'
import type { EliminacionSeguraAnalisis, TipoEliminable } from '../types/api'

interface EliminacionSeguraProps {
  tipo: TipoEliminable
  id: string | number
  /** Para los mensajes ("Eliminar ficha 3228973 B", no un id interno). */
  nombre: string
  /** Se llama una vez el DELETE real se confirma -- la página dueña del
   * listado decide qué hacer (cerrar el drawer, sacar la fila, recargar). */
  onEliminado: () => void
}

const ETIQUETA_TIPO: Record<TipoEliminable, string> = {
  instructor: 'instructor',
  aprendiz: 'aprendiz',
  ficha: 'ficha',
  ambiente: 'ambiente',
}

function describirImpacto(analisis: EliminacionSeguraAnalisis): string {
  const { horariosBorrador, vinculosFicha } = analisis.dependencias
  if (analisis.accion === 'eliminar_entidad') {
    return vinculosFicha > 0
      ? `No tiene horarios asignados. Se eliminará junto con ${vinculosFicha} vínculo${vinculosFicha === 1 ? '' : 's'} de ficha.`
      : 'No tiene horarios ni vínculos asignados -- se eliminará sin afectar otros registros.'
  }
  return `Tiene ${horariosBorrador} horario${horariosBorrador === 1 ? '' : 's'} en borrador (nunca publicado${horariosBorrador === 1 ? '' : 's'}): se eliminará junto con ellos${vinculosFicha > 0 ? ` y ${vinculosFicha} vínculo${vinculosFicha === 1 ? '' : 's'} de ficha` : ''}.`
}

function describirBloqueo(analisis: EliminacionSeguraAnalisis): string {
  const { horariosPublicados, asistencias } = analisis.dependencias
  const partes: string[] = []
  if (horariosPublicados > 0) partes.push(`${horariosPublicados} horario${horariosPublicados === 1 ? '' : 's'} ya publicado${horariosPublicados === 1 ? '' : 's'}`)
  if (asistencias > 0) partes.push(`${asistencias} registro${asistencias === 1 ? '' : 's'} de asistencia`)
  return `No se puede eliminar: tiene ${partes.join(' y ')}. ${analisis.mensaje ?? 'No se elimina historial publicado ni asistencias.'}`
}

/**
 * SCRUM-198: botón de borrado seguro para ficha/instructor/ambiente/
 * aprendiz -- consume GET/DELETE /eliminacion-segura/{tipo}/{id} (solo
 * Administrador en el backend). Nunca ofrece un botón destructivo ciego:
 * primero trae el análisis real (horarios publicados/borrador, asistencias,
 * vínculos de ficha) y, si hay algo publicado o con asistencias, ni
 * siquiera muestra la opción de eliminar -- solo el motivo del bloqueo.
 */
export function EliminacionSegura({ tipo, id, nombre, onEliminado }: EliminacionSeguraProps) {
  const [analisis, setAnalisis] = useState<EliminacionSeguraAnalisis | null>(null)
  const [cargando, setCargando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cerrar() {
    setAnalisis(null)
    setError(null)
  }

  async function analizar() {
    setCargando(true)
    setError(null)
    try {
      const resultado = await apiGet<EliminacionSeguraAnalisis>(`/eliminacion-segura/${tipo}/${id}`)
      setAnalisis(resultado)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `No se pudo analizar si ${ETIQUETA_TIPO[tipo]} se puede eliminar.`)
    } finally {
      setCargando(false)
    }
  }

  async function confirmarEliminacion() {
    setEliminando(true)
    setError(null)
    try {
      await apiDelete(`/eliminacion-segura/${tipo}/${id}`)
      onEliminado()
    } catch (err) {
      // 409: el backend volvió a bloquear (ej. alguien publicó un horario
      // entre el análisis y este clic) -- se vuelve a mostrar el bloqueo
      // real en vez de un error genérico de red.
      if (err instanceof ApiError && err.detail && typeof err.detail === 'object' && 'accion' in err.detail) {
        setAnalisis(err.detail as EliminacionSeguraAnalisis)
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo completar la eliminación.')
      }
    } finally {
      setEliminando(false)
    }
  }

  if (!analisis) {
    return (
      <div>
        <button
          type="button"
          onClick={() => void analizar()}
          disabled={cargando}
          className="w-full rounded-xl border border-error/40 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          {cargando ? 'Analizando dependencias…' : `Eliminar ${ETIQUETA_TIPO[tipo]} ${nombre}`}
        </button>
        {error && (
          <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (analisis.accion === 'bloqueado') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-semibold">{describirBloqueo(analisis)}</p>
        <button type="button" onClick={cerrar} className="mt-2 text-sm font-semibold underline">
          Entendido
        </button>
      </div>
    )
  }

  return (
    <div role="alertdialog" aria-label={`Confirmar eliminación de ${ETIQUETA_TIPO[tipo]} ${nombre}`} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">¿Eliminar {ETIQUETA_TIPO[tipo]} {nombre}?</p>
      <p className="mt-1">{describirImpacto(analisis)}</p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-100 px-2.5 py-1.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={cerrar}
          disabled={eliminando}
          className="rounded-lg border border-outline px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmarEliminacion()}
          disabled={eliminando}
          className="rounded-lg bg-error px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700"
        >
          {eliminando ? 'Eliminando…' : 'Confirmar eliminación'}
        </button>
      </div>
    </div>
  )
}
