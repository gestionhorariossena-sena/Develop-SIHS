import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { renderConProviders } from '../../helpers/renderConProviders'
import { CrearHorario } from '../../../src/pages/CrearHorario'

const apiGetMock = vi.fn()

vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

vi.mock('../../../src/components/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

function mockearDatos() {
  apiGetMock.mockImplementation((ruta: string) => {
    if (ruta === '/horarios-guardados/') {
      return Promise.resolve([{
        idHorarioGuardado: 12,
        idUsuario: 'u1',
        creadorNombre: 'Coordinación',
        programaNombre: 'Programa real',
        ficha: '3228973',
        aprendices: null,
        horasTrimestre: null,
        fechaInicio: null,
        fechaFin: null,
        bloques: [],
        grid: [],
        idsHorarios: [101],
        asignaciones: [{ idHorario: 101, publicado: false }],
        fechaCreacion: '2026-11-14T12:00:00Z',
      }])
    }
    if (ruta === '/horarios/auditoria-cruces') {
      return Promise.resolve({ conflictos: [{ idHorario: 101 }], resumen: { totalCruces: 1, tipos: ['cruce_instructor'] } })
    }
    return Promise.reject(new Error(`Ruta no esperada: ${ruta}`))
  })
}

describe('CrearHorario', () => {
  it('enlaza los dos métodos con los flujos existentes y prioriza el borrador con conflicto', async () => {
    mockearDatos()
    renderConProviders(<CrearHorario />)

    expect((await screen.findAllByText('3228973')).length).toBeGreaterThan(0)
    expect(screen.getByText('Tiene conflictos por resolver')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear manualmente' })).toHaveAttribute('href', '/horarios/nuevo')
    expect(screen.getByRole('link', { name: 'Importar archivo' })).toHaveAttribute('href', '/horarios/asistente-ia')
    expect(screen.getAllByRole('link', { name: 'Resolver conflicto' })[0]).toHaveAttribute('href', '/horarios/nuevo?editar=12')
  })

  it('abre la navegación de programación desde el botón hamburguesa en móvil', async () => {
    mockearDatos()
    const usuario = userEvent.setup()
    renderConProviders(<CrearHorario />)

    const boton = screen.getByRole('button', { name: 'Abrir navegación de programación' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(boton)

    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Navegación de programación')).toBeInTheDocument()
  })
})
