import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../test/renderConProviders'
import { Instructores } from './Instructores'
import type { CargaSemanal, DiaSemana, Horario, Usuario } from '../types/api'

const INSTRUCTOR: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  tipoContrato: 'Planta',
  horasContratadasSemana: 32,
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [{ idEspecialidad: 1, nombre: 'Análisis · Verificación', descripcion: null, activo: true }],
}

const COORDINADOR: Usuario = {
  idUsuario: 'u2',
  nombre: 'Ana Martínez',
  email: 'ana@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  roles: [{ idRol: 2, nombre: 'Coordinador' }],
  especialidades: [],
}

const USUARIOS: Usuario[] = [INSTRUCTOR, COORDINADOR]

const DIAS: DiaSemana[] = [
  { idDia: 1, nombreDia: 'Lunes' },
  { idDia: 3, nombreDia: 'Miércoles' },
]

const CARGA: CargaSemanal = { idUsuario: 'u1', tipoContrato: 'Planta', horasAsignadas: 18, horasMaximas: 32 }

const HORARIOS: Horario[] = [
  {
    idHorario: 1, horaInicio: '12:00:00', horaFin: '15:00:00', idJornada: 2, idTrimestre: 1,
    idAmbiente: 1, idInstructor: 'u1', idFicha: 10, idResultado: 100, dias: [1, 3], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true,
    instructorNombre: 'Erick Granados', fichaCodigo: '3068356', ambienteNombre: 'Ambiente 306',
    resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
  },
]

const apiGetMock = vi.fn()
vi.mock('../services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  ApiError: class ApiError extends Error {},
}))

/** AppShell también llama a apiGet('/usuarios/me') al montar — el mock
 * tiene que distinguir por ruta o revienta leyendo `.roles` de lo que sea
 * que devuelva /usuarios/. */
function mockeaUsuariosYPerfil(usuarios: unknown, todosLosHorarios: Horario[] = HORARIOS) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/usuarios/') return Promise.resolve(usuarios)
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    if (path === '/usuarios/u1/carga-semanal') return Promise.resolve(CARGA)
    if (path === '/usuarios/u1/horarios') return Promise.resolve(HORARIOS)
    if (path === '/horarios/') return Promise.resolve(todosLosHorarios)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('Instructores', () => {
  it('carga los usuarios y solo muestra los que tienen rol Instructor', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    renderConProviders(<Instructores />)

    expect(await screen.findByText('Erick Granados')).toBeInTheDocument()
    expect(screen.queryByText('Ana Martínez')).not.toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/usuarios/')
    expect(screen.getByText('1 de 1 instructores')).toBeInTheDocument()
  })

  it('muestra especialidad y tipo de contrato del instructor', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    const fila = screen.getByText('Erick Granados').closest('tr') as HTMLElement
    expect(within(fila).getByText('Análisis · Verificación')).toBeInTheDocument()
    expect(within(fila).getByText('Planta')).toBeInTheDocument()
    expect(within(fila).getByText('32 h')).toBeInTheDocument()
  })

  it('el buscador filtra por nombre, correo o especialidad', async () => {
    const otroInstructor: Usuario = { ...INSTRUCTOR, idUsuario: 'u3', nombre: 'Fredy Ardila', especialidades: [{ idEspecialidad: 2, nombre: 'Bases de datos', descripcion: null, activo: true }] }
    mockeaUsuariosYPerfil([INSTRUCTOR, otroInstructor])
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.type(screen.getByLabelText('Buscar'), 'Fredy')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 instructores')).toBeInTheDocument()
  })

  it('clic en una fila abre el drawer con carga semanal, fichas, temas y ambientes', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    const panel = screen.getByRole('dialog', { name: 'Erick Granados' })
    expect(within(panel).getByText('Análisis · Verificación')).toBeInTheDocument()
    expect(within(panel).getByText('Planta')).toBeInTheDocument()

    await waitFor(() => expect(within(panel).getByText('18h / 32h')).toBeInTheDocument())
    expect(within(panel).getByText('3068356')).toBeInTheDocument()
    expect(within(panel).getByText('Lunes y Miércoles 12:00-15:00')).toBeInTheDocument()
    expect(within(panel).getByText('CPL18 — Gestión de inventarios')).toBeInTheDocument()
    // "Ambiente 306" aparece dos veces: en la sección de ambientes y en la
    // celda del mini-grid (SCRUM-65, GridHorario reusa el mismo texto).
    expect(within(panel).getAllByText('Ambiente 306').length).toBeGreaterThan(0)
  })

  it('muestra el mini-grid semanal con el bloque del instructor', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    const panel = screen.getByRole('dialog', { name: 'Erick Granados' })
    expect(await within(panel).findByText('Horario semanal')).toBeInTheDocument()
    // El bloque de HORARIOS cae en Tarde 12:00-15:00, Lunes y Miércoles —
    // aparece dos veces en el grid (una celda por día).
    expect(within(panel).getAllByText('CPL18').length).toBe(2)

    // Solo la única fila con datos (Tarde 12:00-15:00) — nada de las otras
    // 5 filas institucionales vacías, ni las jornadas Mañana/Noche sin
    // ningún bloque, ni la fila "Receso".
    expect(within(panel).getByText('Jornada Tarde')).toBeInTheDocument()
    expect(within(panel).queryByText('Jornada Mañana')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Jornada Noche')).not.toBeInTheDocument()
    expect(within(panel).queryByText('3:00 p.m')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Receso')).not.toBeInTheDocument()
  })

  it('muestra "sin horario asignado" cuando el instructor no tiene ningún bloque', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/usuarios/') return Promise.resolve(USUARIOS)
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve(CARGA)
      if (path === '/usuarios/u1/horarios') return Promise.resolve([])
      return Promise.reject(new Error('no mockeado en este test'))
    })
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    const panel = screen.getByRole('dialog', { name: 'Erick Granados' })
    expect(await within(panel).findByText('Sin horario asignado en el trimestre actual.')).toBeInTheDocument()
    expect(within(panel).queryByText('Jornada Mañana')).not.toBeInTheDocument()
  })

  it('Escape cierra el drawer', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/usuarios/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<Instructores />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el listado de instructores.')).toBeInTheDocument()
    })
  })

  it('con ?id= en la URL, abre el drawer de ese instructor directo (deep link desde Vista por instructores)', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    renderConProviders(<Instructores />, ['/instructores?id=u1'])

    expect(await screen.findByRole('dialog', { name: 'Erick Granados' })).toBeInTheDocument()
  })

  it('el drawer tiene un link "Ver horario completo" hacia Vista por instructores', async () => {
    mockeaUsuariosYPerfil(USUARIOS)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')

    await usuario.click(screen.getByText('Erick Granados'))

    const panel = screen.getByRole('dialog', { name: 'Erick Granados' })
    const link = await within(panel).findByRole('link', { name: 'Ver horario completo →' })
    expect(link).toHaveAttribute('href', '/vista-instructores?id=u1')
  })

  it('con más de 10 instructores, pagina y "Siguiente" avanza a la página 2', async () => {
    const muchos: Usuario[] = Array.from({ length: 12 }, (_, i) => ({
      ...INSTRUCTOR,
      idUsuario: `u${i + 1}`,
      nombre: `Instructor ${String(i + 1).padStart(2, '0')}`,
    }))
    mockeaUsuariosYPerfil(muchos)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Instructor 01')

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.queryByText('Instructor 11')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByText('Instructor 11')).toBeInTheDocument()
    expect(screen.queryByText('Instructor 01')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('filtra por ficha y por ambiente usando todos los horarios del sistema', async () => {
    const otroInstructor: Usuario = { ...INSTRUCTOR, idUsuario: 'u4', nombre: 'Fredy Ardila' }
    const todosLosHorarios: Horario[] = [
      ...HORARIOS,
      {
        idHorario: 2, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
        idAmbiente: 2, idInstructor: 'u4', idFicha: 20, idResultado: 200, dias: [2], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true,
        instructorNombre: 'Fredy Ardila', fichaCodigo: '9999999', ambienteNombre: 'Ambiente 999',
        resultadoCodigo: 'RA-1', resultadoDescripcion: null,
      },
    ]
    mockeaUsuariosYPerfil([INSTRUCTOR, otroInstructor], todosLosHorarios)
    const usuario = userEvent.setup()
    renderConProviders(<Instructores />)
    await screen.findByText('Erick Granados')
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Ficha'), '3068356')

    expect(screen.getByText('Erick Granados')).toBeInTheDocument()
    expect(screen.queryByText('Fredy Ardila')).not.toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Ficha'), 'Todas')
    await usuario.selectOptions(screen.getByLabelText('Ambiente'), 'Ambiente 999')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
  })
})
