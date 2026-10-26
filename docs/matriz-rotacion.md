# Matriz de rotación — Sprint de Testing SIHS (2 semanas)

Equipo: Nicol, Dayana, Edith, David · ADSO SENA · actualización 2026-10-25

Fuente de verdad del estado real del sprint (ver `_Docs/` para el resto de
documentación del proyecto). Cada quien actualiza su propia fila al abrir
su PR — no se marca "hecho" hasta que el PR está abierto y pasando.

## Semana 1 (11–18 oct) — Fundamentos: E2E + unitarias + CI con umbral

| Integrante | Entregable individual | Rama | Estado | Evidencia |
|---|---|---|---|---|
| David | E2E — Login con panel por rol | `test/e2e-login-panel-por-rol` | ✅ Consolidado en `e2e/tests/login.spec.ts` en `fix/semana-1-cierre`; pendiente de revisión/merge del PR de cierre | [`e2e/tests/login.spec.ts`](../e2e/tests/login.spec.ts) |
| Dayana | E2E — Publicar horario | `test/semana-1-publicar-horario` | ✅ Hecho, mergeado a `develop` | [`e2e/tests/publicar-horario.spec.ts`](../e2e/tests/publicar-horario.spec.ts) |
| Edith | E2E — Validación de login vacío + 4 unitarias de `formatearTiempoRestante` | `test/semana-1-login-validacion` | ✅ Hecho, mergeado a `develop` | [`e2e/tests/login-validacion.spec.ts`](../e2e/tests/login-validacion.spec.ts) |
| Nicol | E2E — Asistente de horarios (IA) | `test/semana-1-e2e-asistente-ia` | 🔶 En progreso — la versión en `develop` está en Vitest, no en Playwright; se está rehaciendo en `fix/semana-1-cierre` | — |

### Entregables grupales S1

| Entregable | Responsable | Estado |
|---|---|---|
| Migración npm → pnpm | David | ✅ Mergeado a `develop` (PR #137) |
| Postgres de pruebas en Docker — local | Dayana | ✅ Hecho (`backend/tests/docker-compose.postgres.yml`) |
| Carpeta `e2e/` con Playwright | Los 4 | ✅ Consolidada en `e2e/`; el test de David está en `e2e/tests/` |
| `docs/matriz-rotacion.md` | Edith | ✅ Actualizado hoy (24 oct) en `fix/semana-1-cierre` |
| `.github/pull_request_template.md` | Dayana | 🔶 Copiada desde la plantilla del bootcamp; lista en la rama, pendiente de PR activo |
| Línea base de cobertura (back + front) | David + Dayana | ✅ Herramientas instaladas y medidas el 25 oct; resultados detallados abajo |
| `ci.yml` con umbral 30% bloqueante | Los 4 | 🔶 Configurado para frontend y backend; pendiente de validación en CI |

## Semana 2 (18–25 oct) — Rotación en paralelo + CI completo + cierre

| Integrante | Capa | Estado |
|---|---|---|
| David | Dobles de prueba (Gemini + Supabase) + Playwright a fondo | Sin empezar |
| Dayana | Integración con Postgres real en Docker | Sin empezar |
| Edith | Componentes React (RTL) — `HorarioEditor.tsx` / `GridHorario.tsx` | Sin empezar |
| Nicol | Pruebas de API (contrato HTTP) — `/api/v1/asistencias` | Sin empezar |

### Revisión cruzada — semana 2

| Autor | → Revisor |
|---|---|
| David | → Dayana |
| Dayana | → Edith |
| Edith | → Nicol |
| Nicol | → David |

## Cobertura — piso por semana (regla de trinquete, nunca baja)

| Semana 1 | Semana 2 |
|---|---|
| 30% | 60% |

Línea base real medida el 25 oct 2026:

| Módulo | Métrica informada | Resultado | Pruebas |
|---|---|---:|---|
| Frontend | Líneas | 79.94% (3373/4219) | 363 pasaron en 53 archivos |
| Backend (`app`) | Sentencias | 84.40% (5011/5937) | 412 pasaron, 10 omitidas |

Herramientas: `@vitest/coverage-v8` 4.1.11 y `pytest-cov` 7.0.0. CI bloquea
regresiones por debajo del 30%; en Vitest el piso aplica a sentencias, ramas,
funciones y líneas. Los cambios están en revisión en la rama de cierre.

## Estado real verificado del repo (2026-10-24)

| Dato | Valor |
|---|---|
| Tests E2E en `develop` | 4 (`e2e/tests/login-validacion.spec.ts`, `publicar-horario.spec.ts`, `horarios-flujos.spec.ts` + el de David pendiente de mover desde `frontend/e2e/`) |
| Test E2E de Nicol (asistente IA) | Vitest en `develop`, Playwright en progreso en `fix/semana-1-cierre` |
| Umbral de cobertura en CI | Configurado al 30% para frontend (sentencias, ramas, funciones y líneas) y backend (`app`); ejecución local validada |
| Rama de cierre de Semana 1 | `fix/semana-1-cierre` (creada 2026-10-24 desde `develop`) |
