import { describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderConProviders } from '../../helpers/renderConProviders'
import { HorariosCompletos } from '../../../src/pages/HorariosCompletos'
import type { Ambiente, AuditoriaCrucesResponse, CargaSemanal, DiaSemana, Ficha, Horario, Sede, Trimestre, Usuario } from '../../../src/types/api'

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

// SCRUM-196: segunda ficha/instructor/ambiente, solo para probar que las
// perspectivas por entidad aíslan los bloques de la seleccionada y no los
// mezclan con los de otra (el filtro vive en filtrarHorarios.ts, nunca se
// había verificado a este nivel).
const FICHA_2: Ficha = { ...FICHA, idFicha: 2, codigoFicha: '9999999' }
const INSTRUCTOR_2: Usuario = { ...INSTRUCTOR, idUsuario: 'u2', nombre: 'Fredy Ardila' }
const AMBIENTE_2: Ambiente = { ...AMBIENTE, idAmbiente: 2, nombreAmbiente: 'Ambiente 202' }

const HORARIO_OTRA_FICHA: Horario = { ...HORARIO, idHorario: 10, idFicha: 2, fichaCodigo: '9999999' }
const HORARIO_OTRO_INSTRUCTOR: Horario = { ...HORARIO, idHorario: 11, idInstructor: 'u2', instructorNombre: 'Fredy Ardila' }
const HORARIO_OTRO_AMBIENTE: Horario = { ...HORARIO, idHorario: 12, idAmbiente: 2, ambienteNombre: 'Ambiente 202' }

// SCRUM-197: mismo contexto (ficha 1, instructor u1), otro horario del
// día, todavía sin publicar -- para probar que la perspectiva por entidad
// distingue visualmente lo que no publicado de lo que sí.
const HORARIO_BORRADOR: Horario = {
  ...HORARIO, idHorario: 13, horaInicio: '09:00:00', horaFin: '12:00:00', publicado: false, resultadoCodigo: 'RA-2',
}

const apiGetMock = vi.fn()
vi.mock('../../../src/services/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
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
    if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
    if (path === '/usuarios/u1/carga-semanal') return Promise.resolve(CARGA_SEMANAL)
    if (path === '/resultados-aprendizaje/') return Promise.resolve([{ idResultado: 1, codigo: 'CPL18', descripcion: 'Gestión de inventarios', idCompetencia: 1, idGuia: null, horasAsignadas: null }])
    if (path === '/jornadas/') return Promise.resolve([{ idJornada: 1, nombreJornada: 'Mañana' }])
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

  it('cambia entre Bloques y las tres perspectivas sin perder filtros compartidos ni el drawer en la URL', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?q=Erick&jornada=manana&idTrimestre=1&estado=publicado&idHorario=7'])
    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()

    for (const [perspectiva, etiqueta] of [['ficha', 'Por ficha'], ['instructor', 'Por instructor'], ['ambiente', 'Por ambiente']] as const) {
      await usuario.click(screen.getByRole('button', { name: etiqueta }))
      expect(screen.getByLabelText(new RegExp(`Seleccionar ${perspectiva}`))).toBeInTheDocument()
      const calendario = screen.getByRole('link', { name: 'Calendario' })
      expect(calendario).toHaveAttribute('href', expect.stringContaining(`perspectiva=${perspectiva}`))
      expect(calendario).toHaveAttribute('href', expect.stringContaining('q=Erick'))
      expect(calendario).toHaveAttribute('href', expect.stringContaining('idHorario=7'))
      expect(screen.getByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()
    }

    await usuario.click(screen.getByRole('button', { name: 'Bloques' }))
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('href', expect.stringContaining('q=Erick'))
  })

  it.each([
    ['/horarios/completos?idHorario=7', 'Bloques'],
    ['/horarios/completos?perspectiva=ficha&idFicha=1&idHorario=7', 'Por ficha'],
    ['/horarios/completos?perspectiva=instructor&idInstructor=u1&idHorario=7', 'Por instructor'],
    ['/horarios/completos?perspectiva=ambiente&idAmbiente=1&idHorario=7', 'Por ambiente'],
  ])('abre el drawer desde %s', async (ruta, perspectiva) => {
    mockeaBase()
    renderConProviders(<HorariosCompletos />, [ruta])
    expect(await screen.findByRole('dialog', { name: 'Horario #7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: perspectiva })).toBeInTheDocument()
  })

  it('muestra Conflictos contextuales provenientes de la auditoría real, incluyendo carga y error', async () => {
    let resolverAuditoria: ((respuesta: AuditoriaCrucesResponse) => void) | undefined
    mockeaBase()
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/auditoria-cruces') return new Promise<AuditoriaCrucesResponse>((resolve) => { resolverAuditoria = resolve })
      if (path === '/horarios/') return Promise.resolve([HORARIO])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      return Promise.reject(new Error('no mockeado'))
    })
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=ficha&idFicha=1'])
    expect(await screen.findByText('Cargando Conflictos del contexto…')).toBeInTheDocument()
    resolverAuditoria?.({ conflictos: [{ idHorario: 7, idHorarioExistente: null, tipo: 'cruce_ficha', mensaje: 'Cruce real de ficha', idFicha: 1 }], resumen: { totalCruces: 1, tipos: ['cruce_ficha'] } })
    expect(await screen.findByText('Cruce real de ficha')).toBeInTheDocument()

    cleanup()
    apiGetMock.mockImplementation((path: string) => path === '/horarios/auditoria-cruces' ? Promise.reject(new Error('falló auditoría')) : path === '/horarios/' ? Promise.resolve([HORARIO]) : path === '/fichas/' ? Promise.resolve([FICHA]) : path === '/usuarios/' ? Promise.resolve([INSTRUCTOR]) : path === '/ambientes' ? Promise.resolve([AMBIENTE]) : path === '/sedes' ? Promise.resolve([SEDE]) : path === '/trimestres/' ? Promise.resolve([TRIMESTRE]) : path === '/dias-semana/' ? Promise.resolve(DIAS) : Promise.reject(new Error('no mockeado')))
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=ambiente&idAmbiente=1'])
    expect(await screen.findByText(/No se pudo consultar los Conflictos/)).toBeInTheDocument()
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

  it('clic en una fila abre una tarjeta central sin retirar la tabla', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])

    const drawer = await screen.findByRole('dialog', { name: 'Horario #7' })
    expect(drawer).toHaveClass('max-w-5xl', 'rounded-2xl')
    expect(within(drawer).getByText('Bloque #7 · Ficha 3228973 B')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'Ver registro de cambios' })).toHaveAttribute('href', '/horarios/historial?idHorario=7')
    expect(within(drawer).getByText('Competencia')).toBeInTheDocument()
    expect(within(drawer).getByText('Resultado de aprendizaje (RAP)')).toBeInTheDocument()
    expect(within(drawer).getByText('Carga semanal')).toBeInTheDocument()
    expect(within(drawer).getByText(/CPL18 · Gestión de inventarios/)).toBeInTheDocument()
    expect(within(drawer).getByText('Horario semanal')).toBeInTheDocument()

    expect(await within(drawer).findByText('10h / 40h')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(8)
  })

  it('centraliza la publicación y edición del bloque en su tarjeta de gestión', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    const detalle = screen.getByRole('dialog', { name: 'Horario #7' })
    expect(within(detalle).getByText('Visible para el instructor')).toBeInTheDocument()
    expect(within(detalle).getByRole('button', { name: 'Retirar de publicación' })).toBeInTheDocument()
    expect(within(detalle).getByRole('button', { name: 'Modificar bloque' })).toBeInTheDocument()
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

  it('enlaza las perspectivas de ficha, instructor y ambiente', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await screen.findByText('3228973 B')

    await usuario.click(screen.getAllByText('3228973 B')[0])
    await screen.findByRole('dialog', { name: 'Horario #7' })

    // SCRUM-204: construido con escribirGestionarHorariosQuery (el mismo
    // escritor canónico que usa toda la app), no con un string armado a
    // mano -- por eso conserva cualquier filtro ya activo en la URL (ver
    // AppRouter.test.tsx, "regresión de flujo completo"), aunque el orden
    // de los parámetros ya no coincida con el literal anterior.
    expect(screen.getByRole('link', { name: 'Ver horario por ficha →' })).toHaveAttribute('href', '/horarios/completos?perspectiva=ficha&idHorario=7&idFicha=1')
    expect(screen.getByRole('link', { name: 'Ver horario por instructor →' })).toHaveAttribute('href', '/horarios/completos?perspectiva=instructor&idHorario=7&idInstructor=u1')
    expect(screen.getByRole('link', { name: 'Ver horario por ambiente →' })).toHaveAttribute('href', '/horarios/completos?perspectiva=ambiente&idHorario=7&idAmbiente=1')
    expect(screen.getByText('Validación de cruces superada.')).toBeInTheDocument()
  })

  it('un horario publicado permite gestionarse desde su detalle', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    expect(screen.getByRole('button', { name: 'Retirar de publicación' })).toBeInTheDocument()
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

  it('reúne edición y publicación en la tarjeta central', async () => {
    mockeaBase()
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    expect(screen.getByRole('button', { name: 'Modificar bloque' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirar de publicación' })).toBeInTheDocument()
  })

  it('muestra la cuadrícula del bloque importado y sus acciones en la tarjeta', async () => {
    mockeaBase([{ ...HORARIO, horaInicio: '07:00:00', horaFin: '09:00:00', publicado: false }])
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    const tarjeta = screen.getByRole('dialog', { name: 'Horario #7' })
    expect(within(tarjeta).getByRole('region', { name: 'Ubicación en la semana' })).toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'Publicar bloque' })).toBeInTheDocument()
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
    expect(within(drawer).getByText(/CPL18 · Gestión de inventarios/)).toBeInTheDocument()
  })

  // SCRUM-196: "bloque creado aparece en la perspectiva correspondiente" —
  // nunca se había probado que el filtro de filtrosGestionarHorarios.ts
  // (query.idFicha/idInstructor/idAmbiente) de verdad aísle los bloques de
  // la entidad elegida y no los mezcle con los de otra ficha/instructor/
  // ambiente que también existan en el sistema.
  it('la perspectiva Por ficha solo muestra los bloques de la ficha seleccionada, no los de otra', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO, HORARIO_OTRA_FICHA])
      if (path === '/fichas/') return Promise.resolve([FICHA, FICHA_2])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=ficha&idFicha=1'])

    expect(await screen.findByText('1 bloque en el contexto actual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir bloque #7' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir bloque #10' })).not.toBeInTheDocument()
  })

  it('la perspectiva Por instructor solo muestra los bloques del instructor seleccionado, no los de otro', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO, HORARIO_OTRO_INSTRUCTOR])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR, INSTRUCTOR_2])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=instructor&idInstructor=u1'])

    expect(await screen.findByText('1 bloque en el contexto actual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir bloque #7' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir bloque #11' })).not.toBeInTheDocument()
  })

  // SCRUM-199: "tras resolver, la auditoría refleja el cambio" -- antes,
  // actualizarHorario (publicar/despublicar) solo tocaba el estado local
  // de `horarios`; la auditoría real seguía mostrando el conflicto ya
  // resuelto hasta recargar toda la pantalla.
  it('despublicar un horario para resolver un conflicto vuelve a consultar la auditoría real y refleja el cambio', async () => {
    let llamadasAuditoria = 0
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/horarios/auditoria-cruces') {
        llamadasAuditoria += 1
        return Promise.resolve(
          llamadasAuditoria === 1
            ? { conflictos: [{ idHorario: 7, idHorarioExistente: null, tipo: 'regla_instructor', mensaje: 'Excede el tope de horas semanales.' }], resumen: { totalCruces: 1, tipos: ['regla_instructor'] } }
            : { conflictos: [], resumen: { totalCruces: 0, tipos: [] } },
        )
      }
      if (path === '/usuarios/u1/carga-semanal') return Promise.resolve(CARGA_SEMANAL)
      return Promise.reject(new Error('no mockeado en este test'))
    })
    apiPatchMock.mockResolvedValue({ ...HORARIO, publicado: false })
    const usuario = userEvent.setup()
    renderConProviders(<HorariosCompletos />)

    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle del horario de la ficha 3228973 B' }))
    await usuario.click(screen.getByRole('tab', { name: 'Relaciones' }))
    expect(await screen.findByText('Excede el tope de horas semanales.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Publicación' }))
    await usuario.click(await screen.findByRole('button', { name: 'Despublicar' }))

    expect(apiPatchMock).toHaveBeenCalledWith('/horarios/7/estado', { publicado: false })
    await waitFor(() => expect(llamadasAuditoria).toBeGreaterThanOrEqual(2))

    await usuario.click(screen.getByRole('tab', { name: 'Relaciones' }))
    expect(await screen.findByText('Validación de cruces superada.')).toBeInTheDocument()
    expect(screen.queryByText('Excede el tope de horas semanales.')).not.toBeInTheDocument()
  })

  it('la perspectiva Por ambiente solo muestra los bloques del ambiente seleccionado, no los de otro', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO, HORARIO_OTRO_AMBIENTE])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE, AMBIENTE_2])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=ambiente&idAmbiente=1'])

    expect(await screen.findByText('1 bloque en el contexto actual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir bloque #7' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir bloque #12' })).not.toBeInTheDocument()
  })

  // SCRUM-197: "vistas de consulta consistentes para ficha, instructor y
  // ambiente" -- un bloque sin publicar no se distinguía del publicado en
  // ninguna perspectiva, así que un coordinador no podía saber cuál
  // todavía no le llega al instructor/aprendiz.
  it('la perspectiva Por ficha distingue visualmente un bloque en borrador del publicado', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO, HORARIO_BORRADOR])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=ficha&idFicha=1'])

    expect(await screen.findByText('2 bloques en el contexto actual')).toBeInTheDocument()
    expect(screen.getAllByText('Borrador')).toHaveLength(1)
  })

  it('la perspectiva Por instructor distingue visualmente un bloque en borrador del publicado', async () => {
    apiGetMock.mockImplementation((path: string) => {
      if (path === '/horarios/') return Promise.resolve([HORARIO, HORARIO_BORRADOR])
      if (path === '/fichas/') return Promise.resolve([FICHA])
      if (path === '/usuarios/') return Promise.resolve([INSTRUCTOR])
      if (path === '/ambientes') return Promise.resolve([AMBIENTE])
      if (path === '/sedes') return Promise.resolve([SEDE])
      if (path === '/trimestres/') return Promise.resolve([TRIMESTRE])
      if (path === '/dias-semana/') return Promise.resolve(DIAS)
      if (path === '/horarios/auditoria-cruces') return Promise.resolve({ conflictos: [], resumen: { totalCruces: 0, tipos: [] } })
      return Promise.reject(new Error('no mockeado en este test'))
    })
    renderConProviders(<HorariosCompletos />, ['/horarios/completos?perspectiva=instructor&idInstructor=u1'])

    expect(await screen.findByText('2 bloques en el contexto actual')).toBeInTheDocument()
    expect(screen.getAllByText('Borrador')).toHaveLength(1)
  })
})
