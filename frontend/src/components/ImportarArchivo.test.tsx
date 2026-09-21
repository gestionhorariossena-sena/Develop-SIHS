import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportarArchivo, type ColumnaImportar } from './ImportarArchivo'

const COLUMNAS: ColumnaImportar[] = [
  { clave: 'codigo', encabezado: 'codigo' },
  { clave: 'nombre', encabezado: 'nombre' },
]

function archivoCsv(texto: string) {
  return new File([texto], 'archivo.csv', { type: 'text/csv' })
}

describe('ImportarArchivo', () => {
  it('parsea el CSV y muestra una previsualización antes de importar nada', async () => {
    const onImportarFila = vi.fn()
    const usuario = userEvent.setup()
    render(<ImportarArchivo columnas={COLUMNAS} onImportarFila={onImportarFila} onCerrar={() => {}} />)

    await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv('codigo,nombre\nA1,Ana\nB2,Beto'))

    expect(await screen.findByText(/Se encontraron/)).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('Beto')).toBeInTheDocument()
    expect(onImportarFila).not.toHaveBeenCalled()
  })

  it('avisa si faltan columnas requeridas y no muestra previsualización', async () => {
    const usuario = userEvent.setup()
    render(<ImportarArchivo columnas={COLUMNAS} onImportarFila={vi.fn()} onCerrar={() => {}} />)

    await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv('codigo\nA1'))

    expect(await screen.findByText(/le faltan estas columnas: nombre/)).toBeInTheDocument()
    expect(screen.queryByText(/Se encontraron/)).not.toBeInTheDocument()
  })

  it('avisa si el archivo no tiene filas', async () => {
    const usuario = userEvent.setup()
    render(<ImportarArchivo columnas={COLUMNAS} onImportarFila={vi.fn()} onCerrar={() => {}} />)

    await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv('codigo,nombre'))

    expect(await screen.findByText('El archivo no tiene filas para importar.')).toBeInTheDocument()
  })

  it('al confirmar, importa fila por fila y reporta éxito/error de cada una sin detenerse ante un fallo', async () => {
    const onImportarFila = vi.fn(async (fila: Record<string, string>) => {
      if (fila.codigo === 'B2') throw new Error('Ya existe.')
    })
    const onTerminado = vi.fn()
    const usuario = userEvent.setup()
    render(<ImportarArchivo columnas={COLUMNAS} onImportarFila={onImportarFila} onTerminado={onTerminado} onCerrar={() => {}} />)

    await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv('codigo,nombre\nA1,Ana\nB2,Beto'))
    await screen.findByText(/Se encontraron/)

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 2 filas' }))

    expect(await screen.findByText(/A1: creada/)).toBeInTheDocument()
    expect(await screen.findByText(/B2: Ya existe\./)).toBeInTheDocument()
    expect(onImportarFila).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(onTerminado).toHaveBeenCalledTimes(1))
  })

  it('el botón "Cerrar" llama a onCerrar', async () => {
    const onCerrar = vi.fn()
    const usuario = userEvent.setup()
    render(<ImportarArchivo columnas={COLUMNAS} onImportarFila={vi.fn()} onCerrar={onCerrar} />)

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
