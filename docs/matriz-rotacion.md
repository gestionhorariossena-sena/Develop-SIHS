# Matriz de rotación — Sprint de Testing SIHS (2 semanas)

Equipo: Nicol, Dayana, Edith, David · ADSO SENA · actualización 2026-10-25

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
| `.github/pull_request_template.md` | Dayana | 🔶 Copiada desde la plantilla del bootcamp; lista en la rama, pendiente de PR activo |
| Línea base de cobertura (back + front) | David + Dayana | ✅ Medida — backend: 84,40% de sentencias (412 pasaron, 10 omitidas); frontend: 79,59% de líneas (363 pasaron) |
| Umbral de cobertura en CI | Los 4 | ⚠️ Configurado al 30% en la rama remota; confirmar si se conserva en S1 o se difiere a S2 según el acuerdo previo |

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

## Cobertura — línea base en S1 y umbral bloqueante en S2

| Semana 1 | Semana 2 |
|---|---|
| Medir y registrar línea base; sin bloqueo | 60% bloqueante |

Línea base registrada: **backend 84%** (`pytest --cov=app`; 412 pasaron, 10
omitidas) y **frontend 79,59% de líneas** (`pnpm test:coverage`; 363 pasaron;
76,73% de sentencias). El umbral bloqueante del 60% se incorpora en S2.

**Discrepancia por confirmar antes del merge:** los commits remotos configuraron
un umbral bloqueante del 30% en CI para frontend y backend; el acuerdo previo
era no bloquear en S1 e introducir 60% en S2. La configuración remota se
conserva sin cambios hasta que el equipo confirme cuál política aplica.

## Estado real verificado del repo (2026-10-26)

| Dato | Valor |
|---|---|
| Archivos E2E en la rama de cierre | 4 tras separar el test de asistente IA para su PR: `login.spec.ts`, `login-validacion.spec.ts`, `publicar-horario.spec.ts`, `horarios-flujos.spec.ts` |
| Test E2E de Nicol (asistente IA) | En PR separado; la versión Vitest sigue como test de componente |
| Herramientas de cobertura | `@vitest/coverage-v8` y `pytest-cov` instaladas en sus respectivos proyectos |
| Umbral de cobertura en CI | 30% configurado en la rama remota; política pendiente de confirmación con el equipo |
| Rama de cierre de Semana 1 | `fix/semana-1-cierre` (creada 2026-10-24 desde `develop`) |
