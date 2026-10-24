# Matriz de rotación — Sprint de Testing SIHS (2 semanas)

Equipo: Nicol, Dayana, Edith, David · ADSO SENA · cierra 2026-10-25

Fuente de verdad del estado real del sprint (ver `_Docs/` para el resto de
documentación del proyecto). Cada quien actualiza su propia fila al abrir
su PR — no se marca "hecho" hasta que el PR está abierto y pasando.

## Semana 1 (11–18 oct) — Fundamentos: E2E + unitarias + CI con umbral

| Integrante | Entregable individual | Rama | Estado | Evidencia |
|---|---|---|---|---|
| David | E2E — Login con panel por rol | `test/e2e-login-panel-por-rol` | ✅ Hecho, mergeado a `develop`. Moviendo de `frontend/e2e/` a `e2e/tests/` en `fix/semana-1-cierre` | [commit dd4bcd8](../../commit/dd4bcd8) |
| Dayana | E2E — Publicar horario | `test/semana-1-publicar-horario` | ✅ Hecho, mergeado a `develop` | [`e2e/tests/publicar-horario.spec.ts`](../e2e/tests/publicar-horario.spec.ts) |
| Edith | E2E — Validación de login vacío + 4 unitarias de `formatearTiempoRestante` | `test/semana-1-login-validacion` | ✅ Hecho, mergeado a `develop` | [`e2e/tests/login-validacion.spec.ts`](../e2e/tests/login-validacion.spec.ts) |
| Nicol | E2E — Asistente de horarios (IA) | `test/semana-1-e2e-asistente-ia` | ✅ Hecho en Playwright (3 tests, en verde) en `fix/semana-1-cierre` | [`e2e/tests/asistente-ia.spec.ts`](../e2e/tests/asistente-ia.spec.ts) |

### Entregables grupales S1

| Entregable | Responsable | Estado |
|---|---|---|
| Migración npm → pnpm | David | ✅ Mergeado a `develop` (PR #137) |
| Postgres de pruebas en Docker — local | Dayana | ✅ Hecho (`backend/tests/docker-compose.postgres.yml`) |
| Carpeta `e2e/` con Playwright | Los 4 | ✅ Integrada a `develop`. Queda por consolidar el duplicado de `frontend/e2e/` (en `fix/semana-1-cierre`) |
| `docs/matriz-rotacion.md` | Edith | ✅ Actualizado hoy (24 oct) en `fix/semana-1-cierre` |
| `.github/pull_request_template.md` | Dayana | 🔶 En progreso en `fix/semana-1-cierre` |
| Línea base de cobertura (back + front) | David + Dayana | ❌ Pendiente — todavía no está instalada la herramienta de cobertura: falta `@vitest/coverage-v8` en frontend y `pytest-cov` en backend. Sin eso no hay número real que registrar |
| `ci.yml` con umbral 30% bloqueante | Los 4 | ❌ Pendiente — depende de que primero se registre la línea base |

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

Línea base real: **aún no registrada** — falta instalar `@vitest/coverage-v8`
(frontend) y `pytest-cov` (backend) antes de poder correrla. Pendiente de
David + Dayana.

## Estado real verificado del repo (2026-10-24)

| Dato | Valor |
|---|---|
| Tests E2E en `develop` | 4 (`e2e/tests/login-validacion.spec.ts`, `publicar-horario.spec.ts`, `horarios-flujos.spec.ts` + el de David pendiente de mover desde `frontend/e2e/`) |
| Test E2E de Nicol (asistente IA) | Playwright en `e2e/tests/asistente-ia.spec.ts` (3 tests); la versión Vitest sigue como test de componente |
| Umbral de cobertura en CI | ninguno todavía |
| Rama de cierre de Semana 1 | `fix/semana-1-cierre` (creada 2026-10-24 desde `develop`) |
