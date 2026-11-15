import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * E2E semana 1 (Nicol): la coordinación recorre el asistente de horarios
 * (subir Excel -> fichas listas -> paso 3) y le pregunta algo a la IA; la
 * respuesta tiene que quedar visible. Solo la red está simulada con
 * `page.route`, así el test no depende de Gemini en vivo (la corrida real
 * contra la IA vive en backend/tests/test_e2e_asistente_gemini.py).
 */

const COORDINADOR_ID = '11111111-1111-4111-8111-111111111111'
const RESPUESTA_IA = 'La ficha 3171618 no se programó porque el instructor ya tiene clase a esa hora.'

function crearToken(idUsuario: string): string {
  const codificar = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  const ahora = Math.floor(Date.now() / 1000)
  return [
    codificar({ alg: 'HS256', typ: 'JWT' }),
    codificar({ aud: 'authenticated', exp: ahora + 3600, iat: ahora, role: 'authenticated', sub: idUsuario }),
    'e2e-signature',
  ].join('.')
}

async function instalarSesion(page: Page, idUsuario: string) {
  const ahora = new Date().toISOString()
  const session = {
    access_token: crearToken(idUsuario),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-refresh-token',
    user: {
      id: idUsuario,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'coordinador@example.test',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: ahora,
    },
  }
  await page.addInitScript(({ id, sesion }) => {
    localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(sesion))
  }, { id: 'e2e-project', sesion: session })
}

const PREVISUALIZACION = {
  nombreArchivo: 'planeacion.xlsx',
  hoja: 'Hoja1',
  filaEncabezado: 1,
  columnas: [{ columnaOriginal: 'FICHA', campo: 'ficha', confianza: 1 }],
  filas: [
    {
      fila: 2, codigoFicha: '3171618', fichaExiste: true, idFicha: 1, programa: 'ADSO', jornada: 'MAÑANA',
      instructorNombre: null, advertencia: null, nivelFormacion: null, coordinacion: null, codigoPrograma: null,
      fechaInicioLectiva: null, fechaFinLectiva: null, fechaFinProductiva: null, faseActual: null, faseActualEnBD: null,
    },
  ],
  totalFilas: 1,
  filasConAdvertencia: 0,
  advertenciaGeneral: null,
  archivoComplementario: null,
  hojaComplementaria: null,
}

type Preguntar = (route: Route) => Promise<void>

async function simularRed(page: Page, preguntar: Preguntar, preguntasRecibidas: Record<string, unknown>[] = []) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const ruta = new URL(request.url()).pathname.replace('/api/v1', '')
    const metodo = request.method()
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(datos) })

    if (ruta === '/usuarios/me' && metodo === 'GET') {
      return responder({
        idUsuario: COORDINADOR_ID,
        nombre: 'Coordinador E2E',
        email: 'coordinador@example.test',
        estado: 'activo',
        fechaRegistro: '2026-01-01T00:00:00Z',
        roles: [{ idRol: 1, nombre: 'Coordinador' }],
        especialidades: [],
        debeCambiarClave: false,
      })
    }
    // Período vigente sea cuando sea que corra el test.
    if (ruta === '/trimestres/' && metodo === 'GET') {
      return responder([{
        idTrimestre: 1, nombre: 'Vigente', fechaInicio: '2000-01-01', fechaFin: '2999-12-31', estado: 'activo',
      }])
    }
    if (ruta === '/horarios/asistente/importar' && metodo === 'POST') return responder(PREVISUALIZACION)
    if (ruta === '/horarios/asistente/generar-propuesta' && metodo === 'POST') {
      return responder({ bloques: [], factible: false, mensaje: 'Sin bloques.', fichasSinProgramar: [] })
    }
    if (ruta === '/horarios/asistente/preguntar' && metodo === 'POST') {
      preguntasRecibidas.push(request.postDataJSON() as Record<string, unknown>)
      return preguntar(route)
    }
    return responder([])
  })
}

async function llegarAlPaso3(page: Page) {
  await instalarSesion(page, COORDINADOR_ID)
  await page.goto('/horarios/asistente-ia')

  await page.getByLabel('Seleccionar archivo Excel').setInputFiles({
    name: 'planeacion.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('x'),
  })
  const continuar = page.getByRole('button', { name: 'Continuar', exact: true })
  await expect(continuar).toBeEnabled()
  await continuar.click()

  await page.getByRole('button', { name: /Continuar con 1 ficha/ }).click()
  return page.getByPlaceholder(/por qué esta ficha no se pudo programar/)
}

test.describe('Asistente de horarios - pregunta a la IA', () => {
  test('la respuesta de la IA queda visible tras preguntar en el paso 3', async ({ page }) => {
    // Arrange
    const preguntasRecibidas: Record<string, unknown>[] = []
    await simularRed(
      page,
      (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ respuesta: RESPUESTA_IA }) }),
      preguntasRecibidas,
    )
    const caja = await llegarAlPaso3(page)

    // Act
    await caja.fill('¿por qué no se programó esta ficha?')
    await page.getByRole('button', { name: 'Preguntar', exact: true }).click()

    // Assert
    await expect(page.getByText(RESPUESTA_IA)).toBeVisible()
    expect(preguntasRecibidas).toHaveLength(1)
    expect(preguntasRecibidas[0]).toMatchObject({ pregunta: '¿por qué no se programó esta ficha?' })
  })

  test('si la IA tarda demasiado muestra un aviso entendible en lugar de quedarse en blanco', async ({ page }) => {
    // Arrange
    await simularRed(page, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: { motivo: 'timeout', mensaje: 'Gemini no respondió a tiempo.' } }),
      }),
    )
    const caja = await llegarAlPaso3(page)

    // Act
    await caja.fill('hola')
    await page.getByRole('button', { name: 'Preguntar', exact: true }).click()

    // Assert
    await expect(page.getByText(/El asistente con IA tardó demasiado en responder/)).toBeVisible()
    await expect(page.getByText(RESPUESTA_IA)).toHaveCount(0)
  })

  test('no deja preguntar con la caja vacía y no llama a la IA', async ({ page }) => {
    // Arrange
    const preguntasRecibidas: Record<string, unknown>[] = []
    await simularRed(
      page,
      (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ respuesta: RESPUESTA_IA }) }),
      preguntasRecibidas,
    )
    await llegarAlPaso3(page)

    // Act / Assert
    await expect(page.getByRole('button', { name: 'Preguntar', exact: true })).toBeDisabled()
    expect(preguntasRecibidas).toHaveLength(0)
  })
})
