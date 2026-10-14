import { expect, test, type Page } from '@playwright/test'

const COORDINADOR_ID = '11111111-1111-4111-8111-111111111111'
const INSTRUCTOR_ID = '22222222-2222-4222-8222-222222222222'
const FICHA_ID = 71
type RolActual = 'Coordinador' | 'Instructor'

function crearToken(idUsuario: string): string {
  const codificar = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  const ahora = Math.floor(Date.now() / 1000)
  return [
    codificar({ alg: 'HS256', typ: 'JWT' }),
    codificar({ aud: 'authenticated', exp: ahora + 3600, iat: ahora, role: 'authenticated', sub: idUsuario }),
    'e2e-signature',
  ].join('.')
}

function crearSesion(idUsuario: string) {
  const ahora = new Date().toISOString()
  return {
    access_token: crearToken(idUsuario),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'e2e-refresh-token',
    user: {
      id: idUsuario,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${idUsuario}@example.test`,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: ahora,
    },
  }
}

async function instalarSesion(page: Page, idUsuario: string) {
  await page.addInitScript(({ id, session }) => {
    localStorage.setItem(`sb-${id}-auth-token`, JSON.stringify(session))
  }, { id: 'e2e-project', session: crearSesion(idUsuario) })
}

test('la coordinación publica un horario y el instructor lo ve en Mi horario', async ({ page }) => {
  let rolActual: RolActual = 'Coordinador'
  let horarioPublicado: Record<string, unknown> | null = null
  let lecturasDelInstructor = 0

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const ruta = new URL(request.url()).pathname.replace('/api/v1', '')
    const metodo = request.method()
    const responder = (datos: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(datos) })

    if (ruta === '/usuarios/me' && metodo === 'GET') {
      const instructor = rolActual === 'Instructor'
      return responder({
        idUsuario: instructor ? INSTRUCTOR_ID : COORDINADOR_ID,
        nombre: instructor ? 'Instructor E2E' : 'Coordinador E2E',
        email: `${rolActual.toLowerCase()}@example.test`,
        estado: 'activo',
        fechaRegistro: '2026-01-01T00:00:00Z',
        tipoContrato: 'contrato',
        roles: [{ idRol: instructor ? 2 : 1, nombre: rolActual }],
        especialidades: [],
        debeCambiarClave: false,
      })
    }

    if (ruta === '/fichas/' && metodo === 'GET') {
      return responder([{
        idFicha: FICHA_ID,
        codigoFicha: 'FICHA-E2E',
        idPrograma: 81,
        idTrimestre: 91,
        idSede: 101,
        programa: {
          idPrograma: 81,
          codigoPrograma: 'PROG-E2E',
          nombrePrograma: 'Programa E2E',
          nivelFormacion: 'Técnico',
          activo: true,
          idCoordinacion: 1,
        },
        trimestre: {
          idTrimestre: 91,
          nombre: 'Trimestre E2E',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          estado: 'activo',
        },
        sede: { idSede: 101, nombreSede: 'Sede E2E', direccion: null, tipoSede: 'principal' },
        aprendicesTotales: 1,
        jornadas: ['Mañana'],
      }])
    }

    if (ruta === '/ambientes' && metodo === 'GET') {
      return responder([{
        idAmbiente: 101,
        numeroAmbiente: 101,
        nombreAmbiente: 'Ambiente',
        tipoAmbiente: 'regular',
        estadoAmbiente: 'disponible',
        idSede: 101,
      }])
    }

    if (ruta === '/usuarios/' && metodo === 'GET') {
      return responder([{
        idUsuario: INSTRUCTOR_ID,
        nombre: 'Instructor E2E',
        email: 'instructor@example.test',
        estado: 'activo',
        fechaRegistro: '2026-01-01T00:00:00Z',
        roles: [{ idRol: 2, nombre: 'Instructor' }],
        especialidades: [],
        debeCambiarClave: false,
      }])
    }

    if (ruta === '/resultados-aprendizaje/' && metodo === 'GET') {
      return responder([{
        idResultado: 111,
        codigo: 'RA-E2E',
        descripcion: 'Programación E2E',
        idCompetencia: 121,
        idGuia: null,
        horasAsignadas: 8,
      }])
    }

    if (ruta === '/jornadas/' && metodo === 'GET') {
      return responder([
        { idJornada: 1, nombreJornada: 'Mañana' },
        { idJornada: 2, nombreJornada: 'Tarde' },
        { idJornada: 3, nombreJornada: 'Noche' },
      ])
    }

    if (ruta === '/dias-semana/' && metodo === 'GET') {
      return responder(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        .map((nombreDia, index) => ({ idDia: index + 1, nombreDia })))
    }

    if (ruta === '/horarios/validar' && metodo === 'POST') {
      return responder({ ok: true, puedeGuardar: true, conflictos: [], resumen: 'Sin cruces' })
    }

    if (ruta === '/horarios/' && metodo === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      horarioPublicado = {
        idHorario: 501,
        ...body,
        fechaCreacion: '2026-10-13T08:00:00Z',
        fechaModificacion: '2026-10-13T08:00:00Z',
        activo: true,
        publicado: body.publicado === true,
        instructorNombre: 'Instructor E2E',
        fichaCodigo: 'FICHA-E2E',
        ambienteNombre: 'Ambiente 101',
        resultadoCodigo: 'RA-E2E',
        resultadoDescripcion: 'Programación E2E',
      }
      return responder(horarioPublicado, 201)
    }

    if (ruta === '/horarios-guardados/' && metodo === 'POST') {
      return responder({ idHorarioGuardado: 601 })
    }

    if (/^\/fichas\/\d+\/horarios$/.test(ruta) && metodo === 'GET') {
      return responder(horarioPublicado ? [horarioPublicado] : [])
    }

    if (ruta === '/usuarios/me/horarios' && metodo === 'GET') {
      const horarios = horarioPublicado?.publicado === true &&
        horarioPublicado.idInstructor === INSTRUCTOR_ID
        ? [horarioPublicado]
        : []
      if (rolActual === 'Instructor') lecturasDelInstructor += 1
      return responder(horarios)
    }

    if (/^\/usuarios\/[^/]+\/carga-semanal$/.test(ruta) && metodo === 'GET') {
      return responder({ idUsuario: INSTRUCTOR_ID, tipoContrato: 'contrato', horasAsignadas: 3, horasMaximas: 40 })
    }

    if (ruta === '/notificaciones/' && metodo === 'GET') return responder([])
    if (ruta === '/horarios/auditoria-cruces' && metodo === 'GET') return responder([])

    return responder([])
  })

  await instalarSesion(page, COORDINADOR_ID)
  await page.goto('/horarios/nuevo')

  await page.getByRole('button', { name: /Ficha FICHA-E2E/ }).click()
  await page.getByRole('button', { name: '+ Nuevo' }).click()
  await page.getByLabel('Resultado de aprendizaje').selectOption(String(111))
  await page.getByLabel('Instructor').selectOption(INSTRUCTOR_ID)
  await page.getByLabel('Ambiente').selectOption(String(101))
  await page.getByRole('button', { name: 'Guardar bloque' }).click()

  await expect(page.getByRole('button', { name: /^RA-E2E — Programación E2E/ }))
    .toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', {
    name: 'Asignar bloque activo a Lunes, 6:15 a.m – 9:00 a.m',
  }).click()

  // Locator confirmed in the running UI: MiHorario/HorarioEditor are the
  // instructor's read-only view/editor; publication happens in NuevoHorario.
  await page.getByRole('checkbox', { name: 'Guardar como borrador' }).uncheck()
  await page.getByRole('button', { name: 'Guardar y publicar' }).click()

  await expect(page.getByText('1 clase creada y publicada.')).toBeVisible()
  expect(horarioPublicado?.publicado).toBe(true)
  expect(horarioPublicado?.idInstructor).toBe(INSTRUCTOR_ID)

  rolActual = 'Instructor'
  await instalarSesion(page, INSTRUCTOR_ID)
  await page.reload()
  await page.goto('/mi-horario')

  await expect(page.getByText('Programación E2E').first()).toBeVisible()
  expect(lecturasDelInstructor).toBeGreaterThan(0)
})
