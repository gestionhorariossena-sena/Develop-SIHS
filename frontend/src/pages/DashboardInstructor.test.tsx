import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { DashboardInstructor } from './DashboardInstructor'

const { apiGetMock } = vi.hoisted(() => ({ apiGetMock: vi.fn() }))

vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {
    status = 500
  },
}))

describe('DashboardInstructor', () => {
  it('mantiene visible el acceso a pasar asistencia aunque hoy no tenga clases', () => {
    apiGetMock.mockRejectedValue(new Error('Sin datos para esta prueba'))
    renderConProviders(<DashboardInstructor />)

    const contenido = within(screen.getByRole('main'))
    expect(contenido.getByRole('link', { name: /Pasar asistencia/i })).toHaveAttribute('href', '/asistencia')
  })
})
