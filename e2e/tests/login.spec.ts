import { expect, test, type Locator } from '@playwright/test'

test('muestra los campos del formulario de inicio de sesión', async ({ page }) => {
  await page.goto('/login')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
  await expect(page.getByLabel('Correo institucional o número de documento', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
})

test('autentica un usuario institucional y muestra el panel de su rol', async ({ page }) => {
  const identificador = process.env.E2E_LOGIN_IDENTIFIER?.trim()
  const contrasena = process.env.E2E_LOGIN_PASSWORD
  const rol = process.env.E2E_EXPECTED_ROLE?.trim()

  if (!identificador || !contrasena || !rol) {
    throw new Error(
      'Define E2E_LOGIN_IDENTIFIER, E2E_LOGIN_PASSWORD y E2E_EXPECTED_ROLE con una cuenta institucional de prueba antes de ejecutar el E2E de login.',
    )
  }

  let panelEsperado: Locator
  switch (rol) {
    case 'Aprendiz':
      panelEsperado = page.getByRole('link', { name: 'Mensajes Docentes', exact: true })
      break
    case 'Instructor':
      panelEsperado = page.getByText('Carga Lectiva Semanal', { exact: true })
      break
    case 'Administrador':
    case 'Coordinador':
      panelEsperado = page.getByRole('heading', { name: 'Dashboard — Panel de Programación', exact: true })
      break
    default:
      throw new Error(
        `E2E_EXPECTED_ROLE "${rol}" no es válido. Usa Aprendiz, Instructor, Coordinador o Administrador.`,
      )
  }

  await page.goto('/login')
  await page.getByLabel('Correo institucional o número de documento', { exact: true }).fill(identificador)
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 })
  await expect(panelEsperado).toBeVisible({ timeout: 20_000 })
})
