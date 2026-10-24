# Matriz de rotación — Sprint de Testing SIHS (2 semanas)

Equipo: Nicol, Dayana, Edith, David · ADSO SENA · cierra 2026-10-25

Fuente de verdad del estado real del sprint (ver `_Docs/` para el resto de
documentación del proyecto). Cada quien actualiza su propia fila al abrir
su PR — no se marca "hecho" hasta que el PR está abierto y pasando.

## Semana 1 (11–18 oct) — Fundamentos: E2E + unitarias + CI con umbral

| Integrante | Entregable individual | Rama | Estado | Evidencia |
|---|---|---|---|---|
| David | E2E — Login exitoso | — | Pendiente | — |
| Dayana | E2E — Publicar horario | — | Pendiente | — |
| Edith | E2E — Validación de login vacío + 4 unitarias de `formatearTiempoRestante` | `test/semana-1-login-validacion` | ✅ Listo, push hecho, PR sin abrir | [commit 988fe6b](../../commit/988fe6b) |
| Nicol | E2E — Asistente de horarios (IA) | `test/semana-1-e2e-asistente-ia` | Código en rama, push hecho, PR sin abrir | — |

### Entregables grupales S1

| Entregable | Responsable | Estado |
|---|---|---|
| Migración npm → pnpm | David | ✅ Mergeado a `develop` (PR #137) |
| Postgres de pruebas en Docker — local | Dayana | Pendiente |
| Carpeta `e2e/` con Playwright | Los 4 | ✅ Creada (en `test/semana-1-login-validacion`, pendiente de integrar a `semana-1`) |
| `docs/matriz-rotacion.md` | Edith | ✅ Este archivo |
| `.github/pull_request_template.md` | Nicol | Pendiente |
| Línea base de cobertura (back + front) | David + Dayana | Pendiente |
| `ci.yml` con umbral 30% bloqueante | Los 4 | Pendiente |

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

Línea base real: **aún no registrada** (pendiente del entregable "Línea
base de cobertura" de David + Dayana).

## Estado real verificado del repo (2026-10-11)

| Dato | Valor |
|---|---|
| Archivos de test — backend | 55 |
| Archivos de test — frontend | 48 (ahora 49 con `tiempoRestante.test.ts`) |
| Tests E2E en `main`/`develop` | 0 (2 en rama `test/semana-1-login-validacion`, pendientes de integrar) |
| Umbral de cobertura en CI | ninguno todavía |
