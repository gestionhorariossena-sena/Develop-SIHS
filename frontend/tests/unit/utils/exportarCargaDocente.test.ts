import { describe, expect, it, vi } from 'vitest'
import { construirCsvCargaDocente, descargarCsvCargaDocente, horasDeInstructor } from '../../../src/utils/exportarCargaDocente'
import type { Horario, Usuario } from '../../../src/types/api'

const instructor = {
  idUsuario: 'u1', nombre: 'María Gómez', email: 'maria@example.com',
  numeroDocumento: '102030', tipoContrato: 'planta', horasContratadasSemana: 32,
  especialidades: [{ idEspecialidad: 1, nombre: 'Programación', descripcion: null, activo: true }],
  estado: 'activo',
} as Usuario
const bloques = [
  { idInstructor: 'u1', horaInicio: '07:00:00', horaFin: '09:30:00', dias: [1, 3] },
  { idInstructor: 'u2', horaInicio: '08:00:00', horaFin: '10:00:00', dias: [1] },
] as Horario[]

describe('exportar carga docente', () => {
  it('calcula horas de las sesiones asignadas sin sumar las de otros instructores', () => {
    expect(horasDeInstructor('u1', bloques)).toBe(5)
    expect(horasDeInstructor('u2', bloques)).toBe(2)
  })

  it('crea CSV UTF-8 compatible con Excel y cantidades correctas', () => {
    const csv = construirCsvCargaDocente([instructor], bloques)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"María Gómez"')
    expect(csv).toContain('"5";"32";"27";"16%"')
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('escapa celdas con comillas y neutraliza fórmulas de hojas de cálculo', () => {
    const csv = construirCsvCargaDocente([{ ...instructor, nombre: '=2+2', email: 'maria"prueba@example.com' }], [])
    expect(csv).toContain('"\'=2+2"')
    expect(csv).toContain('"maria""prueba@example.com"')
  })

  it('inicia la descarga sin exponer ni enviar información al servidor', () => {
    const createObjectURL = vi.fn(() => 'blob:instructores')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    descargarCsvCargaDocente([instructor], bloques)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:instructores')
    click.mockRestore()
  })
})
