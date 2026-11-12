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
| Nicol | API / servicios (backend, pytest) | `test/s2-api-nicol` | Edith | ✅ Fusionado | #163 |
| David | CI + pruebas unitarias | `test/s2-ci-david` | Nicol | ✅ Fusionado | #165 |
| Dayana | BD / modelos (backend, pytest) | `test/s2-bd-dayana` | David | ✅ Fusionado | #164 |
| Edith | Frontend (Vitest) + documentación | `test/s2-front-edith` | Dayana | ✅ Fusionado | #162 |

### Edith — detalle del trabajo de frontend

- **Unidad probada:** `opcionesFichaAmbiente` e `indexarPorInstructor`, en `frontend/src/components/horario/indexarHorarios.ts` — deduplican y ordenan las fichas/ambientes/instructores que alimentan los `<select>` de filtro en Instructores, Fichas y Ambientes. No estaba cubierta por ningún test existente.
- **Pruebas (4, con valores límite):** deduplicación + orden alfabético; exclusión de `fichaCodigo`/`ambienteNombre` nulos; lista vacía cuando no hay horarios; agrupación correcta de fichas/ambientes por instructor.
- **Mutante:** se quitó el `.sort()` final de `opcionesFichaAmbiente` (`fichas: [...fichas]` en vez de `fichas: [...fichas].sort()`). El test "ordena alfabéticamente" falló como se esperaba (`['3037904','2912345']` en vez de `['2912345','3037904']`). Se restauró el `.sort()` y los 4 tests vuelven a pasar.
- **Evidencia:** `frontend/tests/unit/components/horario/indexarHorarios.test.ts`, 4/4 tests en verde con `pnpm vitest run tests/unit/components/horario/indexarHorarios.test.ts`.

### Entregables grupales S2

- [x] Cuatro suites de tests unitarios aportadas por el equipo mediante PR #162–#165 (revisar número de casos en cada suite).
- [x] Evidencias individuales de mutación incorporadas en los PR y documentos; comprobar registros rojo/verde donde corresponda.
- [x] Cuatro PR individuales #162–#165 fusionados en `semana-2` (GitHub CI verde); las aprobaciones formales no figuran en la API de revisiones.
- [x] Workflow `.github/workflows/tests.yml` incorporado (David).
- [ ] Protección de rama activa, o regla manual registrada aquí.
- [ ] Umbrales ≥30% y sin retroceso respecto a la línea base de S1 (tabla de arriba).
- [x] Integración de `semana-2` → `develop` mediante merge con resolución conservadora de documentación.

### Cobertura S2 (se completa cuando los 4 PR estén integrados en `semana-2`)

Pendiente de medir sobre `semana-2` completa — no reemplaza la línea base de S1 de arriba, la compara.

## Semana 3 — Tests de componentes Front (integrada en develop)

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
**Flujo:** los cuatro PR individuales se fusionaron en `semana-3` y sus cambios se integraron en `develop`. El quinto PR de umbrales queda como paso separado pendiente de evidencia y validación. Evidencia individual: al menos 3 tests de componente, uno con `user-event`, uno de estado no feliz y un mutante detectado y restaurado.
