import { expect, test, type Page, type Route } from '@playwright/test'

const INSTRUCTOR_ID = '22222222-2222-4222-8222-222222222222'
const INSTRUCTOR_EMAIL = 'instructor-s5@example.test'

type EscenarioRed = 'api-caida' | 'lista-vacia' | 'validacion-422'

type EvidenciaRed = {
  consultasHorario: string[]
  respuestasHorario: number[]
  rutasNoPreparadas: string[]
}

function crearToken(idUsuario: string): string {
  const codificar = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  const ahora = Math.floor(Date.now() / 1000)
  return [
    codificar({ alg: 'HS256', typ: 'JWT' }),
    codificar({ aud: 'authenticated', exp: ahora + 3600, iat: ahora, role: 'authenticated', sub: idUsuario }),
    'e2e-signature',
  ].join('.')
}

async function instalarSesion(page: Page) {
  const ahora = new Date().toISOString()
  const session = {
    access_token: crearToken(INSTRUCTOR_ID),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-s5-refresh-token',
    user: {
      id: INSTRUCTOR_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: INSTRUCTOR_EMAIL,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: ahora,
    },
  }

  await page.addInitScript(({ id, sesion }) => {
    localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(sesion))
  }, { id: 'e2e-project', sesion: session })
}

function responder(route: Route, datos: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(datos),
  })
}

async function abrirMiHorario(page: Page, escenario: EscenarioRed): Promise<EvidenciaRed> {
  const evidencia: EvidenciaRed = {
    consultasHorario: [],
    respuestasHorario: [],
    rutasNoPreparadas: [],
  }

  await instalarSesion(page)
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const metodo = request.method()
    const ruta = new URL(request.url()).pathname.replace('/api/v1', '')

    if (ruta === '/usuarios/me' && metodo === 'GET') {
      return responder(route, {
        idUsuario: INSTRUCTOR_ID,
        nombre: 'Instructor Semana 5',
        email: INSTRUCTOR_EMAIL,
        estado: 'activo',
        fechaRegistro: '2026-01-01T00:00:00Z',
        tipoContrato: 'contrato',
        roles: [{ idRol: 2, nombre: 'Instructor' }],
        especialidades: [],
        debeCambiarClave: false,
      })
    }

    if (ruta === '/usuarios/me/horarios' && metodo === 'GET') {
      evidencia.consultasHorario.push(request.url())

      if (escenario === 'api-caida') {
        return route.abort('failed')
      }

      const status = escenario === 'validacion-422' ? 422 : 200
      evidencia.respuestasHorario.push(status)
      return responder(
        route,
        escenario === 'validacion-422'
          ? { detail: 'El período solicitado no es válido.' }
          : [],
        status,
      )
    }

    if (ruta === '/usuarios/' + INSTRUCTOR_ID + '/carga-semanal' && metodo === 'GET') {
      return responder(route, {
        idUsuario: INSTRUCTOR_ID,
        tipoContrato: 'contrato',
        horasAsignadas: 0,
        horasMaximas: 40,
      })
    }

    if (ruta === '/fichas/' && metodo === 'GET') return responder(route, [])
    if (ruta === '/notificaciones/' && metodo === 'GET') return responder(route, [])

    evidencia.rutasNoPreparadas.push(`${metodo} ${ruta}`)
    return responder(route, { detail: `Ruta no preparada en el stub E2E: ${metodo} ${ruta}` }, 501)
  })

  await page.goto('/mi-horario')
  await expect(page.getByRole('heading', { name: 'Mi Horario Semanal' })).toBeVisible()
  return evidencia
}

test.describe('Semana 5 Dayana — fallos de red en Mi horario', () => {
  test('muestra un aviso útil cuando la API no está disponible', async ({ page }) => {
    // Doble: stub de red con route.abort; aísla la caída fuera del frontend y ejercita su manejo real.
    const evidencia = await abrirMiHorario(page, 'api-caida')

    await expect(page.getByText(
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo otra vez.',
      { exact: true },
    )).toBeVisible()
    expect(evidencia.consultasHorario.length).toBeGreaterThan(0)
    expect(evidencia.rutasNoPreparadas).toEqual([])
  })

  test('muestra el estado vacío cuando la API responde sin horarios', async ({ page }) => {
    // Doble: stub de respuesta HTTP vacía; la UI y su estado derivado siguen siendo reales.
    const evidencia = await abrirMiHorario(page, 'lista-vacia')

    await expect(page.getByText(
      'Todavía no tenés clases publicadas en este período académico.',
      { exact: true },
    )).toBeVisible()
    expect(evidencia.consultasHorario.length).toBeGreaterThan(0)
    expect(evidencia.respuestasHorario).toContain(200)
    expect(evidencia.rutasNoPreparadas).toEqual([])
  })

  test('presenta el detalle de validación devuelto por la API', async ({ page }) => {
    // Doble: stub HTTP 422 en la frontera de red; comprueba el mensaje visible, no solo el status.
    const evidencia = await abrirMiHorario(page, 'validacion-422')

    await expect(page.getByText('El período solicitado no es válido.', { exact: true })).toBeVisible()
    expect(evidencia.consultasHorario.length).toBeGreaterThan(0)
    expect(evidencia.respuestasHorario).toContain(422)
    expect(evidencia.rutasNoPreparadas).toEqual([])
  })
})
