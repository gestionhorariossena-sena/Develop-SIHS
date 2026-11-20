import { expect, test } from '@playwright/test'

/**
 * SCRUM-203: "no hay bloqueos visuales del guion" -- la presentación (`/`)
 * es la primera pantalla de cualquier recorrido de demo. No necesita
 * backend ni credenciales (página pública), así que corre siempre, a
 * diferencia de los E2E de horarios-flujos.spec.ts que sí las exigen.
 *
 * Regresión real: a 375px (el ancho de celular más común, mismo criterio
 * que usó el diagnóstico de la app móvil) el grid del hero no tenía
 * `grid-cols-1` explícito en la base -- el track implícito se dimensionaba
 * por el max-content de la insignia "OPERACIÓN TRIMESTRAL | Centro de...",
 * desbordando el header 14px hacia la derecha.
 */
test.describe('Presentación — sin desborde horizontal en anchos de celular', () => {
  for (const width of [320, 360, 375]) {
    test(`a ${width}px de ancho no hay scroll horizontal`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)

      expect(scrollWidth).toBeLessThanOrEqual(width)
    })
  }

  test('el botón "Registrarse" sigue siendo visible y usable a 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Registrarse' })).toBeVisible()
  })
})
