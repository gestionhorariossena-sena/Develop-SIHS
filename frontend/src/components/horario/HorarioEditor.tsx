import { useEffect } from 'react'
import { useHorarioState } from '../../pages/horario/useHorarioState'
import type { BloqueClase, GridAsignaciones } from '../../pages/horario/tipos'
import type { Ficha } from '../../types/api'
import { PanelBloques } from './PanelBloques'
import { GridHorario } from './GridHorario'
import { ModalBloque } from './ModalBloque'
import type { CatalogosBloque } from './ModalBloque'

interface HorarioEditorProps {
  bloquesIniciales: BloqueClase[]
  gridInicial: GridAsignaciones
  /** Avisa al padre cada vez que cambian bloques/grid — así `NuevoHorario.tsx`
   * puede guardar el estado actual sin tener que ser dueño de `useHorarioState`. */
  onCambiarEstado?: (estado: { bloques: BloqueClase[]; grid: GridAsignaciones }) => void
  /** Si viene, el modal de bloques usa selects contra catálogos reales en
   * vez de texto libre — ver `ModalBloque.tsx`. `NuevoHorario.tsx` lo pasa;
   * el demo/tests de este componente no. */
  catalogos?: CatalogosBloque
  /** Ficha activa del flujo de programación por ficha. */
  fichaFijada?: Ficha
}

/**
 * Panel de bloques + grid + modal, con todo su estado. Es el componente que
 * de verdad implementa "define un bloque una vez, reutilízalo en el grid" —
 * no depende de `AppShell` ni de sesión de Supabase, así que se puede
 * renderizar y testear solo (ver `HorarioEditor.test.tsx`). `NuevoHorario.tsx`
 * lo monta dentro del layout de la app junto con el selector de ficha y los
 * campos del período.
 */
export function HorarioEditor({ bloquesIniciales, gridInicial, onCambiarEstado, catalogos, fichaFijada }: HorarioEditorProps) {
  const estado = useHorarioState({ bloques: bloquesIniciales, grid: gridInicial })
  const { modal } = estado
  const bloqueEnEdicion =
    modal?.tipo === 'editar' ? estado.bloques.find((b) => b.id === modal.bloqueId) : undefined

  useEffect(() => {
    onCambiarEstado?.({ bloques: estado.bloques, grid: estado.grid })
  }, [estado.bloques, estado.grid, onCambiarEstado])

  const idsBloquesPersistidos = new Set(
    estado.bloques.filter((bloque) => bloque.idHorarioOriginal !== undefined).map((bloque) => bloque.id),
  )

  return (
    <div className={`grid gap-4 ${fichaFijada ? '' : 'lg:grid-cols-[260px_1fr]'}`}>
      <div className="print:hidden">
        <PanelBloques
          bloques={estado.bloques.filter((bloque) => bloque.idHorarioOriginal === undefined)}
          bloqueActivoId={estado.bloqueActivoId}
          onActivar={estado.activarBloque}
          onNuevo={estado.abrirModalNuevo}
          onEditar={estado.abrirModalEditar}
          onEliminar={estado.eliminarBloque}
        />
      </div>

      <div className="min-w-0 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-on-surface dark:text-slate-100">
          <span className="material-symbols-outlined text-[18px] text-primary">calendar_view_week</span>
          Lienzo Semanal
        </div>

        {estado.bloqueActivo && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-container px-3 py-2 text-xs text-on-primary-container print:hidden">
            <span>
              Bloque activo: <strong>{estado.bloqueActivo.tematica}</strong> — clic en el grid
              para asignarlo, Shift+clic para rellenar un rango.
            </span>
            <button
              type="button"
              onClick={estado.desactivarBloque}
              className="shrink-0 rounded border border-primary px-2 py-1 font-semibold hover:bg-surface-container-lowest"
            >
              Desactivar
            </button>
          </div>
        )}

        <GridHorario
          bloques={estado.bloques}
          grid={estado.grid}
          hayBloqueActivo={estado.bloqueActivoId !== null}
          bloquesSoloLecturaIds={idsBloquesPersistidos}
          onClicCelda={estado.manejarClicCelda}
          onQuitarCelda={estado.quitarDeCelda}
        />
      </div>

      {modal && (
        <ModalBloque
          bloqueInicial={bloqueEnEdicion}
          catalogos={catalogos}
          fichaFijada={fichaFijada}
          onGuardar={estado.guardarDesdeModal}
          onCancelar={estado.cerrarModal}
        />
      )}
    </div>
  )
}
