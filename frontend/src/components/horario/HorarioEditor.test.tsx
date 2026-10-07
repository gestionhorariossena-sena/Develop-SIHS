import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HorarioEditor } from './HorarioEditor'
import { gridVacio } from '../../pages/horario/useHorarioState'
import type { BloqueClase } from '../../pages/horario/tipos'

// Coinciden con la celda de Lunes/Martes/Miércoles, jornada Mañana, 6:15-9:00,
// esté vacía ("...vacía") o con un bloque activo ("Asignar bloque activo a...").
const CELDA_LUNES = /Lunes, 6:15 a\.m/
const CELDA_MARTES = /Martes, 6:15 a\.m/
const CELDA_MIERCOLES = /Miércoles, 6:15 a\.m/

function renderVacio() {
  return render(<HorarioEditor bloquesIniciales={[]} gridInicial={gridVacio()} />)
}

async function crearBloqueDesdeCelda(usuario: ReturnType<typeof userEvent.setup>, celda: RegExp) {
  await usuario.click(screen.getByRole('button', { name: celda }))
  await usuario.type(screen.getByLabelText('Temática'), 'Programación')
  await usuario.type(screen.getByLabelText('Instructor'), 'Ana Ríos')
  await usuario.type(screen.getByLabelText('Ficha'), '3228973')
  await usuario.type(screen.getByLabelText('Ambiente'), 'Lab 402')
  await usuario.click(screen.getByRole('button', { name: 'Guardar bloque' }))
}

describe('HorarioEditor', () => {
  it('sin bloques todavía, el panel invita a crear el primero', () => {
    renderVacio()
    expect(screen.getByText(/Todavía no hay bloques/i)).toBeInTheDocument()
  })

  it('clic en una celda vacía sin bloque activo abre el modal y, al guardar, la celda queda asignada y el bloque aparece en el panel', async () => {
    const usuario = userEvent.setup()
    renderVacio()

    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()

    expect(within(screen.getByRole('list')).getByText('Programación')).toBeInTheDocument()
  })

  it('el bloque creado queda activo automáticamente, listo para asignarlo a otra celda con un clic', async () => {
    const usuario = userEvent.setup()
    renderVacio()
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)

    await usuario.click(screen.getByRole('button', { name: CELDA_MARTES }))

    expect(
      screen.getByRole('button', { name: 'Martes, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()
  })

  it('Shift+clic rellena todo el rango entre la última celda tocada y la nueva con el bloque activo', async () => {
    const usuario = userEvent.setup()
    renderVacio()
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)

    await usuario.keyboard('{Shift>}')
    await usuario.click(screen.getByRole('button', { name: CELDA_MIERCOLES }))
    await usuario.keyboard('{/Shift}')

    expect(
      screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Martes, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Miércoles, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()
  })

  it('editar un bloque desde una celda ya asignada actualiza todas las celdas que lo usan', async () => {
    const usuario = userEvent.setup()
    renderVacio()
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)
    await usuario.click(screen.getByRole('button', { name: CELDA_MARTES })) // bloque activo -> asigna directo

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }))
    await usuario.click(
      screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m: Programación' }),
    )

    const campoTematica = screen.getByLabelText('Temática')
    await usuario.clear(campoTematica)
    await usuario.type(campoTematica, 'Programación avanzada')
    await usuario.click(screen.getByRole('button', { name: 'Guardar bloque' }))

    expect(
      screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m: Programación avanzada' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Martes, 6:15 a.m – 9:00 a.m: Programación avanzada' }),
    ).toBeInTheDocument()
  })

  it('quitar una celda individual la deja vacía sin afectar otras celdas con el mismo bloque', async () => {
    const usuario = userEvent.setup()
    renderVacio()
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)
    await usuario.click(screen.getByRole('button', { name: CELDA_MARTES }))

    const celdaLunes = screen.getByRole('button', {
      name: 'Lunes, 6:15 a.m – 9:00 a.m: Programación',
    })
    const contenedorLunes = celdaLunes.closest('div') as HTMLElement
    await usuario.click(within(contenedorLunes).getByRole('button', { name: /Quitar/i }))

    // El bloque sigue activo (nunca se desactivó), así que la celda vaciada
    // se etiqueta como "asignar", no como "vacía" a secas.
    expect(screen.getByRole('button', { name: CELDA_LUNES })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Martes, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()
  })

  it('eliminar un bloque pide confirmación — cancelar no borra nada', async () => {
    const usuario = userEvent.setup()
    renderVacio()
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)

    await usuario.click(screen.getByRole('button', { name: /Eliminar Programación/i }))
    expect(screen.getByRole('button', { name: /Confirmar eliminar Programación/i })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Cancelar eliminar Programación/i }))

    expect(
      screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m: Programación' }),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText('Programación')).toBeInTheDocument()
  })

  it('eliminar un bloque desde el panel lo quita de todas las celdas que lo tenían', async () => {
    const usuario = userEvent.setup()
    renderVacio()
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)
    await usuario.click(screen.getByRole('button', { name: CELDA_MARTES }))

    await usuario.click(screen.getByRole('button', { name: /Eliminar Programación/i }))
    await usuario.click(screen.getByRole('button', { name: /Confirmar eliminar Programación/i }))

    expect(screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m, vacía' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Martes, 6:15 a.m – 9:00 a.m, vacía' })).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay bloques/i)).toBeInTheDocument()
  })

  it('parte de un grid ya poblado (ej. plantilla precargada) y lo muestra correctamente', () => {
    const bloques: BloqueClase[] = [
      { id: 'b1', tematica: 'Comunicación', instructor: 'Claudia', ficha: 'F1', ambiente: 'Sala 1' },
    ]
    const grid = gridVacio()
    grid[0][0] = 'b1'

    render(<HorarioEditor bloquesIniciales={bloques} gridInicial={grid} />)

    expect(
      screen.getByRole('button', { name: 'Lunes, 6:15 a.m – 9:00 a.m: Comunicación' }),
    ).toBeInTheDocument()
  })

  it('muestra las asignaciones existentes en solo lectura y no las ofrece para edición o eliminación', () => {
    const bloques: BloqueClase[] = [
      {
        id: 'horario-55',
        tematica: 'Comunicación',
        instructor: 'Claudia',
        ficha: 'F1',
        ambiente: 'Sala 1',
        idHorarioOriginal: 55,
      },
    ]
    const grid = gridVacio()
    grid[0][0] = 'horario-55'

    render(<HorarioEditor bloquesIniciales={bloques} gridInicial={grid} />)

    expect(screen.getByLabelText('Lunes, 6:15 a.m – 9:00 a.m: Comunicación')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar Comunicación/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar Comunicación/i })).not.toBeInTheDocument()
  })

  it('al rellenar un rango conserva intactas las asignaciones ya guardadas', async () => {
    const usuario = userEvent.setup()
    const bloques: BloqueClase[] = [
      {
        id: 'horario-55',
        tematica: 'Comunicación',
        instructor: 'Claudia',
        ficha: 'F1',
        ambiente: 'Sala 1',
        idHorarioOriginal: 55,
      },
    ]
    const grid = gridVacio()
    grid[1][1] = 'horario-55'

    render(<HorarioEditor bloquesIniciales={bloques} gridInicial={grid} />)
    await crearBloqueDesdeCelda(usuario, CELDA_LUNES)
    await usuario.keyboard('{Shift>}')
    await usuario.click(screen.getByRole('button', { name: /Jueves, 9:00 a\.m/ }))
    await usuario.keyboard('{/Shift}')

    expect(
      screen.getByLabelText('Martes, 9:00 a.m – 12:00 p.m: Comunicación'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Jueves, 9:00 a.m – 12:00 p.m: Programación' }),
    ).toBeInTheDocument()
  })
})
