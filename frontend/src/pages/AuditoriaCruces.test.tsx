import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderConProviders } from '../test/renderConProviders'
import { AuditoriaCruces } from './AuditoriaCruces'
import type { AuditoriaCrucesResponse } from '../types/api'

const RESPUESTA: AuditoriaCrucesResponse = {
  conflictos: [
    { tipo: 'cruce_ambiente', mensaje: 'El ambiente ya está ocupado en ese horario: A choca con B.', idHorario: 100, idHorarioExistente: 101 },
    { tipo: 'cruce_ambiente', mensaje: 'El ambiente ya está ocupado en ese horario: A choca con C.', idHorario: 100, idHorarioExistente: 102 },
    { tipo: 'cruce_ambiente', mensaje: 'El ambiente ya está ocupado en ese horario: B choca con C.', idHorario: 101, idHorarioExistente: 102 },
    { tipo: 'ficha_trimestre', mensaje: 'La ficha FICHA-009 pertenece al trimestre 2; no puede programarse en el trimestre 1.', idHorario: 200 },
  ],
  resumen: { totalCruces: 4, tipos: ['cruce_ambiente', 'ficha_trimestre'], porTipo: { cruce_ambiente: 3, ficha_trimestre: 1 }, horariosAfectados: 4 },
}

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

describe('AuditoriaCruces', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((path: string) => {
      if (path.startsWith('/horarios/auditoria-cruces')) return Promise.resolve(RESPUESTA)
      if (path === '/trimestres/' || path === '/sedes' || path === '/notificaciones/') return Promise.resolve([])
      return Promise.reject(new Error(`no mockeado: ${path}`))
    })
  })

  it('muestra todos los pares de un triple cruce y los horarios afectados', async () => {
    renderConProviders(<AuditoriaCruces />)

    expect(await screen.findByText('El ambiente ya está ocupado en ese horario: B choca con C.')).toBeInTheDocument()
    expect(screen.getByText(/4 conflictos críticos activos/)).toHaveTextContent('4 horarios afectados')
  })

  it('titula y cuenta el conflicto de ficha fuera de su trimestre', async () => {
    renderConProviders(<AuditoriaCruces />)

    expect(await screen.findByText(/La ficha FICHA-009 pertenece al trimestre 2/)).toBeInTheDocument()
    // Título en la tarjeta y en el panel de tipología.
    expect(screen.getAllByText('Ficha fuera de su trimestre')).toHaveLength(2)
    expect(screen.getByText('7 reglas')).toBeInTheDocument()
  })
})
