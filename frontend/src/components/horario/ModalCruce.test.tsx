import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModalCruce } from './ModalCruce'
import type { HorarioDryRunConflict } from '../../types/api'

const CONFLICTO_INSTRUCTOR: HorarioDryRunConflict = {
  tipo: 'cruce_instructor',
  mensaje: 'David Camelo ya tiene otra clase programada en ese horario: Jueves 12:00 p.m – 3:00 p.m · Ficha 2831190 · Ambiente 310.',
}

const CONFLICTO_AMBIENTE: HorarioDryRunConflict = {
  tipo: 'cruce_ambiente',
  mensaje: 'El Ambiente 306 ya está asignado en ese horario: Jueves 12:00 p.m – 3:00 p.m · instructor Claudia Pinzón · Ficha 2758431.',
}

const CONFLICTO_RF011: HorarioDryRunConflict = {
  tipo: 'regla_instructor',
  mensaje: 'El instructor Sergio Ríos (planta) no puede programarse en jornada Noche.',
}

const BLOQUE_RESUMEN =
  'Jueves 12:00 p.m – 3:00 p.m · CPL21 — Distribución logística · David Camelo · Ficha 3068356 · Ambiente 306'

describe('ModalCruce', () => {
  it('muestra el resumen del bloque y cada conflicto físico recibido, con su mensaje completo', () => {
    render(
      <ModalCruce
        bloqueResumen={BLOQUE_RESUMEN}
        conflictos={[CONFLICTO_INSTRUCTOR, CONFLICTO_AMBIENTE]}
        onCancelar={vi.fn()}
        onForzar={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Se detectó un cruce de horario' })).toBeInTheDocument()
    expect(screen.getByText(BLOQUE_RESUMEN)).toBeInTheDocument()

    expect(screen.getByText('Instructor ocupado')).toBeInTheDocument()
    expect(screen.getByText(CONFLICTO_INSTRUCTOR.mensaje)).toBeInTheDocument()

    expect(screen.getByText('Ambiente ocupado')).toBeInTheDocument()
    expect(screen.getByText(CONFLICTO_AMBIENTE.mensaje)).toBeInTheDocument()
  })

  it('con solo conflictos físicos, ofrece "Programar de todas formas"', () => {
    render(
      <ModalCruce
        bloqueResumen={BLOQUE_RESUMEN}
        conflictos={[CONFLICTO_INSTRUCTOR]}
        onCancelar={vi.fn()}
        onForzar={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Programar de todas formas' })).toBeInTheDocument()
    expect(screen.getByText(/queda registrado en auditoría/i)).toBeInTheDocument()
  })

  it('con un conflicto RF-011, lo muestra distinto (bloqueo duro) y NO ofrece forzar', () => {
    render(
      <ModalCruce
        bloqueResumen={BLOQUE_RESUMEN}
        conflictos={[CONFLICTO_RF011]}
        onCancelar={vi.fn()}
        onForzar={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'No se puede programar así' })).toBeInTheDocument()
    expect(screen.getByText('Regla institucional (RF-011)')).toBeInTheDocument()
    expect(screen.getByText(CONFLICTO_RF011.mensaje)).toBeInTheDocument()
    expect(screen.getByText(/no se puede forzar/i)).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Programar de todas formas' })).not.toBeInTheDocument()
    expect(screen.queryByText(/queda registrado en auditoría/i)).not.toBeInTheDocument()
  })

  it('con conflicto físico Y RF-011 a la vez, muestra ambos pero sigue sin ofrecer forzar (RF-011 manda)', () => {
    render(
      <ModalCruce
        bloqueResumen={BLOQUE_RESUMEN}
        conflictos={[CONFLICTO_INSTRUCTOR, CONFLICTO_RF011]}
        onCancelar={vi.fn()}
        onForzar={vi.fn()}
      />,
    )

    expect(screen.getByText('Instructor ocupado')).toBeInTheDocument()
    expect(screen.getByText(CONFLICTO_INSTRUCTOR.mensaje)).toBeInTheDocument()
    expect(screen.getByText('Regla institucional (RF-011)')).toBeInTheDocument()
    expect(screen.getByText(CONFLICTO_RF011.mensaje)).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Programar de todas formas' })).not.toBeInTheDocument()
  })

  it('el botón Cancelar siempre está presente, incluso con bloqueo duro', () => {
    render(
      <ModalCruce
        bloqueResumen={BLOQUE_RESUMEN}
        conflictos={[CONFLICTO_RF011]}
        onCancelar={vi.fn()}
        onForzar={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })
})
