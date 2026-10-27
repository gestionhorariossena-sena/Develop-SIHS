# Matriz de rotación — Sprint de Testing SIHS (2 semanas)

Equipo: Nicol, Dayana, Edith, David · ADSO SENA · actualización 2026-10-27

Fuente de verdad del estado real del sprint (ver `_Docs/` para el resto de
documentación del proyecto). Cada quien actualiza su propia fila al abrir
su PR — no se marca "hecho" hasta que el PR está abierto y pasando.

## Semana 1 (11–18 oct) — Fundamentos: E2E + unitarias + línea base de cobertura

| Integrante | Entregable individual | Rama | Estado | Evidencia |
|---|---|---|---|---|
| David | E2E — Login con panel por rol | `fix/semana-1-cierre` | ✅ Hecho en la rama de cierre: test centralizado en `e2e/tests/`; configuración duplicada eliminada | [commit e7bcc83](../../commit/e7bcc83) |
| Dayana | E2E — Publicar horario | `test/semana-1-publicar-horario` | ✅ Hecho, mergeado a `develop` | [`e2e/tests/publicar-horario.spec.ts`](../e2e/tests/publicar-horario.spec.ts) |
| Edith | E2E — Validación de login vacío + 4 unitarias de `formatearTiempoRestante` | `test/semana-1-login-validacion` | ✅ Hecho, mergeado a `develop` | [`e2e/tests/login-validacion.spec.ts`](../e2e/tests/login-validacion.spec.ts) |
| Nicol | E2E — Asistente de horarios (IA) | `test/semana-1-e2e-asistente-playwright` | 🔶 En progreso por PR separado; la versión Vitest sigue como test de componente | — |

### Entregables grupales S1

| Entregable | Responsable | Estado |
|---|---|---|
| Migración npm → pnpm | David | ✅ Mergeado a `develop` (PR #137) |
| Postgres de pruebas en Docker — local | Dayana | ✅ Hecho (`backend/tests/docker-compose.postgres.yml`) |
| Carpeta `e2e/` con Playwright | Los 4 | ✅ Consolidada en `e2e/`; el test de David está en `e2e/tests/` |
| `docs/matriz-rotacion.md` | Edith | ✅ Actualizado hoy (24 oct) en `fix/semana-1-cierre` |
| `.github/pull_request_template.md` | Dayana | 🔶 Copiada desde la plantilla del bootcamp; incluida en el PR #153, pendiente de revisión |
| Línea base de cobertura (back + front) | David + Dayana | ✅ Medida — backend: 84,40% local y 84,07% en CI (412 pasaron, 10 omitidas); frontend: 79,59% líneas, 76,73% sentencias, 64,89% ramas y 73,89% funciones en CI (363 pasaron) |
| Umbral de cobertura en CI | Los 4 | ✅ Línea base de S1 configurada: backend 84%; frontend 76,73% sentencias, 64,89% ramas, 73,89% funciones y 79,59% líneas |

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

## Cobertura — línea base de S1 como umbral bloqueante

| Semana 1 | Semana 2 |
|---|---|
| Medir, registrar y fijar la línea base como umbral bloqueante en CI | Revisar el umbral de acuerdo con el objetivo del plan para S2 |

Línea base registrada en CI: **backend 84,07%** (`pytest --cov=app`; 412
pasaron, 10 omitidas) y **frontend 79,59% de líneas** (`pnpm test:coverage`;
363 pasaron). CI fija como umbral backend **84%** y, en frontend, **76,73%**
de sentencias, **64,89%** de ramas, **73,89%** de funciones y **79,59%** de
líneas. Los umbrales de frontend son específicos por métrica porque Vitest
informa porcentajes distintos para cada una.

El umbral genérico del **30%** se había configurado por error en el commit
`94f71d0`: ese piso no representaba la línea base de S1. Se reemplaza con los
valores medidos de S1; no se cambia ningún otro umbral de futuro sin verificar
el objetivo correspondiente del plan.

## Estado real verificado del repo (2026-10-27)

| Dato | Valor |
|---|---|
| Archivos E2E en la rama de cierre | 4 tras separar el test de asistente IA para su PR: `login.spec.ts`, `login-validacion.spec.ts`, `publicar-horario.spec.ts`, `horarios-flujos.spec.ts` |
| Test E2E de Nicol (asistente IA) | En PR separado; la versión Vitest sigue como test de componente |
| Herramientas de cobertura | `@vitest/coverage-v8` y `pytest-cov` instaladas en sus respectivos proyectos |
| Umbral de cobertura en CI | Línea base S1 configurada: backend 84%; frontend 76,73% sentencias, 64,89% ramas, 73,89% funciones y 79,59% líneas |
| Rama de cierre de Semana 1 | `fix/semana-1-cierre` (creada 2026-10-24 desde `develop`) |
