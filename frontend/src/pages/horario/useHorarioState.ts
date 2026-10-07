import { useState } from 'react'
import type { DatosBloque } from '../../components/horario/ModalBloque'
import { BLOQUES, DIAS } from './tipos'
import type { BloqueClase, GridAsignaciones, PosicionCelda } from './tipos'
import {
  asignarCelda,
  asignarRango,
  crearIdBloque,
  quitarBloqueDeGrid,
  quitarCelda,
  rangoRectangular,
} from './gridLogic'

export type EstadoModalBloque =
  | { tipo: 'crear' }
  | { tipo: 'crear-en-celda'; posicion: PosicionCelda }
  | { tipo: 'editar'; bloqueId: string }

export function gridVacio(): GridAsignaciones {
  return BLOQUES.map(() => DIAS.map(() => null))
}

/**
 * Toda la lógica de estado de la pantalla de horarios: los bloques de clase
 * definidos, qué celda tiene asignado cuál, cuál bloque está "armado" para
 * pintar, y el modal de crear/editar. Vive en un hook aparte (en vez de
 * directo en `NuevoHorario.tsx`) para poder testearlo/usarlo sin depender de
 * `AppShell` (que exige sesión de Supabase) — ver `HorarioEditor.tsx`.
 */
export function useHorarioState(inicial: { bloques: BloqueClase[]; grid: GridAsignaciones }) {
  const [bloques, setBloques] = useState<BloqueClase[]>(inicial.bloques)
  const [grid, setGrid] = useState<GridAsignaciones>(inicial.grid)
  const [bloqueActivoId, setBloqueActivoId] = useState<string | null>(null)
  const [ultimaCeldaClic, setUltimaCeldaClic] = useState<PosicionCelda | null>(null)
  const [modal, setModal] = useState<EstadoModalBloque | null>(null)

  const bloqueActivo = bloques.find((b) => b.id === bloqueActivoId) ?? null

  function activarBloque(id: string) {
    // OJO: a propósito NO se resetea `ultimaCeldaClic` acá. Si se resetea,
    // el primer Shift+clic después de activar un bloque desde el panel no
    // tiene ancla (`ultimaCeldaClic` es null) y cae al camino de "una sola
    // celda" — se siente como que "Shift+clic no llena el rango". Dejar la
    // última celda tocada como ancla, sea cual sea el bloque que estaba
    // activo entonces, hace que un Shift+clic funcione siempre que ya se
    // haya hecho al menos un clic antes en la sesión — igual que Excel/
    // Sheets recuerdan la última celda activa.
    setBloqueActivoId((anterior) => (anterior === id ? null : id))
  }

  function desactivarBloque() {
    setBloqueActivoId(null)
  }

  function manejarClicCelda(posicion: PosicionCelda, shiftKey: boolean) {
    const bloqueIdEnCelda = grid[posicion.bloqueIdx][posicion.diaIdx]
    const bloqueEnCelda = bloques.find((bloque) => bloque.id === bloqueIdEnCelda)
    if (bloqueEnCelda?.idHorarioOriginal !== undefined) return

    if (bloqueActivoId) {
      const celdas =
        shiftKey && ultimaCeldaClic ? rangoRectangular(ultimaCeldaClic, posicion) : [posicion]
      const celdasEditables = celdas.filter((celda) => {
        const bloqueId = grid[celda.bloqueIdx][celda.diaIdx]
        return bloques.find((bloque) => bloque.id === bloqueId)?.idHorarioOriginal === undefined
      })
      setGrid((anterior) => asignarRango(anterior, celdasEditables, bloqueActivoId))
      setUltimaCeldaClic(posicion)
      return
    }

    if (bloqueIdEnCelda) {
      setModal({ tipo: 'editar', bloqueId: bloqueIdEnCelda })
    } else {
      setModal({ tipo: 'crear-en-celda', posicion })
    }
  }

  function quitarDeCelda(posicion: PosicionCelda) {
    const bloqueId = grid[posicion.bloqueIdx][posicion.diaIdx]
    if (bloques.find((bloque) => bloque.id === bloqueId)?.idHorarioOriginal !== undefined) return
    setGrid((anterior) => quitarCelda(anterior, posicion))
  }

  function eliminarBloque(id: string) {
    if (bloques.find((bloque) => bloque.id === id)?.idHorarioOriginal !== undefined) return
    setBloques((anterior) => anterior.filter((b) => b.id !== id))
    setGrid((anterior) => quitarBloqueDeGrid(anterior, id))
    if (bloqueActivoId === id) setBloqueActivoId(null)
  }

  function abrirModalNuevo() {
    setModal({ tipo: 'crear' })
  }

  function abrirModalEditar(id: string) {
    setModal({ tipo: 'editar', bloqueId: id })
  }

  function cerrarModal() {
    setModal(null)
  }

  function guardarDesdeModal(datosForm: DatosBloque) {
    if (!modal) return

    if (modal.tipo === 'editar') {
      const id = modal.bloqueId
      setBloques((anterior) => anterior.map((b) => (b.id === id ? { ...b, ...datosForm } : b)))
      setModal(null)
      return
    }

    const nuevoBloque: BloqueClase = { id: crearIdBloque(), ...datosForm }
    setBloques((anterior) => [...anterior, nuevoBloque])
    if (modal.tipo === 'crear-en-celda') {
      const posicion = modal.posicion
      setGrid((anterior) => asignarCelda(anterior, posicion, nuevoBloque.id))
      // Ancla el punto de partida para que un Shift+clic inmediatamente
      // después del alta rellene el rango desde esta celda.
      setUltimaCeldaClic(posicion)
    }
    setBloqueActivoId(nuevoBloque.id)
    setModal(null)
  }

  return {
    bloques,
    grid,
    bloqueActivoId,
    bloqueActivo,
    modal,
    activarBloque,
    desactivarBloque,
    manejarClicCelda,
    quitarDeCelda,
    eliminarBloque,
    abrirModalNuevo,
    abrirModalEditar,
    cerrarModal,
    guardarDesdeModal,
  }
}
