# Reporte de pruebas — Semana 1: publicación E2E

**Fecha:** 2026-10-13
**Resultado:** PASS — 1 prueba aprobada, 0 fallidas, código de salida 0.

| Prueba | Qué valida | Por qué y para qué sirve |
|---|---|---|
| `la coordinación publica un horario y el instructor lo ve en Mi horario` | Playwright recorre la creación del horario, lo publica desde coordinación y comprueba que el instructor asignado lo ve en su vista. | Valida el flujo real de interfaz y los controles por rol; evita regresiones que pruebas unitarias no detectan. |

**Selectores confirmados en la UI:** `getByRole('checkbox', { name: 'Guardar como borrador' })` y, al desmarcarlo, `getByRole('button', { name: 'Guardar y publicar' })`. La aserción de visibilidad usa el texto de actividad `Programación E2E` que efectivamente renderiza Mi horario.

**Ejecución:** `pnpm test` desde `e2e/` — suite compartida: 3 passed (incluye este flujo y los 2 tests existentes de login); el flujo de publicación también pasó aislado (1/1).

**Alcance:** el navegador usa respuestas API y sesión interceptadas por Playwright; valida UI y flujo cliente, no sustituye la prueba de integración del backend.
