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

> **Estado:** reparto acordado y registrado en `semana-3`; los tests, mutaciones, revisiones, PR y coberturas reales **todavía no se han ejecutado**. Actualizar esta sección con evidencias al terminar cada entrega.

| Integrante | S3 | Rama personal prevista | Revisor | PR | Evidencia de mutación | Tests ejecutados |
|---|---|---|---|---|---|---|
| Nicol | **Front: Login** | `test/s3-front-nicol` | David | Pendiente | Pendiente | Pendiente |
| David | **Front: Registro** | `test/s3-front-david` | Dayana | Pendiente | Pendiente | Pendiente |
| Dayana | **Front: NotificacionesPanel** | `test/s3-front-dayana` | Edith | Pendiente | Pendiente | Pendiente |
| Edith | **Front: RecuperarContrasena** | `test/s3-front-edith` | Nicol | Pendiente | Pendiente | Pendiente |

**Responsable adicional de backend:** Edith, por haber tenido Front en S2. Mínimo del reto: 40 % en ambas capas. Los umbrales heredados superiores no se reducen (backend 84 %; frontend 76,73 % sentencias, 64,85 % ramas, 73,89 % funciones y 79,59 % líneas).

| Medida de cierre S3 | Cobertura real | Umbral aprobado | PR de umbrales |
|---|---|---|---|
| Frontend — sentencias | Pendiente | Pendiente | Pendiente |
| Frontend — ramas | Pendiente | Pendiente | Pendiente |
| Frontend — funciones | Pendiente | Pendiente | Pendiente |
| Frontend — líneas | Pendiente | Pendiente | Pendiente |
| Backend — global | Pendiente | Pendiente | Pendiente |

**Flujo:** cuatro PR individuales hacia `semana-3`, revisados y fusionados; después **quinto PR exclusivo de umbrales** hacia `semana-3`, con GitHub Actions verde. Evidencia individual: al menos 3 tests de componente, uno con `user-event`, uno de estado no feliz y un mutante detectado y restaurado.


## Semana 4 — API desde cuatro ángulos (planificación)

> **Estado:** reparto registrado; ningún test, mutación ni revisión de S4 se considera implementado por este documento. Rama base: `semana-4`. Piso 50 % para ambas capas, conservando todos los umbrales anteriores superiores.

| Integrante | Capa S2 | S4 (ángulo) | Endpoints asignados | Rama personal | Revisor | PR | Mutación | Tests |
|---|---|---|---|---|---|---|---|---|
| Nicol | API | **Front — contrato** | `/api/v1/notificaciones` | `test/s4-front-contrato-nicol` | David | Pendiente | Pendiente | Pendiente |
| David | CI (transversal) | **E2E — seguridad** | `/api/v1/fichas` + errores generales | `test/s4-e2e-seguridad-david` | Edith | Pendiente | Pendiente | Pendiente |
| Dayana | BD | **API — CRUD** | `/api/v1/horarios` | `test/s4-api-horarios-dayana` | Nicol | Pendiente | Pendiente | Pendiente |
| Edith | Front | **BD — datos** | `/api/v1/solicitudes-acceso` | `test/s4-bd-datos-edith` | Dayana | Pendiente | Pendiente | Pendiente |

**Nota:** David tuvo CI en S2, no una capa API/BD/Front/E2E; se le asigna E2E como nueva especialización de S4. El `409` es un ejemplo del reto, no un código universal; `solicitudes-acceso` actualmente usa `400` para duplicados pendientes. Las correcciones de contratos deberán coordinarse en PR.

| Medida de cierre S4 | Cobertura real | Umbral aprobado | Evidencia/PR |
|---|---|---|---|
| Frontend — sentencias | Pendiente | Pendiente | Pendiente |
| Frontend — ramas | Pendiente | Pendiente | Pendiente |
| Frontend — funciones | Pendiente | Pendiente | Pendiente |
| Frontend — líneas | Pendiente | Pendiente | Pendiente |
| Backend — global | Pendiente | Pendiente | Pendiente |

**Cierre requerido:** ≥4 pruebas nuevas de API y un mutante rojo/verde por integrante; cuatro PR revisados y fusionados a `semana-4`; posterior PR exclusivo de umbrales sin reducir los heredados y CI verde. Véase [README S4](../README.md).

## Semana 5 — Dobles de prueba y aislamiento de dependencias

| Integrante | Ángulo S5 | Rama individual | Revisor | PR | Estado S5 |
|---|---|---|---|---|---|
| Nicol | API — SMTP/correo externo | `test/s5-api-correo-nicol` | Dayana | Pendiente | Pendiente |
| David | BD — repositorio como dependencia | `test/s5-bd-repositorios-david` | Nicol | Pendiente | Pendiente |
| Dayana | **E2E — red simulada en Mi horario** | `test/s5-e2e-red-dayana` | Edith | Pendiente | 3 pruebas y mutación en verde local; PR y revisión pendientes |
| Edith | Front — cliente HTTP/MSW | `test/s5-front-msw-edith` | David | Pendiente | Pendiente |

El aporte E2E de Dayana está documentado en [el reporte de Semana 5](../docs-testing/reportes/TESTS_SEMANA_5_E2E_DAYANA.md). Los tres flujos usan `page.route`: caída de API, respuesta vacía y validación HTTP 422; la suite restante no requiere credenciales reales. Esta fila no implica aprobación, merge ni cierre del PR.
