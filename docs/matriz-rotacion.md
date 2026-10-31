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
