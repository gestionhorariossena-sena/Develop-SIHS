# Matriz de rotación — Testing SIHS

Equipo: Nicol, David, Dayana y Edith.

## Semana 1 — Primer E2E con Playwright

| Integrante | Flujo E2E | Evidencia | Capa S1 |
|---|---|---|---|
| Nicol | Asistente de horarios: preguntar a IA, respuesta visible, timeout y pregunta vacía | `e2e/tests/asistente-ia.spec.ts` — PR #152 | E2E |
| David | Inicio de sesión institucional y panel por rol | `e2e/tests/login.spec.ts` — PR #142 | E2E |
| Dayana | Publicación de horario y visibilidad por instructor | `e2e/tests/publicar-horario.spec.ts` — PR #143 | E2E |
| Edith | Validaciones del formulario de login vacío | `e2e/tests/login-validacion.spec.ts` — PR #140 | E2E |

Los cuatro flujos son diferentes. Los PR #140, #142 y #143 ya se habían integrado; el caso de Nicol proviene del PR #152. Cada integrante debe poder explicar el test de otro y registrar su revisión cruzada. Los tests que requieren credenciales deben ejecutarse usando **un entorno de pruebas**, no producción. No se consideran aprobados hasta ejecutar Playwright y registrar el resultado.

## Entregables grupales

- [x] Carpeta `e2e/` y configuración de Playwright.
- [x] Cuatro flujos individuales identificados, con aserciones sobre comportamiento observable.
- [x] Matriz S1 y plantilla de PR en `.github/pull_request_template.md`.
- [x] Línea base de cobertura en frontend y backend, con umbrales en CI.
- [ ] Verificar en un mismo entorno la ejecución verde de los cuatro flujos E2E.
- [ ] Registrar prueba de fallo intencional de cada flujo, revisión cruzada y evidencia de commits individuales.

## Línea base de cobertura S1

| Paquete | Sentencias | Ramas | Funciones | Líneas |
|---|---:|---:|---:|---:|
| Frontend (Vitest/V8) | 76,73 % | 64,85 % | 73,89 % | 79,59 % |
| Backend (pytest-cov) | 84 % (umbral global) | — | — | — |

Las cifras frontend son umbrales bloqueantes configurados en `frontend/vite.config.ts`. La línea base registrada en la rama de cierre fue: backend 84,07 % en CI (412 tests pasaron, 10 omitidos) y frontend 79,59 % de líneas en CI (363 pasaron). Los números históricos no sustituyen la comprobación de la ejecución actual.

## Ejecución

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm test:coverage
cd ../backend && pip install -r requirements.txt && pytest -v --cov=app --cov-report=term --cov-fail-under=84
cd ../e2e && pnpm install --frozen-lockfile && pnpm exec playwright install chromium && pnpm test
```

La prueba de login institucional de David requiere `E2E_LOGIN_IDENTIFIER`, `E2E_LOGIN_PASSWORD` y `E2E_EXPECTED_ROLE`; nunca incluir secretos en Git. El E2E del asistente de Nicol usa red simulada.

## Semana 3 — Tests de componentes Front (planificación)

> **Estado (2026-11-08):** los cuatro PR individuales de S3 están **fusionados en `semana-3`** (#166 Edith, #170 David, #168 Dayana y #167 Nicol). Todos tenían CI aprobada en sus commits de PR. La ausencia de una aprobación formal en #167 y #170 fue una excepción autorizada expresamente para la fusión; no debe registrarse como revisión completada.

| Integrante | S3 | Rama personal prevista | Revisor | PR | Evidencia de mutación | Tests ejecutados |
|---|---|---|---|---|---|---|
| Nicol | **Front: Login** | `test/s3-front-nicol` | David | [PR #167](../../pull/167) ✅ fusionado | ✅ [rojo](../../actions/runs/42426452094) / [verde](../../actions/runs/42426526944) | ✅ 4/4; [CI normal aprobada](../../actions/runs/42495204677); revisión formal de David no registrada |
| David | **Front: Registro** | `test/s3-front-david` | Dayana | [PR #170](../../pull/170) ✅ fusionado | [`S3_DAVID_MUTACION_REGISTRO.md`](../docs-testing/reportes/S3_DAVID_MUTACION_REGISTRO.md) | ✅ 9 pruebas; [CI aprobada](../../actions/runs/41941349216); revisión formal de Dayana no registrada |
| Dayana | **Front: NotificacionesPanel** | `test/s3-front-dayana` | Edith | [PR #168](../../pull/168) ✅ fusionado | [`S3_DAYANA_MUTACION_NOTIFICACIONES.md`](../docs-testing/reportes/S3_DAYANA_MUTACION_NOTIFICACIONES.md): rojo 1/7, verde 7/7 | ✅ 7/7; [CI aprobada](../../actions/runs/41854161983); aprobación de Edith |
| Edith | **Front: RecuperarContrasena** | `test/s3-front-edith` | Nicol | ✅ [PR #166](../../pull/166) fusionado | ✅ Documentada, con log rojo/verde abajo | ✅ 5/5; [CI aprobada](../../actions/runs/41499971501); aprobación de Nicol |

### Nicol — pruebas del componente Login (PR #167)

- **Cuatro escenarios nuevos:** acceso por correo y navegación al dashboard, botón deshabilitado durante autenticación pendiente, bloqueo previo por demasiados intentos y mensaje de intentos restantes ante credenciales incorrectas.
- **Interacciones y aislamiento:** `user-event`, consultas por rol/etiqueta, `renderConProviders`, mocks de API/Supabase y sesión simulada sin credenciales reales. No se modifica código de producción.
- **Mutación ejecutada y detectada (2026-11-07):** en una rama aislada de ensayo `test/s3-mutacion-login-nicol-evidencia`, se sustituyó temporalmente `if (estadoPrevio?.bloqueado)` por `if (estadoPrevio?.bloqueado && identificador.length === 0)` en `frontend/src/pages/Login.tsx`. La condición evita indebidamente el bloqueo con un identificador válido y conserva lint/TypeScript. No se alteró el código de producción del PR #167.
- **Evidencia roja:** [GitHub Actions run 42426452094](../../actions/runs/42426452094) (`pnpm exec vitest run tests/unit/pages/Login.test.tsx`): **1 test falló, 3 pasaron**. Falló `bloquea el envío ante demasiados intentos y muestra una alerta accesible`, con `TestingLibraryElementError: Unable to find role="alert"`. Lint y build aprobaron.
- **Evidencia verde:** se restauró la condición correcta. [GitHub Actions run 42426526944](../../actions/runs/42426526944): **4 tests pasaron (4/4)**, lint y build aprobaron. Solo el workflow del PR temporal se configuró para ejecutar la suite específica.
- **Verificación final del PR #167:** CI normal del último commit [42495204677](../../actions/runs/42495204677) completada con éxito (incluye cobertura completa, lint, build y typecheck específico de Login). La revisión formal independiente de David no quedó registrada antes de la fusión, que se realizó por instrucción expresa; la prueba aislada roja/verde sigue documentada.

**Responsable adicional de backend:** Edith, por haber tenido Front en S2. Mínimo del reto: 40 % en ambas capas. Los umbrales heredados superiores no se reducen (backend 84 %; frontend 76,73 % sentencias, 64,85 % ramas, 73,89 % funciones y 79,59 % líneas).

**Verificación de backend (Edith, 2026-11-02):** corrí `pytest -v --cov=app --cov-fail-under=84` sobre el backend actual: **84,87 %** global, 419 tests pasaron, 10 omitidos. Sin retroceso respecto al 84 % heredado — no hicieron falta pruebas unitarias adicionales esta semana.

### Edith — detalle del componente `RecuperarContrasena`

- **El archivo de tests ya existía** (2 pruebas previas: envío exitoso y error de Supabase) — se conservaron tal cual, sin renombrar, y se agregaron **3 escenarios nuevos** encima (cumple el mínimo de 3 nuevas):
  1. Validación nativa: no llama a Supabase si el campo de correo está vacío.
  2. Botón deshabilitado y texto "Enviando…" mientras espera la respuesta.
  3. Navegación real a `/restablecer-contrasena` con el correo en el `state`, al dar clic en "Ya tengo mi código" (sin mockear `useNavigate`: se renderizan ambas rutas con `MemoryRouter`/`Routes` reales).
- **Consultas accesibles:** `getByLabelText` y `getByRole`, sin `getByTestId`.
- **Mutante (sobre un escenario nuevo):** se quitó el `state: { email }` del `navigate(...)` al hacer clic en "Ya tengo mi código". El test nuevo de navegación falló como se esperaba (mostró "sin correo" en vez del email real). Se restauró el `state` y los 5 tests vuelven a pasar.
- **Evidencia roja (mutante activo: `navigate('/restablecer-contrasena')` sin `state`), comando `pnpm vitest run tests/unit/pages/RecuperarContrasena.test.tsx`, corrida 2026-11-02 13:21:22:**
  ```
  <body>
    <div>
      <p>Paso del código para: sin correo</p>
    </div>
  </body>
  ❯ tests/unit/pages/RecuperarContrasena.test.tsx:134:25
     134|     expect(await screen.findByText('Paso del código para: nombre.apell…
        |                         ^
   Test Files  1 failed (1)
        Tests  1 failed | 4 passed (5)
  ```
- **Evidencia verde (mutante restaurado), misma corrida 2026-11-02 13:21:44:**
  ```
  Test Files  1 passed (1)
       Tests  5 passed (5)
  ```
- **Reproducible por cualquiera:** quitar `{ state: { email } }` del `navigate(...)` en el botón "Ya tengo mi código" (`src/pages/RecuperarContrasena.tsx`) y correr el mismo comando — debe fallar solo el test de navegación.

| Medida de cierre S3 | Cobertura real | Umbral aprobado | PR de umbrales |
|---|---|---|---|
| Frontend — sentencias | Pendiente | Pendiente | Pendiente |
| Frontend — ramas | Pendiente | Pendiente | Pendiente |
| Frontend — funciones | Pendiente | Pendiente | Pendiente |
| Frontend — líneas | Pendiente | Pendiente | Pendiente |
| Backend — global | Pendiente | Pendiente | Pendiente |

**Flujo:** cuatro PR individuales hacia `semana-3`, revisados y fusionados; después **quinto PR exclusivo de umbrales** hacia `semana-3`, con GitHub Actions verde. Evidencia individual: al menos 3 tests de componente, uno con `user-event`, uno de estado no feliz y un mutante detectado y restaurado.
