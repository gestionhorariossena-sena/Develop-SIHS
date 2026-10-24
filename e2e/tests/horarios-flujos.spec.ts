import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

const API_URL = process.env.E2E_API_URL?.replace(/\/$/, '')
const IDENTIFICADOR = process.env.E2E_LOGIN_IDENTIFIER
const CONTRASENA = process.env.E2E_LOGIN_PASSWORD
const IDS_FIXTURE = {
  ficha: Number(process.env.E2E_TEST_FICHA_ID),
  instructor: process.env.E2E_TEST_INSTRUCTOR_ID,
  ambiente: Number(process.env.E2E_TEST_AMBIENTE_ID),
  resultado: Number(process.env.E2E_TEST_RESULTADO_ID),
}
const CONFIGURACION_COMPLETA =
  Boolean(API_URL && IDENTIFICADOR && CONTRASENA) &&
  Number.isInteger(IDS_FIXTURE.ficha) && IDS_FIXTURE.ficha > 0 &&
  Boolean(IDS_FIXTURE.instructor) &&
  Number.isInteger(IDS_FIXTURE.ambiente) && IDS_FIXTURE.ambiente > 0 &&
  Number.isInteger(IDS_FIXTURE.resultado) && IDS_FIXTURE.resultado > 0

type Ficha = {
  idFicha: number
  codigoFicha: string
  idTrimestre: number
  jornadas: string[]
}

type Usuario = { idUsuario: string; nombre: string }
type Ambiente = { idAmbiente: number; nombreAmbiente: string }
type Resultado = { idResultado: number; descripcion: string }
type Jornada = { idJornada: number; nombreJornada: string }
type Dia = { idDia: number; nombreDia: string }
type Slot = {
  nombreJornada: string
  horaInicio: string
  horaFin: string
  etiquetaInicio: string
  etiquetaFin: string
}
type HorarioCreate = {
  horaInicio: string
  horaFin: string
  idJornada: number
  idTrimestre: number
  idAmbiente: number
  idInstructor: string
  idFicha: number
  idResultado: number
  dias: number[]
  publicado: boolean
}
type Horario = HorarioCreate & { idHorario: number; publicado: boolean }

const SLOTS: Slot[] = [
  { nombreJornada: 'Mañana', horaInicio: '06:15:00', horaFin: '09:00:00', etiquetaInicio: '6:15 a.m', etiquetaFin: '9:00 a.m' },
  { nombreJornada: 'Mañana', horaInicio: '09:00:00', horaFin: '12:00:00', etiquetaInicio: '9:00 a.m', etiquetaFin: '12:00 p.m' },
  { nombreJornada: 'Tarde', horaInicio: '12:00:00', horaFin: '15:00:00', etiquetaInicio: '12:00 p.m', etiquetaFin: '3:00 p.m' },
  { nombreJornada: 'Tarde', horaInicio: '15:00:00', horaFin: '18:00:00', etiquetaInicio: '3:00 p.m', etiquetaFin: '6:00 p.m' },
  { nombreJornada: 'Noche', horaInicio: '18:00:00', horaFin: '20:00:00', etiquetaInicio: '6:00 p.m', etiquetaFin: '8:00 p.m' },
  { nombreJornada: 'Noche', horaInicio: '20:00:00', horaFin: '22:00:00', etiquetaInicio: '8:00 p.m', etiquetaFin: '10:00 p.m' },
]
const DIAS_GRID = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

test.describe('Flujos críticos de horarios (E2E con backend de pruebas)', () => {
  test.skip(!CONFIGURACION_COMPLETA, 'Configura las credenciales y los IDs de fixture del backend de pruebas.')
  test.describe.configure({ mode: 'serial' })

  test('publica desde la interfaz un borrador creado previamente por API', async ({ page, request }) => {
    const { api, catalogs } = await iniciarSesionYPrepararApi(page, request)
    const fixture = await buscarSlotDisponible(api, catalogs)
    const borrador = await crearHorario(api, { ...fixture.payload, publicado: false })

    try {
      await page.goto('/horarios/completos')
      const fila = page.getByRole('row')
        .filter({ hasText: catalogs.ficha.codigoFicha })
        .filter({ hasText: `${borrador.horaInicio.slice(0, 5)}-${borrador.horaFin.slice(0, 5)}` })
      await expect(fila).toBeVisible()
      await fila.getByRole('button', { name: `Ver detalle del horario de la ficha ${catalogs.ficha.codigoFicha}` }).click()

      const patch = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/horarios/${borrador.idHorario}/estado`),
      )
      await page.getByRole('button', { name: 'Publicar ahora' }).click()
      const respuestaPatch = await patch

      expect(respuestaPatch.ok()).toBeTruthy()
      expect((await respuestaPatch.json() as Horario).publicado).toBe(true)
      await expect(page.getByText('Publicado', { exact: true }).first()).toBeVisible()

      const persistido = await api.get<Horario>(`/horarios/${borrador.idHorario}`)
      expect(persistido.publicado).toBe(true)
    } finally {
      await eliminarHorario(api, borrador.idHorario)
    }

  })

  test('crea y publica un bloque desde el constructor manual', async ({ page, request }) => {
    const { api, catalogs } = await iniciarSesionYPrepararApi(page, request)
    const slot = await buscarSlotDisponible(api, catalogs)
    let idHorarioCreado: number | undefined

    try {
      await page.goto('/horarios/nuevo')
      await page.getByRole('button', { name: `Ficha ${catalogs.ficha.codigoFicha}` }).click()
      await page.getByRole('button', { name: '+ Nuevo' }).click()
      await page.getByLabel('Resultado de aprendizaje').selectOption(String(catalogs.resultado.idResultado))
      await page.getByLabel('Instructor', { exact: true }).selectOption(catalogs.instructor.idUsuario)
      await page.getByLabel('Ambiente', { exact: true }).selectOption(String(catalogs.ambiente.idAmbiente))
      await page.getByRole('button', { name: 'Guardar bloque' }).click()

      await page.getByRole('button').filter({ hasText: catalogs.resultado.descripcion }).first().click()
      await page.getByLabel('Guardar como borrador').uncheck()

      const nombreDia = slot.dia.nombreDia
      const celda = page.getByRole('button', {
        name: `Asignar bloque activo a ${nombreDia}, ${slot.slot.etiquetaInicio} – ${slot.slot.etiquetaFin}`,
      })
      await celda.click()

      const respuestaCrear = page.waitForResponse((response) =>
        response.request().method() === 'POST' && /\/horarios\/?$/.test(new URL(response.url()).pathname),
      )
      await page.getByRole('button', { name: 'Guardar y publicar' }).click()
      const response = await respuestaCrear
      expect(response.status()).toBe(201)

      const creado = await response.json() as Horario
      idHorarioCreado = creado.idHorario
      await expect(page.getByText('1 clase creada y publicada.', { exact: true })).toBeVisible()

      const persistidos = await api.get<Horario[]>(`/fichas/${catalogs.ficha.idFicha}/horarios`)
      expect(persistidos.some((horario) =>
        horario.idHorario === creado.idHorario &&
        horario.idResultado === catalogs.resultado.idResultado &&
        horario.idInstructor === catalogs.instructor.idUsuario &&
        horario.idAmbiente === catalogs.ambiente.idAmbiente &&
        horario.publicado,
      )).toBe(true)
    } finally {
      if (idHorarioCreado !== undefined) await eliminarHorario(api, idHorarioCreado)
    }

  })
})

async function iniciarSesionYPrepararApi(page: Page, request: APIRequestContext) {
  const identificador = variableRequerida(IDENTIFICADOR, 'E2E_LOGIN_IDENTIFIER')
  const contrasena = variableRequerida(CONTRASENA, 'E2E_LOGIN_PASSWORD')

  await page.goto('/login')
  await page.getByLabel('Correo institucional o número de documento', { exact: true }).fill(identificador)
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 })

  const token = await page.evaluate(() => {
    for (let indice = 0; indice < localStorage.length; indice += 1) {
      const valor = localStorage.getItem(localStorage.key(indice) ?? '')
      if (!valor) continue
      try {
        const sesion = JSON.parse(valor) as { access_token?: unknown }
        if (typeof sesion.access_token === 'string') return sesion.access_token
      } catch {
        continue
      }
    }
    return null
  })
  if (!token) throw new Error('No se encontró una sesión Supabase válida después del login E2E.')

  const api = new ApiPrueba(request, token)
  const perfil = await api.get<{ roles: { nombre: string }[] }>('/usuarios/me')
  expect(perfil.roles.some((rol) => ['Coordinador', 'Administrador'].includes(rol.nombre))).toBe(true)

  const [fichas, usuarios, ambientes, resultados, jornadas, dias] = await Promise.all([
    api.get<Ficha[]>('/fichas/'),
    api.get<Usuario[]>('/usuarios/'),
    api.get<Ambiente[]>('/ambientes'),
    api.get<Resultado[]>('/resultados-aprendizaje/'),
    api.get<Jornada[]>('/jornadas/'),
    api.get<Dia[]>('/dias-semana/'),
  ])

  const ficha = fichas.find((item) => item.idFicha === IDS_FIXTURE.ficha)
  const instructor = usuarios.find((item) => item.idUsuario === IDS_FIXTURE.instructor)
  const ambiente = ambientes.find((item) => item.idAmbiente === IDS_FIXTURE.ambiente)
  const resultado = resultados.find((item) => item.idResultado === IDS_FIXTURE.resultado)
  if (!ficha || !instructor || !ambiente || !resultado) {
    throw new Error('Los IDs E2E_TEST_* no existen o no están disponibles en los catálogos del backend de pruebas.')
  }

  return { api, catalogs: { ficha, instructor, ambiente, resultado, jornadas, dias } }
}

async function buscarSlotDisponible(
  api: ApiPrueba,
  catalogs: Awaited<ReturnType<typeof iniciarSesionYPrepararApi>>['catalogs'],
) {
  const jornadasPermitidas = new Set(catalogs.ficha.jornadas.map((nombre) => normalizar(nombre)))
  const dias = DIAS_GRID
    .map((nombre) => catalogs.dias.find((dia) => normalizar(dia.nombreDia) === normalizar(nombre)))
    .filter((dia): dia is Dia => dia !== undefined)

  for (const slot of SLOTS) {
    if (!jornadasPermitidas.has(normalizar(slot.nombreJornada))) continue
    const jornada = catalogs.jornadas.find((item) => normalizar(item.nombreJornada) === normalizar(slot.nombreJornada))
    if (!jornada) continue

    for (const dia of dias) {
      const payload: HorarioCreate = {
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        idJornada: jornada.idJornada,
        idTrimestre: catalogs.ficha.idTrimestre,
        idAmbiente: catalogs.ambiente.idAmbiente,
        idInstructor: catalogs.instructor.idUsuario,
        idFicha: catalogs.ficha.idFicha,
        idResultado: catalogs.resultado.idResultado,
        dias: [dia.idDia],
        publicado: false,
      }
      const validar = await api.post('/horarios/validar', payload, [200, 409])
      if (validar.status() === 409) continue
      const validacion = await validar.json() as { puedeGuardar: boolean }
      if (validacion.puedeGuardar) return { payload, slot, dia }
    }
  }

  throw new Error('No hay una celda libre para la ficha e instructor E2E configurados; prepara disponibilidad en el backend de pruebas.')
}

async function crearHorario(api: ApiPrueba, payload: HorarioCreate) {
  const respuesta = await api.post('/horarios/', payload, [201])
  return await respuesta.json() as Horario
}

async function eliminarHorario(api: ApiPrueba, idHorario: number) {
  await api.delete(`/horarios/${idHorario}`)
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-CO')
}

function variableRequerida(valor: string | undefined, nombre: string): string {
  if (!valor) throw new Error(`Falta configurar ${nombre} para ejecutar los E2E de horarios.`)
  return valor
}

class ApiPrueba {
  constructor(private readonly request: APIRequestContext, private readonly token: string) {}

  async get<T>(path: string): Promise<T> {
    return await (await this.enviar('GET', path)).json() as T
  }

  post(path: string, data: unknown, estadosEsperados: number[] = [200]) {
    return this.enviar('POST', path, data, estadosEsperados)
  }

  async delete(path: string) {
    await this.enviar('DELETE', path, undefined, [200, 204])
  }

  private async enviar(
    metodo: 'GET' | 'POST' | 'DELETE',
    path: string,
    data?: unknown,
    estadosEsperados: number[] = [200],
  ): Promise<APIResponse> {
    const apiUrl = variableRequerida(API_URL, 'E2E_API_URL')
    const response = await this.request.fetch(`${apiUrl}${path}`, {
      method: metodo,
      data,
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!estadosEsperados.includes(response.status())) {
      throw new Error(`${metodo} ${path} respondió ${response.status()}: ${await response.text()}`)
    }
    return response
  }
}
