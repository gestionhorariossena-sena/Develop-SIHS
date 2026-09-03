import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Ambientes } from './Ambientes'
import type { Ambiente, Coordinacion, DiaSemana, Ficha, Horario, Sede } from '../types/api'

const AMBIENTES: Ambiente[] = [
  { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Sala 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 },
  { idAmbiente: 2, numeroAmbiente: 102, nombreAmbiente: 'Sala 102', tipoAmbiente: 'especial', estadoAmbiente: 'mantenimiento', idSede: 1 },
]

const SEDES: Sede[] = [{ idSede: 1, nombreSede: 'Sede principal', direccion: null, tipoSede: 'principal' }]

const COORDINACIONES: Coordinacion[] = [
  { idCoordinacion: 1, nombreCoordinacion: 'Teleinformática' },
  { idCoordinacion: 2, nombreCoordinacion: 'Logística' },
]

const FICHAS: Ficha[] = [
  {
    idFicha: 1,
    codigoFicha: '3228973 B',
    idPrograma: 1,
    idTrimestre: 1,
    idSede: null,
    sede: null,
    programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'ADSO', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
    trimestre: { idTrimestre: 1, nombre: 'Trimestre 3', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
    aprendicesTotales: 30,
    jornadas: ['Mañana'],
  },
  {
    idFicha: 2,
    codigoFicha: '2758431',
    idPrograma: 2,
    idTrimestre: 1,
    idSede: null,
    sede: null,
    programa: { idPrograma: 2, codigoPrograma: 'COCI', nombrePrograma: 'Cocina', nivelFormacion: 'Técnico', activo: true, idCoordinacion: 2 },
    trimestre: { idTrimestre: 1, nombre: 'Trimestre 3', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
    aprendicesTotales: 20,
    jornadas: ['Tarde'],
  },
]

const HORARIO_A: Horario = {
  idHorario: 1, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 100, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Sala 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const HORARIO_B: Horario = {
  idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 2, idInstructor: 'u2', idFicha: 2, idResultado: 200, dias: [2], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Fredy Ardila', fichaCodigo: '2758431', ambienteNombre: 'Sala 102',
  resultadoCodigo: 'RA-2', resultadoDescripcion: null,
}

const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }, { idDia: 2, nombreDia: 'Martes' }]

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  ApiError: class ApiError extends Error {},
}))

/** AppShell también llama a apiGet('/usuarios/me') al montar — el mock
 * tiene que distinguir por ruta o revienta leyendo `.roles` de lo que sea
 * que devuelva /ambientes. */
function mockeaBase(ambientes: Ambiente[] = AMBIENTES, todosLosHorarios: Horario[] = [HORARIO_A, HORARIO_B]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/ambientes') return Promise.resolve(ambientes)
    if (path === '/sedes') return Promise.resolve(SEDES)
    if (path === '/coordinaciones/') return Promise.resolve(COORDINACIONES)
    if (path === '/fichas/') return Promise.resolve(FICHAS)
    if (path === '/horarios/') return Promise.resolve(todosLosHorarios)
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    if (path === '/ambientes/1/horarios') return Promise.resolve([HORARIO_A])
    if (path === '/ambientes/2/horarios') return Promise.resolve([HORARIO_B])
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Ambientes', () => {
  it('carga los ambientes desde el backend y los muestra en la tabla', async () => {
    mockeaBase()
    renderConProviders(<Ambientes />)

    expect(await screen.findByText('Sala 101')).toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/ambientes')
    expect(screen.getByText('2 de 2 ambientes')).toBeInTheDocument()
  })

  it('el buscador filtra por nombre o número', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.type(screen.getByLabelText('Buscar'), '102')

    expect(screen.queryByText('Sala 101')).not.toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
  })

  it('clic en una fila abre el drawer con número, tipo y estado', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))

    const panel = screen.getByRole('dialog', { name: 'Sala 101' })
    expect(within(panel).getByText('101')).toBeInTheDocument()
    expect(within(panel).getAllByText('regular').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('disponible').length).toBeGreaterThan(0)
  })

  it('botón "Cerrar" del drawer oculta el panel de detalle', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape cierra el drawer', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el grid semanal con los horarios reales del ambiente', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))

    const panel = screen.getByRole('dialog', { name: 'Sala 101' })
    expect(await within(panel).findByText('Horario semanal')).toBeInTheDocument()
    expect(within(panel).getByText('CPL18')).toBeInTheDocument()
    expect(within(panel).getAllByText('Erick Granados').length).toBeGreaterThan(0)
  })

  it('muestra fichas/instructores/temas derivados de los horarios del ambiente', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))

    const panel = screen.getByRole('dialog', { name: 'Sala 101' })
    expect(await within(panel).findByText('Fichas asignadas')).toBeInTheDocument()
    expect(within(panel).getByText('Instructores')).toBeInTheDocument()
    expect(within(panel).getByText('Temas que dicta')).toBeInTheDocument()
    expect(within(panel).getAllByText('Lunes 06:15-09:00').length).toBeGreaterThan(0)
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/ambientes' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Ambientes />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el listado de ambientes.')).toBeInTheDocument()
    })
  })

  it('con ?id= en la URL, abre el drawer de ese ambiente directo (deep link desde Vista por ambientes)', async () => {
    mockeaBase()
    renderConProviders(<Ambientes />, ['/ambientes?id=1'])

    expect(await screen.findByRole('dialog', { name: 'Sala 101' })).toBeInTheDocument()
  })

  it('el drawer tiene un link "Ver horario completo" hacia Vista por ambientes', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')

    await usuario.click(screen.getByText('Sala 101'))

    const panel = screen.getByRole('dialog', { name: 'Sala 101' })
    const link = await within(panel).findByRole('link', { name: 'Ver horario completo →' })
    expect(link).toHaveAttribute('href', '/vista-ambientes?id=1')
  })

  it('con más de 10 ambientes, pagina y "Siguiente" avanza a la página 2', async () => {
    const muchos: Ambiente[] = Array.from({ length: 12 }, (_, i) => ({
      ...AMBIENTES[0],
      idAmbiente: i + 1,
      nombreAmbiente: `Sala ${String(i + 1).padStart(2, '0')}`,
    }))
    mockeaBase(muchos, [])
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 01')

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.queryByText('Sala 11')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByText('Sala 11')).toBeInTheDocument()
    expect(screen.queryByText('Sala 01')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('filtra la lista de ambientes por ficha, coordinación, estado e instructor', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<Ambientes />)
    await screen.findByText('Sala 101')
    expect(screen.getByText('Sala 102')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Ficha'), '3228973 B')
    expect(screen.getByText('Sala 101')).toBeInTheDocument()
    expect(screen.queryByText('Sala 102')).not.toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Ficha'), 'Todas')

    await usuario.selectOptions(screen.getByLabelText('Coordinación'), 'Logística')
    expect(screen.queryByText('Sala 101')).not.toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Coordinación'), 'Todas')

    await usuario.selectOptions(screen.getByLabelText('Estado'), 'Mantenimiento')
    expect(screen.queryByText('Sala 101')).not.toBeInTheDocument()
    expect(screen.getByText('Sala 102')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'Todos')

    await usuario.selectOptions(screen.getByLabelText('Instructor'), 'Erick Granados')
    expect(screen.getByText('Sala 101')).toBeInTheDocument()
    expect(screen.queryByText('Sala 102')).not.toBeInTheDocument()
  })

  describe('SCRUM-89: carga masiva de ambientes por CSV', () => {
    function archivoCsv(texto: string) {
      return new File([texto], 'ambientes.csv', { type: 'text/csv' })
    }

    beforeEach(() => {
      apiPostMock.mockClear()
    })

    it('sube un CSV, previsualiza y al confirmar crea cada ambiente resolviendo la sede a su id', async () => {
      mockeaBase()
      apiPostMock.mockResolvedValue({})
      const usuario = userEvent.setup()
      renderConProviders(<Ambientes />)
      await screen.findByText('Sala 101')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      const csv = 'numeroAmbiente,nombreAmbiente,tipoAmbiente,sede,estadoAmbiente\n201,Sala 201,regular,Sede principal,'
      await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv(csv))

      expect(await screen.findByText(/Se encontraron/)).toBeInTheDocument()
      await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 1 fila' }))

      await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/ambientes', {
        numeroAmbiente: 201,
        nombreAmbiente: 'Sala 201',
        tipoAmbiente: 'regular',
        estadoAmbiente: 'disponible',
        idSede: 1,
      }))
      // La etiqueta de cada fila del reporte usa la primera columna
      // declarada (numeroAmbiente), no el nombre.
      expect(await screen.findByText(/Fila 2 — 201: creada/)).toBeInTheDocument()
    })

    it('si tipoAmbiente no es válido, reporta el error de esa fila sin llamar al backend', async () => {
      mockeaBase()
      const usuario = userEvent.setup()
      renderConProviders(<Ambientes />)
      await screen.findByText('Sala 101')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      const csv = 'numeroAmbiente,nombreAmbiente,tipoAmbiente,sede,estadoAmbiente\n201,Sala 201,invalido,Sede principal,'
      await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv(csv))
      await screen.findByText(/Se encontraron/)

      await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 1 fila' }))

      expect(await screen.findByText(/tipoAmbiente debe ser "regular" o "especial"/)).toBeInTheDocument()
      expect(apiPostMock).not.toHaveBeenCalled()
    })

    it('si la sede del CSV no existe, reporta el error de esa fila', async () => {
      mockeaBase()
      const usuario = userEvent.setup()
      renderConProviders(<Ambientes />)
      await screen.findByText('Sala 101')

      await usuario.click(screen.getByRole('button', { name: 'Cargar archivo' }))
      const csv = 'numeroAmbiente,nombreAmbiente,tipoAmbiente,sede,estadoAmbiente\n201,Sala 201,regular,Sede fantasma,'
      await usuario.upload(screen.getByLabelText('Seleccionar archivo CSV'), archivoCsv(csv))
      await screen.findByText(/Se encontraron/)

      await usuario.click(screen.getByRole('button', { name: 'Confirmar importación de 1 fila' }))

      expect(await screen.findByText(/No existe la sede "Sede fantasma"\./)).toBeInTheDocument()
    })
  })
})
