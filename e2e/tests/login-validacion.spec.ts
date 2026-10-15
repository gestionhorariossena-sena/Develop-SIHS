import { test, expect } from '@playwright/test'

/**
 * E2E semana 1 (Edith): al enviar el login con campos obligatorios vacíos,
 * no debe llamarse a ningún backend de autenticación (ni Supabase ni
 * /usuarios/login-documento) ni navegar fuera de /login.
 *
 * Login.tsx usa `required` nativo de HTML en los <input> (no un mensaje
 * propio de React) — el navegador bloquea el submit antes de que
 * handleSubmit llegue a ejecutarse, así que la aserción real y verificable
 * es "no se disparó ninguna llamada de red de login", no un texto en
 * pantalla.
 */
test.describe('Login - validación de campos vacíos', () => {
  test('no llama a ningún backend de autenticación si los campos están vacíos', async ({ page }) => {
    // Arrange
    const llamadasDeLogin: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (
        url.includes('/auditoria/estado-login') ||
        url.includes('/usuarios/login-documento') ||
        url.includes('/auditoria/intento-fallido-login') ||
        url.includes('/auth/v1/token')
      ) {
        llamadasDeLogin.push(url)
      }
    })
    await page.goto('/login')

    const campoIdentificador = page.getByLabel('Correo institucional o número de documento')
    const campoPassword = page.getByLabel('Contraseña', { exact: true })
    const botonIngresar = page.getByRole('button', { name: /iniciar sesión/i })

    // Act
    await botonIngresar.click()

    // Assert
    // 1) El navegador bloquea el envío por validación nativa (required).
    await expect(campoIdentificador).toHaveJSProperty('validity.valid', false)
    const mensajeValidacion = await campoIdentificador.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(mensajeValidacion.length).toBeGreaterThan(0)

    // 2) El password tampoco pasa la validación nativa.
    await expect(campoPassword).toHaveJSProperty('validity.valid', false)

    // 3) No se disparó ninguna llamada de red hacia login/auditoría/Supabase.
    expect(llamadasDeLogin).toHaveLength(0)

    // 4) Seguimos en /login, no navegó a /dashboard.
    await expect(page).toHaveURL(/\/login$/)
  })

  test('igual bloquea el envío si solo falta la contraseña', async ({ page }) => {
    // Arrange
    const llamadasDeLogin: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/auditoria/estado-login') || url.includes('/usuarios/login-documento') || url.includes('/auth/v1/token')) {
        llamadasDeLogin.push(url)
      }
    })
    await page.goto('/login')

    // Act
    await page.getByLabel('Correo institucional o número de documento').fill('usuario@sena.edu.co')
    await page.getByRole('button', { name: /iniciar sesión/i }).click()

    // Assert
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveJSProperty('validity.valid', false)
    expect(llamadasDeLogin).toHaveLength(0)
    await expect(page).toHaveURL(/\/login$/)
  })
})
