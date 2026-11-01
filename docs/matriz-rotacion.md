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

## Semana 2 — Pruebas unitarias y mutación por capa

Rama de trabajo: `semana-2`. Cada integrante parte de ahí, abre su rama personal, hace un único PR hacia `semana-2` con revisión cruzada, y al final se hace un solo merge `semana-2` → `develop`.

| Integrante | Capa | Rama personal | Revisor cruzado | Estado | PR |
|---|---|---|---|---|---|
| Nicol | API / servicios (backend, pytest) | `test/s2-api-nicol` | Edith | Pendiente | — |
| David | CI + pruebas unitarias | `test/s2-ci-david` | Nicol | Pendiente | — |
| Dayana | BD / modelos (backend, pytest) | `test/s2-bd-dayana` | David | Pendiente | — |
| Edith | Frontend (Vitest) + documentación | `test/s2-front-edith` | Dayana | ✅ Hecho | — (pendiente de abrir PR) |

### Edith — detalle del trabajo de frontend

- **Unidad probada:** `opcionesFichaAmbiente` e `indexarPorInstructor`, en `frontend/src/components/horario/indexarHorarios.ts` — deduplican y ordenan las fichas/ambientes/instructores que alimentan los `<select>` de filtro en Instructores, Fichas y Ambientes. No estaba cubierta por ningún test existente.
- **Pruebas (4, con valores límite):** deduplicación + orden alfabético; exclusión de `fichaCodigo`/`ambienteNombre` nulos; lista vacía cuando no hay horarios; agrupación correcta de fichas/ambientes por instructor.
- **Mutante:** se quitó el `.sort()` final de `opcionesFichaAmbiente` (`fichas: [...fichas]` en vez de `fichas: [...fichas].sort()`). El test "ordena alfabéticamente" falló como se esperaba (`['3037904','2912345']` en vez de `['2912345','3037904']`). Se restauró el `.sort()` y los 4 tests vuelven a pasar.
- **Evidencia:** `frontend/tests/unit/components/horario/indexarHorarios.test.ts`, 4/4 tests en verde con `pnpm vitest run tests/unit/components/horario/indexarHorarios.test.ts`.

### Entregables grupales S2

- [ ] 12 tests unitarios nuevos (3 por persona) — 4/12 hechos (Edith).
- [ ] 4 mutaciones manuales documentadas — 1/4 hecha (Edith).
- [ ] 4 PR individuales con revisión cruzada hacia `semana-2`.
- [ ] `.github/workflows/tests.yml` con evidencia de CI rojo → verde (David).
- [ ] Protección de rama activa, o regla manual registrada aquí.
- [ ] Umbrales ≥30% y sin retroceso respecto a la línea base de S1 (tabla de arriba).
- [ ] Un solo merge final `semana-2` → `develop`.

### Cobertura S2 (se completa cuando los 4 PR estén integrados en `semana-2`)

Pendiente de medir sobre `semana-2` completa — no reemplaza la línea base de S1 de arriba, la compara.
