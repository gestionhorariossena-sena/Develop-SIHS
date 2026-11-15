import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { HorariosCompletos } from '../../../src/pages/HorariosCompletos'
import type { Ambiente, CargaSemanal, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../../../src/types/api'

const FICHA: Ficha = {
  idFicha: 1,
  codigoFicha: '3228973 B',
  idPrograma: 1,
  idTrimestre: 1,
  idSede: null,
  sede: null,
  programa: { idPrograma: 1, codigoPrograma: 'ADSO', nombrePrograma: 'Análisis y Desarrollo de Software', nivelFormacion: 'Tecnólogo', activo: true, idCoordinacion: 1 },
  trimestre: { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' },
  aprendicesTotales: 30,
  jornadas: ['Mañana'],
}

const INSTRUCTOR: Usuario = {
  idUsuario: 'u1',
  nombre: 'Erick Granados',
  email: 'erick@example.com',
  estado: 'activo',
  fechaRegistro: '2026-01-01',
  tipoContrato: 'Planta',
  roles: [{ idRol: 1, nombre: 'Instructor' }],
  especialidades: [],
  debeCambiarClave: false,
}

const AMBIENTE: Ambiente = { idAmbiente: 1, numeroAmbiente: 101, nombreAmbiente: 'Ambiente 101', tipoAmbiente: 'regular', estadoAmbiente: 'disponible', idSede: 1 }
const SEDE: Sede = { idSede: 1, nombreSede: 'Sede principal', direccion: null, tipoSede: 'principal' }
const TRIMESTRE: Trimestre = { idTrimestre: 1, nombre: 'Trimestre 1', fechaInicio: '2026-01-01', fechaFin: '2026-03-31', estado: 'activo' }
const DIAS: DiaSemana[] = [{ idDia: 1, nombreDia: 'Lunes' }, { idDia: 2, nombreDia: 'Martes' }]
const CARGA_SEMANAL: CargaSemanal = { idUsuario: 'u1', tipoContrato: 'Planta', horasAsignadas: 10, horasMaximas: 40 }

const HORARIO: Horario = {
  idHorario: 7, horaInicio: '06:15:00', horaFin: '09:00:00', idJornada: 1, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u1', idFicha: 1, idResultado: 1, dias: [1], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Erick Granados', fichaCodigo: '3228973 B', ambienteNombre: 'Ambiente 101',
  resultadoCodigo: 'CPL18', resultadoDescripcion: 'Gestión de inventarios',
}

const OTRO_HORARIO: Horario = {
  idHorario: 8, horaInicio: '12:00:00', horaFin: '15:00:00', idJornada: 2, idTrimestre: 1,
  idAmbiente: 1, idInstructor: 'u2', idFicha: 1, idResultado: 1, dias: [2], fechaCreacion: '2026-01-01T00:00:00Z', fechaModificacion: '2026-01-01T00:00:00Z', activo: true, publicado: true,
  instructorNombre: 'Fredy Ardila', fichaCodigo: '9999999', ambienteNombre: 'Taller Industrial',
  resultadoCodigo: 'RA-2', resultadoDescripcion: null,
}

const apiGetMock = vi.fn()
const apiPatchMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  ApiError: class ApiError extends Error {},
}))

function mockeaBase(horarios: Horario[] = [HORARIO]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/horarios/') return Promise.resolve(horarios)
    if (path === '/fichas/') return Promise.resolve([FICHA])
    if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
    if (path === '/ambientes') return Promise.resolve([AMBIENTE])
    if (path === '/sedes') return Promise.resolve([SEDE])
    if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
    if (path === '/dias-semana/') return Promise.resolve(DIAS)
    if (path === '/usuarios/u1/carga-semanal') return Promise.resolve(CARGA_SEMANAL)
    return Promise.reject(new Error('no mockeado en este test'))
  })
}

describe('HorariosCompletos', () => {
  it('carga los horarios desde el backend y los muestra en la tabla', async () => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />)

    expect(await screen.findByText('3228973 B')).toBeInTheDocument()
    expect(apiGetMock).toHaveBeenCalledWith('/horarios/')
    expect(screen.getByText('1 de 1 horarios')).toBeInTheDocument()
  })

  it('mantiene las entradas Lista, Calendario y Conflictos sin abrir un drawer', async () => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lista' })).toHaveAttribute('href', '/horarios/completos')
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', '/calendario?vista=calendario')
    expect(screen.getByRole('link', { name: 'Conflictos' })).toHaveAttribute('href', '/horarios/auditoria?vista=conflictos')
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
  })

  it('el buscador filtra por ficha, programa, instructor o ambiente', async () => {
    mockeaBase([HORARIO, OTRO_HORARIO])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.type(screen.getByLabelText('Buscar'), 'Taller')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
  })

  it('filtra por jornada y por trimestre', async () => {
    mockeaBase([HORARIO, OTRO_HORARIO])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('Erick Granados')
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Jornada'), 'Tarde')

    expect(screen.queryByText('Erick Granados')).not.toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Jornada'), 'Todas')
    await usuario.click(screen.getByRole('button', { name: 'Más filtros' }))
    await usuario.selectOptions(screen.getByLabelText('Período académico'), 'Trimestre 1')

    expect(screen.getByText('Erick Granados')).toBeInTheDocument()
    expect(screen.getByText('Fredy Ardila')).toBeInTheDocument()
  })

  it('sincroniza filtros, página y drawer con la URL', async () => {
    mockeaBase([HORARIO, OTRO_HORARIO])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?q=Erick&jornada=manana&pagina=2'])
    expect(await screen.findByText('Erick Granados')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', expect.stringContaining('q=Erick'))
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', expect.stringContaining('idHorario=7'))
  })

  it('clic en una fila abre el DrawerHorario a la derecha sin retirar la tabla', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])

    const drawer = await screen.findByRole('dialog', { name: 'Horario #7' })
    expect(drawer).toHaveClass('fixed', 'right-0', 'top-0', 'h-screen', 'max-w-[460px]')
    expect(within(drawer).getByText('Bloque #7 · Ficha 3228973 B')).toBeInTheDocument()
    expect(within(drawer).getByRole('tab', { name: 'Información', selected: true })).toBeInTheDocument()
    expect(within(drawer).getByText('Competencia')).toBeInTheDocument()
    expect(within(drawer).getByText('Resultado de aprendizaje (RAP)')).toBeInTheDocument()
    expect(within(drawer).getByText('Carga semanal')).toBeInTheDocument()
    expect(within(drawer).getByText(/CPL18 · Gestión de inventarios/)).toBeInTheDocument()
    expect(within(drawer).getByText('Horario semanal')).toBeInTheDocument()

    expect(await within(drawer).findByText('10h / 40h')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
  })

  it('muestra el motivo del error al despublicar en lugar de ignorar el fallo', async () => {
    mockeaBase()
    apiPatchMock.mockRejectedValueOnce(new Error('El servidor rechazó el cambio de publicación.'))
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    await usuario.click(screen.getByRole('tab', { name: 'Publicación' }))
    await usuario.click(await screen.findByRole('button', { name: 'Despublicar' }))
    expect(apiPatchMock).toHaveBeenCalledWith('/horarios/7/estado', { publicado: false })
    expect(await screen.findByText('No se pudo cambiar la publicación. Intenta de nuevo.')).toBeInTheDocument()
    expect(screen.getAllByText('Publicado').length).toBeGreaterThan(0)
  })

  it('permite expandir un horario con el teclado y anuncia su estado', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    const boton = await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' })

    boton.focus()
    await usuario.keyboard('{Enter}')

    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()
    expect(boton).toHaveAttribute('aria-expanded', 'true')
  })

  it('la pestaña Relaciones enlaza las perspectivas de ficha, instructor y ambiente', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])
    await screen.findByRole('dialog', { name: 'Horario #7' })
    await usuario.click(screen.getByRole('tab', { name: 'Relaciones' }))

    expect(screen.getByRole('link', { name: 'Ver horario por ficha →' })).toHaveAttribute('href', '/vista-fichas?id=1')
    expect(screen.getByRole('link', { name: 'Ver horario por instructor →' })).toHaveAttribute('href', '/vista-instructores?id=u1')
    expect(screen.getByRole('link', { name: 'Ver horario por ambiente →' })).toHaveAttribute('href', '/vista-ambientes?id=1')
    expect(screen.getByText('No se pudo consultar la validación de cruces.')).toBeInTheDocument()
  })

  it('muestra "Publicado" y permite despublicar un horario individual', async () => {
    mockeaBase()
    apiPatchMock.mockResolvedValue({ ...HORARIO, publicado: false })
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])
    expect((await screen.findAllByText('Publicado')).length).toBeGreaterThan(0)

    await usuario.click(screen.getByRole('tab', { name: 'Publicación' }))
    await usuario.click(screen.getByRole('button', { name: 'Despublicar' }))

    expect(apiPatchMock).toHaveBeenCalledWith('/horarios/7/estado', { publicado: false })
    expect((await screen.findAllByText('Borrador')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Publicar ahora' })).toBeInTheDocument()
  })

  it('cierra el drawer con X y con Escape', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])
    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(screen.getAllByText('3228973 B')[0])
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await usuario.click(screen.getAllByText('3228973 B')[0])
    const drawer = await screen.findByRole('dialog', { name: 'Horario #7' })
    await usuario.click(drawer.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('las pestañas muestran su contenido y el footer conserva las acciones principales', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))

    await usuario.click(screen.getByRole('tab', { name: 'Relaciones' }))
    expect(screen.getByRole('link', { name: 'Gestionar publicación' })).toHaveAttribute('href', '/horarios/publicaciones-programadas?idHorario=7')
    await usuario.click(screen.getByRole('tab', { name: 'Acciones' }))
    expect(screen.getAllByRole('link', { name: 'Editar bloque' })[0]).toHaveAttribute('href', '/horarios/historial?id=7')
  })

  it('con ?id= en la URL, abre el drawer directo (deep link desde Calendario general)', async () => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?id=7'])

    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()
  })

  it('muestra el error del backend si la carga falla', async () => {
    apiGetMock.mockImplementation((path: string) =>
      path === '/horarios/' ? Promise.reject(new Error('falló')) : Promise.reject(new Error('no mockeado')),
    )
    renderConProviders(<HorariosCompletos />)

    await waitFor(() => {
      expect(screen.getByText('No se pudo cargar el listado de horarios.')).toBeInTheDocument()
    })
  })

  it('advierte el catálogo fallido sin ocultar la tabla', async () => {
    mockeaBase()
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO])
      if (path === '/fichas/') return Promise.reject(new Error('falló fichas'))
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<HorariosCompletos />)
    expect(await screen.findByText('3228973 B')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('no se pudieron cargar: fichas')
  })

  it('un horario creado por el Asistente (franja propia, no la institucional) sí aparece en el grid y con jornada correcta', async () => {
    // Regresión 2026-09-14: el grid del drawer y la columna Jornada de la
    // tabla solo reconocían las 2 franjas institucionales fijas
    // (06:15/09:00 para Mañana) por coincidencia EXACTA de hora --
    // cualquier horario creado por el Asistente de Programación (franjas
    // propias del generador CP-SAT: 07:00/09:00/11:00/...) se mostraba
    // "Sin definir" en Jornada y desaparecía por completo del grid
    // semanal, aunque la fila de la tabla sí lo mostrara.
    const horarioDelAsistente: Horario = { ...HORARIO, horaInicio: '07:00:00', horaFin: '09:00:00' }
    mockeaBase([horarioDelAsistente])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    // Columna Jornada de la tabla: ya no "Sin definir".
    expect(screen.getAllByText('Mañana').length).toBeGreaterThan(0)
    expect(screen.queryByText('Sin definir')).not.toBeInTheDocument()

    // Grid del drawer expandido: el bloque sí aparece (antes se descartaba
    // en silencio -- "Gestión de inventarios" solo aparecería una vez, en
    // la tarjeta de detalle, si el grid lo hubiera perdido).
    await usuario.click(screen.getAllByText('3228973 B')[0])
    const drawer = await screen.findByRole('dialog', { name: 'Horario #7' })
    expect(within(drawer).getAllByText('Gestión de inventarios').length).toBeGreaterThan(1)
  })
})
