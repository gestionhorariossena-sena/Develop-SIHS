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
| Nicol | API | **Front — contrato** | `/api/v1/notificaciones` | `test/s4-front-contrato-nicol` | David | [PR #178](../../pull/178) | ✅ [Rojo: 1/6 falla](../../actions/runs/42853071413) / [Verde: 6/6](../../actions/runs/42853622635) | ✅ 6 HTTP nuevas; [CI completa verde](../../actions/runs/42853926700): backend 425 passed y 84,21 %, frontend 378 passed; [David aprobó](../../pull/178#pullrequestreview-5852665098) |
| David | CI (transversal) | **E2E — seguridad** | `/api/v1/fichas` + errores generales | `test/s4-e2e-seguridad-david` | Edith | [#177](https://github.com/gestionhorariossena-sena/Develop-SIHS/pull/177) | Se quitó temporalmente `require_admin` del `POST /fichas/`; el test esperaba `403` y recibió `200` (rojo). Se restauró el control y la prueba volvió a pasar (verde). | 4 pruebas S4 en verde; suite relacionada: 31 passed. |
| Dayana | BD | **API — CRUD** | `/api/v1/horarios` | `test/s4-api-horarios-dayana` | Nicol | Pendiente | Pendiente | Pendiente |
| Edith | Front | **BD — datos** | `/api/v1/solicitudes-acceso` | `test/s4-bd-datos-edith` | Dayana | [PR #175](../../pull/175) | ✅ rojo 2/4 falló, verde 4/4 (evidencia local, ver detalle abajo) | ✅ 4/4 en verde; suite completa backend 423 passed / 10 skipped, cobertura 84,87 % |

**Nota:** David tuvo CI en S2, no una capa API/BD/Front/E2E; se le asigna E2E como nueva especialización de S4. El `409` es un ejemplo del reto, no un código universal; `solicitudes-acceso` actualmente usa `400` para duplicados pendientes. Las correcciones de contratos deberán coordinarse en PR.

### Edith — detalle de evidencia (BD / datos, `/api/v1/solicitudes-acceso`)

- **Cuatro escenarios nuevos** en `backend/tests/test_s4_datos_solicitudes_edith.py`, sin repetir los casos ya cubiertos por `test_solicitudes_acceso.py`: contrato completo de `SolicitudAccesoResponse` con el servicio aislado (monkeypatch) + `Content-Type` real; dedupe por correo aunque la segunda solicitud pida un rol distinto; `estado=pendiente` sin mezclar aprobada/rechazada (las tres a la vez); `estado` inválido → `422` probando que `SolicitudAccesoService.listar` nunca se invoca (sin acceso a BD real).
- **Contrato de duplicados verificado, no cambiado a ciegas:** se confirmó que el endpoint real usa `400` con `detail` (no `409`, que era solo el ejemplo del reto) y se documentó así en las pruebas.
- **Mutación ejecutada y detectada (local, 2026-11-08):** en `backend/app/services/solicitud_acceso_service.py`, se invirtió temporalmente la condición de dedupe: `if SolicitudAccesoRepository.obtener_pendiente_por_email(db, data.email):` → `if not SolicitudAccesoRepository.obtener_pendiente_por_email(db, data.email):`. No se tocó ningún otro archivo ni se subió el mutante en ningún commit.
- **Evidencia roja:** `pytest tests/test_s4_datos_solicitudes_edith.py -v` con la condición invertida → **2 tests fallaron** (`test_email_duplicado_bloquea_aunque_cambie_el_rol_solicitado`, `test_filtro_estado_pendiente_no_mezcla_aprobadas_ni_rechazadas`), 2 pasaron sin verse afectados.
- **Evidencia verde:** se restauró la condición original (`git checkout -- app/services/solicitud_acceso_service.py`, diff limpio verificado) y se corrió el mismo comando → **4/4 pasaron**.
- **Verificación adicional:** suite completa del backend (`pytest -v --cov=app --cov-fail-under=84`) → 423 passed, 10 skipped, cobertura 84,87 % (umbral heredado de 84 % conservado, no reducido).

| Medida de cierre S4 | Cobertura real | Umbral aprobado | Evidencia/PR |
|---|---|---|---|
| Frontend — sentencias | Pendiente | Pendiente | Pendiente |
| Frontend — ramas | Pendiente | Pendiente | Pendiente |
| Frontend — funciones | Pendiente | Pendiente | Pendiente |
| Frontend — líneas | Pendiente | Pendiente | Pendiente |
| Backend — global | Pendiente | Pendiente | Pendiente |

**Cierre requerido:** ≥4 pruebas nuevas de API y un mutante rojo/verde por integrante; cuatro PR revisados y fusionados a `semana-4`; posterior PR exclusivo de umbrales sin reducir los heredados y CI verde. Véase [README S4](../README.md).
