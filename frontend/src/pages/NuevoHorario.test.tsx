import { describe, expect, it, vi } from 'vitest'
import { useEffect, useMemo } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuevoHorario } from './NuevoHorario'
import { renderConProviders } from '../test/renderConProviders'

const mocks = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number
    detail: unknown

    constructor(status: number, message: string, detail?: unknown) {
      super(message)
      this.status = status
      this.detail = detail
    }
  }

  return { apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn(), ApiError: ApiErrorMock }
})

const FICHA = {
  idFicha: 1,
  codigoFicha: '3228973',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, numeroTrimestre: 1, nombreTrimestre: 'Trimestre 1' },
  sede: null,
  aprendicesTotales: 25,
  jornadas: ['Mañana'],
}

vi.mock('../services/api', () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPut: mocks.apiPut,
  apiDelete: mocks.apiDelete,
  ApiError: mocks.ApiError,
}))

vi.mock('../components/horario/HorarioEditor', () => ({
  HorarioEditor: ({
    onCambiarEstado,
    bloquesIniciales,
    gridInicial,
    fichaFijada,
  }: {
    onCambiarEstado: (estado: unknown) => void
    bloquesIniciales: Array<Record<string, unknown>>
    gridInicial: (string | null)[][]
    fichaFijada?: { idFicha: number }
  }) => {
    const estado = useMemo(() => {
      const grid = gridInicial.map((fila) => [...fila])
      const idBloqueNuevo = fichaFijada ? 'bloque-nuevo' : 'bloque-1'
      grid[0][0] = idBloqueNuevo
      const bloqueNuevo = {
        id: idBloqueNuevo,
        tematica: 'Programación',
        instructor: 'Ana Ríos',
        ficha: '3228973',
        ambiente: 'Ambiente 101',
        idResultado: 9,
        idInstructor: '11111111-1111-1111-1111-111111111111',
        idFicha: 1,
        idTrimestre: 1,
        idAmbiente: 1,
      }
      return {
        bloques: fichaFijada ? [...bloquesIniciales, bloqueNuevo] : [bloqueNuevo],
        grid,
      }
    }, [bloquesIniciales, fichaFijada, gridInicial])
    useEffect(() => onCambiarEstado(estado), [onCambiarEstado, estado])
    return <div>Editor de horario</div>
  },
}))

function configurarCatalogos() {
  mocks.apiGet.mockImplementation((ruta: string) => {
    if (ruta === '/fichas/') return Promise.resolve([FICHA])
    if (ruta === '/usuarios/me') {
      return Promise.resolve({
        idUsuario: '22222222-2222-2222-2222-222222222222',
        nombre: 'Coordinadora',
        email: 'coordinadora@example.com',
        roles: [{ idRol: 1, nombre: 'Coordinador' }],
      })
    }
    if (ruta === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
    if (ruta === '/dias-semana/') return Promise.resolve([{ idDia: 1, nombreDia: 'Lunes' }])
    return Promise.resolve([])
  })
}

async function seleccionarFicha(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(await screen.findByRole('button', { name: /Ficha 3228973/ }))
  await screen.findByText('Editor de horario')
}

describe('NuevoHorario', () => {
  it('al pulsar Programar de todas formas reintenta el guardado con forzar=true', async () => {
    configurarCatalogos()
    mocks.apiPost
      .mockRejectedValueOnce(new mocks.ApiError(409, 'Conflicto', {
        ok: false,
        puedeGuardar: false,
        mensaje: 'La programación presenta conflictos.',
        conflictos: [{
          tipo: 'cruce_ambiente',
          mensaje: 'El ambiente ya está ocupado en ese horario.',
          idHorarioExistente: 100,
          idAmbiente: 1,
        }],
        resumen: { totalCruces: 1, tipos: ['cruce_ambiente'] },
      }))
      .mockResolvedValueOnce({})
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />)

    await seleccionarFicha(usuario)
    await usuario.click(await screen.findByRole('checkbox', { name: 'Guardar como borrador' }))
    await usuario.click(await screen.findByRole('button', { name: 'Guardar y publicar' }))
    await screen.findByRole('button', { name: 'Programar de todas formas' })

    await usuario.click(screen.getByRole('button', { name: 'Programar de todas formas' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(
        '/horarios/',
        expect.objectContaining({ forzar: true, publicado: true }),
      )
    })
    expect(mocks.apiPost).toHaveBeenNthCalledWith(
      2,
      '/horarios/',
      expect.objectContaining({
        idAmbiente: 1,
        idFicha: 1,
        idInstructor: '11111111-1111-1111-1111-111111111111',
        forzar: true,
        publicado: true,
      }),
    )
  })

  it('en modo edición (?editar=), precarga ficha/aprendices/fechas y el título cambia a "Modificar horario"', async () => {
    configurarCatalogos()
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/horarios-guardados/10') {
        return Promise.resolve({
          idHorarioGuardado: 10,
          idUsuario: '22222222-2222-2222-2222-222222222222',
          creadorNombre: 'Coordinadora',
          ficha: 'FICHA-EDIT',
          aprendices: '25',
          horasTrimestre: '30',
          fechaInicio: '2026-01-15',
          fechaFin: '2026-04-15',
          bloques: [{ id: 'bloque-1', tematica: 'Programación', instructor: 'Ana Ríos', ficha: '3228973', ambiente: 'Ambiente 101' }],
          grid: [['bloque-1']],
          idsHorarios: [55],
          asignaciones: [{
            idHorario: 55, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1,
            idTrimestre: 1, idAmbiente: 1, idInstructor: '11111111-1111-1111-1111-111111111111',
            idFicha: 1, idResultado: 9, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z',
            fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: false,
            instructorNombre: 'Ana Ríos', fichaCodigo: '3228973', ambienteNombre: 'Ambiente 101',
            resultadoCodigo: 'RA-9', resultadoDescripcion: 'Resultado 9',
          }],
          fechaCreacion: '2026-01-01T00:00:00Z',
        })
      }
      if (ruta === '/usuarios/me') {
        return Promise.resolve({
          idUsuario: '22222222-2222-2222-2222-222222222222',
          nombre: 'Coordinadora',
          email: 'coordinadora@example.com',
          roles: [{ idRol: 1, nombre: 'Coordinador' }],
        })
      }
      if (ruta === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
      if (ruta === '/dias-semana/') return Promise.resolve([{ idDia: 1, nombreDia: 'Lunes' }])
      return Promise.resolve([])
    })

    renderConProviders(<NuevoHorario />, ['/horarios/nuevo?editar=10'])

    expect(await screen.findByText('Modificar horario')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ficha (referencia del formulario)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Aprendices en formación a la fecha')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Horas asignadas del período académico')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('guarda clases nuevas como borradores privados por defecto', async () => {
    configurarCatalogos()
    mocks.apiPost.mockImplementation((ruta: string) => {
      if (ruta === '/horarios/validar') return Promise.resolve({ ok: true, puedeGuardar: true, mensaje: '', conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      if (ruta === '/horarios/') return Promise.resolve({ idHorario: 999 })
      return Promise.resolve({})
    })
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />)
    await seleccionarFicha(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/horarios/', expect.objectContaining({ idFicha: 1, publicado: false }))
    })
    expect(mocks.apiPost).toHaveBeenCalledWith(
      '/horarios-guardados/',
      expect.objectContaining({ ficha: '3228973', idsHorarios: [999] }),
    )
    const snapshotCreado = mocks.apiPost.mock.calls.find(([ruta]) => ruta === '/horarios-guardados/')?.[1]
    expect(snapshotCreado).not.toHaveProperty('aprendices')
    expect(snapshotCreado).not.toHaveProperty('horasTrimestre')
    expect(snapshotCreado).not.toHaveProperty('fechaInicio')
    expect(snapshotCreado).not.toHaveProperty('fechaFin')
    expect(mocks.apiDelete).not.toHaveBeenCalled()
  })

  it('al desmarcar Guardar como borrador publica explícitamente', async () => {
    configurarCatalogos()
    mocks.apiPost.mockImplementation((ruta: string) => {
      if (ruta === '/horarios/validar') return Promise.resolve({ ok: true, puedeGuardar: true, mensaje: '', conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      if (ruta === '/horarios/') return Promise.resolve({ idHorario: 1000 })
      return Promise.resolve({})
    })
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />)
    await seleccionarFicha(usuario)
    await usuario.click(await screen.findByRole('checkbox', { name: 'Guardar como borrador' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar y publicar' }))

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/horarios/', expect.objectContaining({ publicado: true }))
    })
  })

  it('edita mediante reemplazo atómico y nunca borra desde el frontend', async () => {
    configurarCatalogos()
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/horarios-guardados/10') return Promise.resolve({
        idHorarioGuardado: 10, idUsuario: '22222222-2222-2222-2222-222222222222',
        creadorNombre: 'Coordinadora', ficha: 'FICHA-EDIT', aprendices: '25', horasTrimestre: '30',
        fechaInicio: '2026-01-15', fechaFin: '2026-04-15',
        bloques: [{ id: 'bloque-1', tematica: 'Programación', instructor: 'Ana Ríos', ficha: '3228973', ambiente: 'Ambiente 101' }],
        grid: [['bloque-1']], idsHorarios: [55],
        asignaciones: [{
          idHorario: 55, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1,
          idTrimestre: 1, idAmbiente: 1, idInstructor: '11111111-1111-1111-1111-111111111111',
          idFicha: 1, idResultado: 9, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z',
          fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: false,
          instructorNombre: 'Ana Ríos', fichaCodigo: '3228973', ambienteNombre: 'Ambiente 101',
          resultadoCodigo: 'RA-9', resultadoDescripcion: 'Resultado 9',
        }], fechaCreacion: '2026-01-01T00:00:00Z',
      })

      if (ruta === '/usuarios/me') return Promise.resolve({
        idUsuario: '22222222-2222-2222-2222-222222222222', nombre: 'Coordinadora',
        email: 'coordinadora@example.com', roles: [{ idRol: 1, nombre: 'Coordinador' }],
      })
      if (ruta === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
      if (ruta === '/dias-semana/') return Promise.resolve([{ idDia: 1, nombreDia: 'Lunes' }])
      return Promise.resolve([])
    })
    const usuario = userEvent.setup()
    mocks.apiPost.mockClear()
    mocks.apiDelete.mockClear()

    renderConProviders(<NuevoHorario />, ['/horarios/nuevo?editar=10'])
    expect(await screen.findByText('Modificar horario')).toBeInTheDocument()
    mocks.apiPut.mockResolvedValue({})
    const boton = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(boton).toBeEnabled()
    await usuario.click(boton)
    await waitFor(() => expect(mocks.apiPut).toHaveBeenCalledWith(
      '/horarios-guardados/10/reemplazar',
      expect.objectContaining({
        ficha: 'FICHA-EDIT',
        aprendices: '25',
        horasTrimestre: '30',
        fechaInicio: '2026-01-15',
        fechaFin: '2026-04-15',
        horarios: [expect.objectContaining({ idHorarioOriginal: 55 })],
      }),
    ))
    expect(mocks.apiDelete).not.toHaveBeenCalled()
    expect(mocks.apiPost).not.toHaveBeenCalled()
  })

  it('carga la ficha elegida y guarda solo las asignaciones nuevas, no vuelve a crear las existentes', async () => {
    configurarCatalogos()
    const existente = {
      idHorario: 55,
      horaInicio: '09:00:00',
      horaFin: '12:00:00',
      idJornada: 1,
      idTrimestre: 1,
      idAmbiente: 1,
      idInstructor: '11111111-1111-1111-1111-111111111111',
      idFicha: 1,
      idResultado: 9,
      dias: [2],
      fechaCreacion: '2026-01-01T00:00:00Z',
      fechaModificacion: '2026-01-01T00:00:00Z',
      activo: true,
      publicado: true,
      instructorNombre: 'Ana Ríos',
      fichaCodigo: '3228973',
      ambienteNombre: 'Ambiente 101',
      resultadoCodigo: 'RA-9',
      resultadoDescripcion: 'Resultado 9',
    }
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/fichas/') return Promise.resolve([FICHA])
      if (ruta === '/fichas/1/horarios') return Promise.resolve([existente])
      if (ruta === '/usuarios/me') return Promise.resolve({
        idUsuario: '22222222-2222-2222-2222-222222222222',
        nombre: 'Coordinadora',
        email: 'coordinadora@example.com',
        roles: [{ idRol: 1, nombre: 'Coordinador' }],
      })
      if (ruta === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
      if (ruta === '/dias-semana/') return Promise.resolve([
        { idDia: 1, nombreDia: 'Lunes' },
        { idDia: 2, nombreDia: 'Martes' },
      ])
      return Promise.resolve([])
    })
    mocks.apiPost.mockImplementation((ruta: string) => {
      if (ruta === '/horarios/validar') return Promise.resolve({ ok: true, puedeGuardar: true, mensaje: '', conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      if (ruta === '/horarios/') return Promise.resolve({ idHorario: 999 })
      return Promise.resolve({})
    })
    const usuario = userEvent.setup()

    renderConProviders(<NuevoHorario />)
    await seleccionarFicha(usuario)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar borrador' }))

    await waitFor(() => {
      expect(mocks.apiGet).toHaveBeenCalledWith('/fichas/1/horarios')
      expect(mocks.apiPost).toHaveBeenCalledWith('/horarios/', expect.objectContaining({ idFicha: 1 }))
    })
    expect(mocks.apiPost.mock.calls.filter(([ruta]) => ruta === '/horarios/')).toHaveLength(1)
    expect(mocks.apiPost).toHaveBeenCalledWith('/horarios-guardados/', expect.objectContaining({ idsHorarios: [999] }))
  })

  it('si falla la carga del horario a modificar, muestra el error', async () => {
    configurarCatalogos()
    mocks.apiGet.mockImplementation((ruta: string) => {
      if (ruta === '/horarios-guardados/10') return Promise.reject(new mocks.ApiError(404, 'Horario guardado no encontrado'))
      if (ruta === '/usuarios/me') {
        return Promise.resolve({
          idUsuario: '22222222-2222-2222-2222-222222222222',
          nombre: 'Coordinadora',
          email: 'coordinadora@example.com',
          roles: [{ idRol: 1, nombre: 'Coordinador' }],
        })
      }
      if (ruta === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
      if (ruta === '/dias-semana/') return Promise.resolve([{ idDia: 1, nombreDia: 'Lunes' }])
      return Promise.resolve([])
    })

    renderConProviders(<NuevoHorario />, ['/horarios/nuevo?editar=10'])

    expect(await screen.findByText('Horario guardado no encontrado')).toBeInTheDocument()
  })
})
