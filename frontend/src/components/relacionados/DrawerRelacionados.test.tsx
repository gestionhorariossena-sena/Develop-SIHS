import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrawerRelacionados, SeccionDrawer } from './DrawerRelacionados'

describe('DrawerRelacionados', () => {
  it('muestra iniciales, título, subtítulo, etiquetas y el contenido de las secciones', () => {
    render(
      <DrawerRelacionados
        iniciales="EG"
        titulo="Erick Granados"
        subtitulo="erick@example.com"
        etiquetas={['Planta', 'Análisis de datos']}
        onCerrar={vi.fn()}
      >
        <SeccionDrawer titulo="Fichas asignadas">
          <p>3068356</p>
        </SeccionDrawer>
      </DrawerRelacionados>,
    )

    expect(screen.getByRole('dialog', { name: 'Erick Granados' })).toBeInTheDocument()
    expect(screen.getByText('EG')).toBeInTheDocument()
    expect(screen.getByText('erick@example.com')).toBeInTheDocument()
    expect(screen.getByText('Planta')).toBeInTheDocument()
    expect(screen.getByText('Análisis de datos')).toBeInTheDocument()
    expect(screen.getByText('Fichas asignadas')).toBeInTheDocument()
    expect(screen.getByText('3068356')).toBeInTheDocument()
  })

  it('sin etiquetas ni subtítulo, no revienta y solo muestra título e iniciales', () => {
    render(
      <DrawerRelacionados iniciales="FB" titulo="Ficha 3228973 B" onCerrar={vi.fn()}>
        <p>Detalle</p>
      </DrawerRelacionados>,
    )

    expect(screen.getByRole('dialog', { name: 'Ficha 3228973 B' })).toBeInTheDocument()
    expect(screen.getByText('FB')).toBeInTheDocument()
    expect(screen.getByText('Detalle')).toBeInTheDocument()
  })

  it('clic en "Cerrar" llama a onCerrar', async () => {
    const onCerrar = vi.fn()
    const usuario = userEvent.setup()
    render(
      <DrawerRelacionados iniciales="EG" titulo="Erick Granados" onCerrar={onCerrar}>
        <p>Detalle</p>
      </DrawerRelacionados>,
    )

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('clic en el fondo llama a onCerrar, clic dentro del panel no', async () => {
    const onCerrar = vi.fn()
    const usuario = userEvent.setup()
    render(
      <DrawerRelacionados iniciales="EG" titulo="Erick Granados" onCerrar={onCerrar}>
        <p>Detalle</p>
      </DrawerRelacionados>,
    )

    await usuario.click(screen.getByText('Detalle'))
    expect(onCerrar).not.toHaveBeenCalled()

    const fondo = screen.getByRole('dialog').parentElement as HTMLElement
    await usuario.click(fondo)
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('Escape llama a onCerrar', async () => {
    const onCerrar = vi.fn()
    const usuario = userEvent.setup()
    render(
      <DrawerRelacionados iniciales="EG" titulo="Erick Granados" onCerrar={onCerrar}>
        <p>Detalle</p>
      </DrawerRelacionados>,
    )

    await usuario.keyboard('{Escape}')

    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
