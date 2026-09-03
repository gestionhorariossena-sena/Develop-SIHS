import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Fichas } from './Fichas'
import type { DiaSemana, Ficha, Horario } from '../types/api'

const FICHAS: Ficha[] = [
  {
    idFicha: 1,
    codigoFicha: '3228973 B',
    idPrograma: 1,
    idTrimestre: 1,
    idSede: null,
    sede: null,
    programa: {
      idPrograma: 1,
      codigoPrograma: 'ADSO',
      nombrePrograma: 'Análisis y Desarrollo de Software',
      nivelFormacion: 'Tecnólogo',
      activo: true,
      idCoordinacion: 1,
    },
    trimestre: { idTrimestre: 1, nombre: 'Trimestre 3', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
    aprendicesTotales: 30,
    jornadas: ['Mañana'],
  },
  {
    idFicha: 2,
    codigoFicha: '2758431',
    idPrograma: 2,
    idTrimestre: 2,
    idSede: null,
    sede: null,
    programa: {
      idPrograma: 2,
      codigoPrograma: 'COCI',
      nombrePrograma: 'Técnico en Cocina',
      nivelFormacion: 'Técnico',
      activo: true,
      idCoordinacion: 2,
    },
    trimestre: { idTrimestre: 2, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'planeado' },
    aprendicesTotales: 25,
    jornadas: ['Noche'],
  },
]

const { apiGetMock, apiPostMock, apiPutMock } = vi.hoisted(() => ({ apiGetMock: vi.fn(), apiPostMock: vi.fn(), apiPutMock: vi.fn() }))
const PERFIL_ADMIN = { idUsuario: 'admin', nombre: 'Administrador', email: 'admin@test.com', estado: 'activo', fechaRegistro: '2026-01-01', roles: [{ idRol: 1, nombre: 'Administrador' }], especialidades: [] }
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  ApiError: class ApiError extends Error {},
}))

/** AppShell también llama a apiGet('/usuarios/me') al montar — el mock
 * tiene que distinguir por ruta o revienta leyendo `.roles` de lo que sea
 * que devuelva /fichas/. */
function mockeaFichasYPerfil(fichas: unknown) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/fichas/') return typeof fichas === 'function' ? fichas() : Promise.resolve(fichas)
    if (path === '/usuarios/me') return Promise.resolve(PERFIL_ADMIN)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

const HORARIOS: Horario[] = [
  {
    idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
    idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
    instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
    resultadoCodigo: 'RA-9', resultadoDescripcion: null,
  },
]

const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }]

function mockeaFichasConHorarios(fichas: unknown, todosLosHorarios: Horario[] = HORARIOS) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/fichas/') return Promise.resolve(fichas)
    if (path === '/fichas/1/horarios') return Promise.resolve(HORARIOS)
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    if (path === '/horarios/') return Promise.resolve(todosLosHorarios)
    if (path === '/usuarios/me') return Promise.resolve(PERFIL_ADMIN)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Fichas', () => {
  it('permite crear y editar desde la fila con el payload del schema y refresca la lista', async () => {
    mockeaFichasYPerfil(FICHAS)
    apiPostMock.mockResolvedValue({ ...FICHAS[0], idFicha: 3, codigoFicha: 'Nueva' })
    apiPutMock.mockResolvedValue({ ...FICHAS[0], codigoFicha: 'Actualizada' })
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    await usuario.clear(screen.getByLabelText('Código de ficha'))
    await usuario.type(screen.getByLabelText('Código de ficha'), 'Actualizada')
    await usuario.click(screen.getByRole('button', { name: 'Guardar ficha' }))

    await waitFor(() => expect(apiPutMock).toHaveBeenCalledWith('/fichas/2', expect.objectContaining({ codigoFicha: 'Actualizada', fechaInicioLectiva: null })))
    expect(apiGetMock.mock.calls.filter(([path]) => path === '/fichas/').length).toBe(2)
  })

  it('carga las fichas desde el backend y las muestra en la tabla', async () => {
    mockeaFichasYPerfil(FICHAS)
    renderConProviders(<Fichas />)

    expect(await screen.findByText('3228973 B')).toBeInTheDocument()
    expect(screen.getByText('2758431')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/fichas/')
    expect(screen.getByText('2 de 2 fichas')).toBeInTheDocument()
  })

  it('el buscador filtra por código o programa', async () => {
    mockeaFichasYPerfil(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.type(screen.getByLabelText('Buscar'), 'Cocina')

    expect(screen.queryByText('3228973 B')).not.toBeInTheDocument()
    expect(screen.getByText('2758431')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 fichas')).toBeInTheDocument()
  })

  it('clic en una fila abre el drawer con programa, jornadas y aprendices', async () => {
    mockeaFichasYPerfil(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    const panel = screen.getByRole('dialog', { name: '3228973 B' })
    expect(within(panel).getByText('Análisis y Desarrollo de Software')).toBeInTheDocument()
    expect(within(panel).getByText('Mañana')).toBeInTheDocument()
    expect(within(panel).getByText('30')).toBeInTheDocument()
  })

  it('botón "Cerrar" del drawer oculta el panel de detalle', async () => {
    mockeaFichasYPerfil(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape cierra el drawer', async () => {
    mockeaFichasYPerfil(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el grid semanal con los horarios reales de la ficha', async () => {
    mockeaFichasConHorarios(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    const panel = screen.getByRole('dialog', { name: '3228973 B' })
    expect(await within(panel).findByText('Horario semanal')).toBeInTheDocument()
    expect(within(panel).getByText('RA-9')).toBeInTheDocument()
    // "Erick Granados" y "Ambiente 101" aparecen dos veces: en la celda del
    // grid y en las secciones de instructores/ambientes (SCRUM-68).
    expect(within(panel).getAllByText('Erick Granados').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('Ambiente 101').length).toBeGreaterThan(0)
  })

  it('muestra instructores/temas/ambientes derivados de los horarios de la ficha', async () => {
    mockeaFichasConHorarios(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    const panel = screen.getByRole('dialog', { name: '3228973 B' })
    expect(await within(panel).findByText('Instructores')).toBeInTheDocument()
    expect(within(panel).getByText('Temas que dicta')).toBeInTheDocument()
    expect(within(panel).getByText('Ambientes asignados')).toBeInTheDocument()
    expect(within(panel).getByText('Lunes 06:15-09:00')).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/fichas/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Fichas />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el listado de fichas.')).toBeInTheDocument()
    })
  })

  it('con ?id= en la URL, abre el drawer de esa ficha directo (deep link desde Vista por fichas)', async () => {
    mockeaFichasYPerfil(FICHAS)
    renderConProviders(<Fichas />, ['/fichas?id=1'])

    expect(await screen.findByRole('dialog', { name: '3228973 B' })).toBeInTheDocument()
  })

  it('el drawer tiene un link "Ver horario completo" hacia Vista por fichas', async () => {
    mockeaFichasConHorarios(FICHAS)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getByText('3228973 B'))

    const panel = screen.getByRole('dialog', { name: '3228973 B' })
    const link = await within(panel).findByRole('link', { name: 'Ver horario completo →' })
    expect(link).toHaveAttribute('href', '/vista-fichas?id=1')
  })

  it('con más de 10 fichas, pagina y "Siguiente" avanza a la página 2', async () => {
    const muchas: Ficha[] = Array.from({ length: 12 }, (_, i) => ({
      ...FICHAS[0],
      idFicha: i + 1,
      codigoFicha: `FICHA-${String(i + 1).padStart(2, '0')}`,
    }))
    mockeaFichasYPerfil(muchas)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('FICHA-01')

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.queryByText('FICHA-11')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByText('FICHA-11')).toBeInTheDocument()
    expect(screen.queryByText('FICHA-01')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('filtra la lista de fichas por instructor usando todos los horarios del sistema', async () => {
    const todosLosHorarios: Horario[] = [
      ...HORARIOS,
      {
        idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
        idAmbiente: 2, idInstructor: 'u2', idFicha: 2, idResultado: 2, dias: [2], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
        instructorNombre: 'Fredy Ardila', fichaCodigo: '2758431', ambienteNombre: 'Ambiente 202',
        resultadoCodigo: 'RA-2', resultadoDescripcion: null,
      },
    ]
    mockeaFichasConHorarios(FICHAS, todosLosHorarios)
    const usuario = userEvent.setup()
    renderConProviders(<Fichas />)
    await screen.findByText('3228973 B')
    expect(screen.getByText('2758431')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Instructor'), 'Erick Granados')

    expect(screen.getByText('3228973 B')).toBeInTheDocument()
    expect(screen.queryByText('2758431')).not.toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Instructor'), 'Fredy Ardila')

    expect(screen.queryByText('3228973 B')).not.toBeInTheDocument()
    expect(screen.getByText('2758431')).toBeInTheDocument()
  })

  describe('SCRUM-89: carga masiva de fichas por CSV', () => {
    function mockeaFichasConCatalogo() {
      apiGetMock.mockImplementation((path: string) => {
        if (path === '/fichas/') return Promise.resolve(FICHAS)
        if (path === '/programas/') return Promise.resolve([FICHAS[0].programa, FICHAS[1].programa])
        if (path === '/trimestres/') return Promise.resolve([FICHAS[0].trimestre, FICHAS[1].trimestre])
        if (path === '/sedes') return Promise.resolve([])
        return Promise.reject(new Error('no mockeado en este test'))
      })
    }

    function archivoCsv(texto: string) {
      return new File([texto], 'fichas.csv', { type: 'text/csv' })
    }

    beforeEach(() => {
      apiPostMock.mockClear()
    })

    it('el botón "Cargar archivo" abre y cierra el panel de importación', async () => {
      mockeaFichasYPerfil(FICHAS)
      const usuario = userEvent.setup()
      renderConProviders(<Fichas />)
      await screen.findByText('3228973 B')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      expect(screen.getByText(/Columnas esperadas/)).toBeInTheDocument()

      await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
      expect(screen.queryByText(/Columnas esperadas/)).not.toBeInTheDocument()
    })

    it('sube un CSV, previsualiza las filas y al confirmar crea cada ficha resolviendo programa/trimestre a sus ids', async () => {
      mockeaFichasConCatalogo()
      apiPostMock.mockResolvedValue({})
      const usuario = userEvent.setup()
      renderConProviders(<Fichas />)
      await screen.findByText('3228973 B')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      const csv = 'codigoFicha,codigoPrograma,trimestre,sede\nFICHA-NUEVA,ADSO,Trimestre 3,'
      await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv(csv))

      expect(await screen.findByText(/Se encontraron/)).toBeInTheDocument()
      expect(screen.getByText('FICHA-NUEVA')).toBeInTheDocument()

      await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 1 fila' }))

      await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/fichas/', {
        codigoFicha: 'FICHA-NUEVA',
        idPrograma: 1,
        idTrimestre: 1,
        idSede: null,
      }))
      expect(await screen.findByText(/FICHA-NUEVA: creada/)).toBeInTheDocument()
    })

    it('si el CSV referencia un programa que no existe, reporta el error en esa fila sin romper las demás', async () => {
      mockeaFichasConCatalogo()
      apiPostMock.mockResolvedValue({})
      const usuario = userEvent.setup()
      renderConProviders(<Fichas />)
      await screen.findByText('3228973 B')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      const csv = 'codigoFicha,codigoPrograma,trimestre,sede\nFICHA-A,NOEXISTE,Trimestre 3,\nFICHA-B,ADSO,Trimestre 3,'
      await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv(csv))
      await screen.findByText(/Se encontraron/)

      await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 2 filas' }))

      expect(await screen.findByText(/FICHA-A: No existe el programa "NOEXISTE"\./)).toBeInTheDocument()
      expect(await screen.findByText(/FICHA-B: creada/)).toBeInTheDocument()
      expect(apiPostMock).toHaveBeenCalledTimes(1)
    })

    it('si al CSV le falta una columna requerida, avisa antes de mostrar la previsualización', async () => {
      mockeaFichasConCatalogo()
      const usuario = userEvent.setup()
      renderConProviders(<Fichas />)
      await screen.findByText('3228973 B')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv('codigoFicha,codigoPrograma\nFICHA-X,ADSO'))

      expect(await screen.findByText(/le faltan estas columnas: trimestre/)).toBeInTheDocument()
      expect(screen.queryByText(/Se encontraron/)).not.toBeInTheDocument()
    })
  })
})
