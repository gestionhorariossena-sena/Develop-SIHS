import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EliminacionSegura } from '../../../src/components/EliminacionSegura'
import type { EliminacionSeguraAnalisis } from '../../../src/types/api'

const apiGetMock = vi.fn()
const apiDeleteMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    detail: unknown
    constructor(status: number, message: string, detail?: unknown) {
      super(message)
      this.status = status
      this.detail = detail
    }
  },
}))

const BLOQUEADO: EliminacionSeguraAnalisis = {
  tipo: 'ficha', id: '1',
  dependencias: { horariosPublicados: 3, horariosBorrador: 0, asistencias: 12, vinculosFicha: 20 },
  accion: 'bloqueado',
}
const SIN_HORARIOS: EliminacionSeguraAnalisis = {
  tipo: 'ambiente', id: '1',
  dependencias: { horariosPublicados: 0, horariosBorrador: 0, asistencias: 0, vinculosFicha: 0 },
  accion: 'eliminar_entidad',
}
const SOLO_BORRADORES: EliminacionSeguraAnalisis = {
  tipo: 'instructor', id: 'u1',
  dependencias: { horariosPublicados: 0, horariosBorrador: 2, asistencias: 0, vinculosFicha: 5 },
  accion: 'eliminar_borradores_y_entidad',
}

/**
 * SCRUM-198: "no existe botón destructivo ciego; mensajes describen
 * impacto real". El botón de eliminar nunca borra directo -- primero
 * trae el análisis real del backend (GET /eliminacion-segura/{tipo}/{id})
 * y decide qué mostrar según lo que ese análisis diga, nunca al revés.
 */
describe('EliminacionSegura', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('al hacer clic, analiza primero y nunca elimina directo', async () => {
    apiGetMock.mockResolvedValue(SIN_HORARIOS)
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="ambiente" id={1} nombre="Ambiente 101" onEliminado={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar ambiente Ambiente 101/ }))

    expect(apiGetMock).toHaveBeenCalledWith('/eliminacion-segura/ambiente/1')
    expect(apiDeleteMock).not.toHaveBeenCalled()
  })

  it('cuando el backend bloquea (hay publicados o asistencias), no ofrece ningún botón para eliminar', async () => {
    apiGetMock.mockResolvedValue(BLOQUEADO)
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="ficha" id={1} nombre="3228973 B" onEliminado={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar ficha 3228973 B/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('3 horarios ya publicados')
    expect(screen.getByRole('alert')).toHaveTextContent('12 registros de asistencia')
    expect(screen.queryByRole('button', { name: /Confirmar eliminación/ })).not.toBeInTheDocument()
    expect(apiDeleteMock).not.toHaveBeenCalled()
  })

  it('sin horarios ni vínculos, el mensaje de confirmación describe que no afecta nada más y permite eliminar', async () => {
    apiGetMock.mockResolvedValue(SIN_HORARIOS)
    apiDeleteMock.mockResolvedValue({ ...SIN_HORARIOS, accion: 'eliminado', horariosEliminados: 0 })
    const onEliminado = vi.fn()
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="ambiente" id={1} nombre="Ambiente 101" onEliminado={onEliminado} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar ambiente Ambiente 101/ }))
    const confirmacion = await screen.findByRole('alertdialog')
    expect(confirmacion).toHaveTextContent('No tiene horarios ni vínculos asignados')

    await usuario.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    expect(apiDeleteMock).toHaveBeenCalledWith('/eliminacion-segura/ambiente/1')
    expect(onEliminado).toHaveBeenCalled()
  })

  it('con horarios en borrador, el mensaje avisa que también se eliminarán junto con los vínculos de ficha', async () => {
    apiGetMock.mockResolvedValue(SOLO_BORRADORES)
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="instructor" id="u1" nombre="Erick Granados" onEliminado={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar instructor Erick Granados/ }))

    const confirmacion = await screen.findByRole('alertdialog')
    expect(confirmacion).toHaveTextContent('2 horarios en borrador')
    expect(confirmacion).toHaveTextContent('5 vínculos de ficha')
  })

  it('cancelar la confirmación no elimina nada y vuelve a ofrecer el botón de analizar', async () => {
    apiGetMock.mockResolvedValue(SIN_HORARIOS)
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="ambiente" id={1} nombre="Ambiente 101" onEliminado={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar ambiente Ambiente 101/ }))
    await screen.findByRole('alertdialog')
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(apiDeleteMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Eliminar ambiente Ambiente 101/ })).toBeInTheDocument()
  })

  it('si el DELETE responde 409 porque se bloqueó entre el análisis y la confirmación, muestra el bloqueo real en vez de un error genérico', async () => {
    const { ApiError } = await import('../../../src/services/api')
    apiGetMock.mockResolvedValue(SIN_HORARIOS)
    apiDeleteMock.mockRejectedValue(new ApiError(409, 'Hay un conflicto con los datos actuales.', { ...BLOQUEADO, mensaje: 'No se elimina historial publicado ni asistencias.' }))
    const onEliminado = vi.fn()
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="ambiente" id={1} nombre="Ambiente 101" onEliminado={onEliminado} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar ambiente Ambiente 101/ }))
    await screen.findByRole('alertdialog')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede eliminar')
    expect(onEliminado).not.toHaveBeenCalled()
  })

  it('si el análisis inicial falla por red, muestra el error en vez de quedarse en blanco', async () => {
    const { ApiError } = await import('../../../src/services/api')
    apiGetMock.mockRejectedValue(new ApiError(503, 'No se pudo conectar con el servidor.'))
    const usuario = userEvent.setup()
    render(<EliminacionSegura tipo="ambiente" id={1} nombre="Ambiente 101" onEliminado={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: /Eliminar ambiente Ambiente 101/ }))

    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument()
  })
})
