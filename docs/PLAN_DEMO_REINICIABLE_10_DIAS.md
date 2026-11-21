# Plan de demo reiniciable SIHS — 10 días

**Auditoría:** 2026-11-15; decisión de entorno demo actualizada después de la auditoría. **Rama auditada:** `fixes-multiples-nicol` (HEAD inicial `aaa7fcf`, `feat: agregar perspectivas a gestionar horarios`). Este documento describe el estado observable del repositorio; no certifica una base compartida ni un despliegue sin ejecutar las verificaciones indicadas.

## Resultado ejecutivo

SIHS tiene el recorrido técnico central para construir horarios: FastAPI, autenticación Supabase, roles, catálogos, relaciones, creación/edición, detección de cruces, publicación y consulta para instructor/aprendiz. La web contiene las rutas y consumidores principales; Flutter permite login y consulta de horarios publicados.

La demo completa **no está lista todavía**. La decisión operativa es usar durante estos diez días un proyecto/base de datos **Supabase DEMO aislado**, nunca la base institucional ni la compartida. Los bloqueadores P0, en orden, son: suite móvil roja; confirmar y crear ese entorno con sus cuatro cuentas; inventariar sus FKs reales; implementar reset/seed transaccional de sus tablas de aplicación; alta/importación de instructores; y E2E/ensayos. La importación IA existe como previsualización y generación de propuesta, pero requiere configuración real de IA y los bloques se persisten individualmente con `POST /horarios/`.

La rama tenía antes de esta auditoría cambios locales no relacionados en cinco archivos de `frontend/`; se preservaron. No se modificaron `main`, `develop`, código, rutas, ni base de datos.

## Evidencia de arquitectura y cobertura

| Área | Evidencia concreta | Lectura para demo |
|---|---|---|
| Backend | `backend/app/main.py:148-177` registra routers `/api/v1`; `backend/app/api/v1/horarios.py` expone CRUD, validación, auditoría, IA y estado. | Existe API central y health (`GET /api/v1/health`). |
| Autenticación/roles | `frontend/src/pages/Login.tsx`, `frontend/src/services/supabaseClient.ts`, `backend/app/core/supabase_auth.py`, `frontend/src/routes/ProtectedRoute.tsx`. | Supabase autentica; backend vuelve a validar JWT y roles. La protección web por ruta no sustituye la autorización backend. |
| Base/modelo | `backend/app/models/horario.py`, `ficha.py`, `ambiente.py`, `resultado_aprendizaje.py`, `ficha_usuario.py`; esquema base `database/01_creacion.sql:52-329`. | `Horario` referencia jornada, trimestre, ambiente, instructor, ficha y resultado; días usan puente `horario_dia`. |
| Web | Rutas de gestión en `frontend/src/routes/AppRouter.tsx`; pantallas `Ambientes.tsx`, `Fichas.tsx`, `Instructores.tsx`, `NuevoHorario.tsx`, `AsistenteHorarios.tsx`, `HorariosCompletos.tsx`, `AuditoriaCruces.tsx`. | Las pantallas requeridas están presentes, con algunos elementos de vitrina marcados. |
| Móvil | `mobile/lib/services/auth_service.dart`, `horario_service.dart`, `providers/horario_provider.dart`, `screens/home_screen.dart`. | Login Supabase y horario publicado: instructor por `/usuarios/me/horarios`, aprendiz por `/ficha-usuario/mi-horario`. No administra catálogos ni horarios. |
| Pruebas | API: `backend/tests/test_horarios_*.py`, `test_scheduling_generator.py`, `test_importar_datos_reales.py`; web: `frontend/tests/...`; E2E: `e2e/tests/horarios-flujos.spec.ts`, `publicar-horario.spec.ts`; Flutter: `mobile/test/`. | Hay una base relevante, pero falta un contrato E2E de datos demo y reset. |
| Despliegue | `backend/app/main.py:135-146` configura CORS y regex de Vercel; `backend/app/api/v1/health.py`; no se encontró manifiesto de despliegue (`render.yaml`, `vercel.json`, Dockerfile o workflow CI) versionado. | P1: confirmar plataforma, variables y healthcheck del ambiente demo; el repositorio por sí solo no reproduce el despliegue. |

## Matriz de los diez flujos de la demo

| # | Flujo y estado actual | Archivos/endpoints reales | Bloqueador / riesgo | Prioridad |
|---:|---|---|---|---|
| 1 | **Login por roles: parcial verificable.** Login web/móvil usa Supabase; rutas web distinguen Admin/Coordinador/Instructor/Aprendiz y el backend usa `require_roles`. | Web: `Login.tsx`, `AppRouter.tsx`, `ProtectedRoute.tsx`. API: `GET /usuarios/me`, `POST /usuario-rol/asignar`, `GET /usuario-rol/usuario/{id}`; `supabase_auth.py`. | Se requieren cuatro cuentas demo controladas y roles ya asignados. E2E actual solo prueba una cuenta pasada por variables (`e2e/tests/login.spec.ts`). | P0 |
| 2 | **Crear/importar instructores: incompleto.** Hay listado, especialidades y código temporal, no `POST /usuarios` ni importador de instructores. | `GET /usuarios/`, `GET /usuarios/instructores`, `PUT /usuarios/{id}/especialidades`, `POST /usuarios/instructor/codigo/generar`; `Instructores.tsx`, `instructor_service.py`. | La creación de Auth depende de Supabase/registro y no hay flujo admin transaccional de alta/importación, asignación de rol y especialidades. No usar cuentas institucionales reales. | P0 |
| 3 | **Crear ambientes: implementado, condicionado.** Admin crea/edita/elimina; gestión puede leer. | `POST/GET/PUT/DELETE /ambientes`; `ambientes.py`, `ambiente_service.py`, `Ambientes.tsx`; FK `ambientes.idSede` en `01_creacion.sql:194-200`. | Requiere sede demo previa. En `Ambientes.tsx:301,467` hay pestañas/ocupación de mockup pendientes de datos reales; no presentarlas como funcionalidad. | P1 |
| 4 | **Crear fichas y relaciones: parcial.** Admin crea ficha; aprendiz se vincula; currículo tiene programas, guías, competencias y RAP. | `POST /fichas/`, `POST /ficha-usuario/vincular`, CRUD `/programas`, `/guias`, `/competencias-formacion`, `/resultados-aprendizaje`; modelos `ficha.py`, `competencia_formacion.py`, `resultado_aprendizaje.py`. | Crear ficha exige programa y trimestre existentes; horario exige RAP. No hay seed demo determinista que construya el grafo. | P0 |
| 5 | **Horario manual: implementado. Importación/IA: parcial.** Constructor crea bloques reales; asistente recibe Excel, previsualiza y genera propuesta no persistida. | `POST /horarios/`, `POST /horarios/validar`, `/horarios/asistente/importar`, `/asistente/generar-propuesta`; `NuevoHorario.tsx`, `AsistenteHorarios.tsx`, `asistente_horario_service.py`. | IA puede devolver `503` por clave, credenciales, timeout o conexión; la importación no crea fichas faltantes ni guarda propuesta automáticamente (`horarios.py:168-215`). Preparar Excel sintético y camino manual alterno. | P0 |
| 6 | **Asignación instructor/ambiente/ficha/RAP: implementada en el payload de horario.** | `HorarioCreate`/modelo en `schemas/horario.py` y `models/horario.py:38-43`; `POST /horarios/`; selects de `NuevoHorario.tsx`. | Los IDs deben pertenecer al mismo trimestre/ficha según regla de servicio; no hay aislamiento demo que los garantice. | P0 |
| 7 | **Detectar y resolver cruces: implementado con matiz.** Dry-run devuelve 409 y auditoría lista conflictos; crear/editar rechaza 409 salvo `forzar`; el usuario resuelve editando/eliminando/reasignando. | `POST /horarios/validar`, `GET /horarios/auditoria-cruces`, `PUT/DELETE /horarios/{id}`, `AuditoriaCruces.tsx`, `ModalCruce.tsx`, `HorarioService`. | No hay un endpoint específico de “resolver”; `forzar` permite persistir con auditoría, por lo que no debe usarse como resolución demo normal. El constraint `EXCLUDE` de BD está comentado en `database/01_creacion.sql:254`; la barrera principal es de aplicación. | P0 |
| 8 | **Publicar: implementado.** Cambia `publicado` sin borrar y deja auditoría; hay publicación programada. | `PATCH /horarios/{id}/estado`, `POST /publicaciones-programadas/`; `HorariosCompletos.tsx`, `PublicacionesProgramadas.tsx`; `horario.py`. | Confirmar worker para publicación programada y no demostrarla si no está operativa. Publicación manual es el camino P0. | P0 |
| 9 | **Consulta por ficha/instructor/ambiente web y móvil: parcialmente implementada.** Gestión ve relaciones; instructor/aprendiz solo ven publicados propios. | API: `GET /fichas/{id}/horarios`, `/ambientes/{id}/horarios`, `/usuarios/{id}/horarios`, `/usuarios/me/horarios`, `/ficha-usuario/mi-horario`. Web: `MiHorario.tsx`, `MiHorarioAprendiz.tsx`, drawers relacionados. Móvil: `horario_service.dart`. | En móvil no hay consulta administrativa por ficha/ambiente; demostrar consulta móvil como Instructor y Aprendiz. Algunos paneles web son mock: `MiHorario.tsx:481,508`, `MiHorarioAprendiz.tsx:359,380,501`, `Instructores.tsx:333,377,391`. | P1 |
| 10 | **Reiniciar y repetir: no implementado.** Hay borrados CRUD individuales, no reset/seed aislado. La decisión es limpiar solo las tablas de aplicación del proyecto Supabase DEMO aislado. | No existe router/servicio/modelo `demo` o `reset` en `backend/app/api/v1`, `services` o `models`; búsqueda de routers confirma ausencia. | Sin guarda de entorno, un endpoint podría apuntar por error a una base institucional. Auth no participa en la transacción y sus cuentas demo se conservan. | P0 |

## Relaciones y orden seguro de borrado en la base DEMO aislada

Durante estos diez días, el aislamiento de seguridad es el **proyecto Supabase DEMO dedicado**: el reset no se ejecutará contra la base institucional/compartida ni añadirá todavía `demoScenarioId` a todas las tablas. No ejecutar `TRUNCATE`, `CASCADE` indiscriminado ni borrar `auth.users`.

El reset limpiará únicamente las tablas de aplicación de esa base DEMO y ejecutará seed determinista en **una única transacción PostgreSQL**, en este orden lógico (los `CASCADE` se aceptan solo si el inventario de FKs de la base DEMO lo confirma):

1. Dependientes de horarios: `asistencias`, `anotaciones_horario`, filas de `publicacion_programada_horarios` y `horario_dia`; después `horarios`.
2. Dependientes de fichas/currículo: `ficha_usuario`, avisos demo ligados a ficha, `actividades_aprendizaje`, `resultados_aprendizaje`, `competencias_formacion`, `guias`, después `fichas`.
3. Dependientes de perfiles demo: conversaciones/mensajes, notificaciones, solicitudes, `usuario_especialidad`, `usuario_rol`, `horarios_guardados` y perfiles `usuarios`; **no borrar `auth.users`**. Las cuatro cuentas Auth demo se preaprovisionan y se conservan fuera del ciclo de reset.
4. Catálogos demo: ambientes antes de sedes; programas antes de coordinaciones; limpiar roles, jornadas, días o trimestres solo si el inventario confirma que pertenecen al proyecto DEMO y el seed los repone.
5. Sembrar de nuevo el grafo demo en orden padre→hijo y registrar en la misma transacción una auditoría de reset con actor, conteos, correlación y versión/hash del seed. Si falla la limpieza o el seed, hacer rollback de **todos los datos de aplicación**; no dejar semilla parcial.

Las FKs comprobadas incluyen `horarios → ambiente/instructor/ficha/resultado` (`models/horario.py:38-43`), `fichas → programa/trimestre/sede`, `resultado → competencia/guía`, y el puente `horario_dia` con cascada (`models/horario.py:10-15`). El esquema SQL también define `ficha_usuario` con cascada y `auditoria.idUsuario` con `SET NULL` (`database/01_creacion.sql:132-134,316-329`). Antes de implementar, se debe inventariar la base DEMO real con `information_schema`: modelos y esquema histórico no declaran todos los mismos `ondelete`.

La transacción **no abarca Supabase Auth**. Por diseño, no se crea, altera ni elimina una cuenta de `auth.users` en reset/seed: las cuatro cuentas demo se crean y verifican al preparar el entorno, se mantienen estables y el seed solo reconstruye sus perfiles y roles de aplicación cuando corresponda.

## Propuesta: “Escenario demo reiniciable”

### Diseño mínimo seguro que falta implementar

1. **Guarda de entorno obligatoria:** el endpoint de reset solo arranca si `DEMO_MODE=true` y la URL/base configurada coincide exactamente con una allow-list explícita del proyecto Supabase DEMO (por ejemplo, URL canónica y/o `project_ref` esperado en configuración de servidor). Debe fallar cerrado ante variable ausente, URL no HTTPS, host distinto o configuración institucional/compartida. La validación se ejecuta en el servidor antes de abrir transacción y se cubre con pruebas.
2. **Modelo/repositorio/servicio:** `DemoResetService` con transacción `SERIALIZABLE`, bloqueo exclusivo para impedir dos resets concurrentes y operaciones internas sin `commit` intermedio. Hoy múltiples repositorios hacen `db.commit()` propios (por ejemplo `horario_repository.py:95-141`, `auditoria_repository.py:12`), lo que impediría rollback atómico: hay que proveer variantes `*_sin_commit` para el ciclo reset/seed.
3. **Endpoint exclusivo de Administrador:** `POST /demo/reset-preview` muestra conteos/versión sin escribir; `POST /demo/reset` exige `require_admin`, `confirmacionExacta`, `idempotencyKey` y texto `RESETEAR DEMO`. No acepta SQL, URL, IDs arbitrarios ni selector de entorno. Devuelve correlación, conteos y auditoría. El acceso requiere además que la guarda de entorno del punto 1 sea válida.
4. **Seed determinista y versionado:** fixtures idempotentes con IDs naturales/UUID fijos para las cuatro cuentas Auth demo ya preaprovisionadas, perfiles y roles de aplicación, catálogo mínimo (sede, ambiente, programa, trimestre, ficha, guía, competencia, RAP), vínculos de aprendiz, horario borrador/publicado y Excel sintético. No reutilizar `docs-sihs/datos-muestra`: su README afirma que contiene datos institucionales reales.
5. **Auditoría y recuperación:** registrar inicio y éxito/error con actor, correlación, versión, conteos y duración. Si limpieza o seed falla, rollback total de datos de aplicación y estado de auditoría de error; las cuentas Auth permanecen sin cambio porque quedan fuera de la transacción.

`demoScenarioId` y una tabla de escenarios siguen siendo una **evolución posterior**, necesaria si SIHS necesita reset seguro dentro de una futura base compartida. No son P0 ni se añaden a todas las tablas en estos diez días.

### Pruebas obligatorias de esa capacidad

- API: guarda de entorno rechaza `DEMO_MODE` ausente/falso y URL/base no permitida; no autenticado `401`, Coordinador/Instructor/Aprendiz `403`, Admin sin confirmación `422`, doble petición con misma idempotency key y rollback ante fallo inducido.
- API de ciclo completo en la base DEMO: `reset → seed → crear ambiente/ficha/relaciones/horario → validar cruce 409 → corregir → publicar → consultas de ficha/instructor/ambiente → reset → verificar reconstrucción determinista → repetir`. Verificar que `auth.users` no cambió.
- E2E web: usar las credenciales demo aisladas, nunca credenciales institucionales ni `E2E_TEST_*` manuales. Extender `e2e/tests/horarios-flujos.spec.ts` y `publicar-horario.spec.ts` con bootstrap/reset por API autenticada como Admin.
- E2E móvil: login Instructor y Aprendiz demo, comprobar que ambos ven solo horario publicado después de cada seed/reset.
- PostgreSQL efímero: ejecutar contra `backend/tests/docker-compose.postgres.yml`; el README backend ya limita esa suite a `sihs_test` en puerto `55440`.

## Calidad, seguridad y despliegue: hallazgos priorizados

| Hallazgo | Evidencia | Acción |
|---|---|---|
| P0: reset inexistente | No hay router/modelo/servicio demo; CRUD borra recursos individuales. | Implementar solo contra Supabase DEMO aislado, con `DEMO_MODE=true`, allow-list explícita de URL/base y seed transaccional. |
| P0: instructores no administrables de punta a punta | `usuarios.py` solo expone GET, especialidades y códigos; no POST/import. | Definir creación de Auth + perfil + rol + especialidades en un servicio compensable/administrado, e importador con preview/errores por fila. |
| P0: Flutter rojo corregido | `flutter test` compilaba `mobile/test/screens/asistencia_screen_test.dart` con `AsistenciaFalsa` desactualizado respecto de `AsistenciaGateway.registrarSesion`. | Se corrigieron los dobles de prueba y se ejecutó la suite completa. Falta cerrar un fallo independiente de selección duplicada en `asistencia_instructor_screen_test.dart:173`. |
| P0: E2E no reproducible | `login.spec.ts` exige variables; `horarios-flujos.spec.ts` exige credenciales e IDs `E2E_TEST_*`; no cubre reset. | Hacerlos depender del escenario demo y CI efímero. |
| P1: IA dependiente de proveedor | `horarios.py:168-229` traduce `AIServiceError` a 503; `api.ts` lo contempla. | Health/readiness de IA, timeout y archivo sintético; plan B manual preensayado. |
| P0: entorno DEMO aún no confirmado | El repositorio solo contiene `.env.example`; no hay manifiesto de plataforma ni proyecto DEMO versionado. | Crear proyecto Supabase DEMO, configurar URL/base permitida, secretos, healthcheck y cuatro cuentas Auth demo preaprovisionadas antes del reset. |
| P1: protección de datos demo | SQL histórico contiene datos de prueba y `docs-sihs/datos-muestra/README.md` advierte de Excel institucional real. | Separar fixtures sintéticas, secretos fuera de Git y conservar las cuentas Auth demo fuera de reset. |
| P1: publicación programada | Existen router/modelo/worker (`publicaciones_programadas.py`, `worker_publicacion_service.py`), pero no hay evidencia de worker/deploy ejecutándose. | Para demo usar publicación inmediata; validar worker antes de ofrecer agenda. |
| P1: vitrina web | Comentarios explícitos de mock pendientes en pantallas citadas en matriz. | Ocultar/etiquetar como pendiente; nunca narrarlos como datos reales. |
| P1: integridad de cruces de BD | `EXCLUDE` está comentado en `01_creacion.sql:254`; validación está en servicio. | Pruebas de concurrencia y, si el modelo lo permite, restricción PostgreSQL/migración que no contradiga `horario_dia`. |
| P2: evidencia de backend no ejecutada en esta estación | `pytest` no está instalado (`/usr/bin/bash: pytest: command not found`). | Instalar entorno desde `backend/requirements.txt` y ejecutar suites relevantes sin credenciales reales. |
| P2: build/test web sin resultado en esta corrida | Los comandos Vitest/Vite comenzaron pero no completaron dentro de la ventana de 30 s de auditoría. | Ejecutarlos en CI/local con timeout registrado antes del ensayo. |

## Plan de 10 días

| Día | Prioridad, responsable sugerido | Entregable y criterio de salida |
|---:|---|---|
| 1 | P0 — móvil | Corregido el contrato de `AsistenciaFalsa.registrarSesion` y ejecutadas las pruebas relacionadas. El cierre completo queda pendiente del fallo independiente documentado en la asistencia del instructor. |
| 2 | P0 — DevOps + autenticación | Crear/confirmar proyecto Supabase DEMO aislado; configurar variables, allow-list URL/base, healthcheck y cuatro cuentas Auth demo preaprovisionadas. |
| 3 | P0 — DBA + backend | Inventario real de FKs/on-delete de la base DEMO, orden de limpieza validado y prueba contra PostgreSQL desechable. |
| 4 | P0 — backend | Guardas `DEMO_MODE`/URL-base permitida, servicio reset+seed transaccional, exclusión mutua, confirmación e idempotencia. |
| 5 | P0 — backend + QA API | Pruebas de permisos/guardas/rollback y ciclo API crear→usar→reset→recrear; verificar que Auth no cambia. |
| 6 | P0 — backend + frontend | Alta/importación de instructores con preview, perfil, rol y especialidades; pruebas API y conexión web real. |
| 7 | P1 — IA/backend | Excel sintético, smoke importar→propuesta→persistir, readiness IA y guion manual alterno. |
| 8 | P1 — frontend | Validar cada paso demo real, retirar del guion datos mock y añadir confirmación UI de reset Admin. |
| 9 | P0 — QA web/móvil | E2E aislado web y móvil con cuentas demo, health/CORS/variables/worker y artefactos de ejecución. |
| 10 | P0 — equipo completo | Dos ensayos completos consecutivos con reset entre ambos; checklist firmado, contingencia y decisión go/no-go. |

## Definición de “demo lista”

- Un Administrador demo entra; Coordinador, Instructor y Aprendiz demuestran permisos y vistas correctas.
- El proyecto Supabase DEMO está aislado y el reset solo funciona con `DEMO_MODE=true` y URL/base explícitamente permitida; nunca toca la base institucional/compartida ni `auth.users`.
- Se ejecuta todo el flujo 1–9 sin mocks funcionales; las zonas visuales sin integración están ocultas o claramente etiquetadas.
- Un cruce controlado retorna `409`, se corrige sin `forzar`, se publica y se verifica web/móvil desde los roles adecuados.
- Reset transaccional confirmado por Admin deja auditoría, limpia solo datos de aplicación DEMO, hace rollback ante error y reconstituye exactamente la versión de seed; las cuentas Auth demo se mantienen.
- API, web, móvil y E2E relevantes están verdes en un entorno desechable; health, CORS, secretos y dependencia IA/alternativa manual están verificados.

## Checklist de ensayo

- [ ] Proyecto Supabase DEMO aislado, `DEMO_MODE=true`, URL/base allow-list, CORS y `GET /api/v1/health` comprobados; se verificó que no es el proyecto institucional/compartido.
- [ ] Credenciales demo por rol, never expuestas en capturas ni Git; sesión anterior cerrada.
- [ ] Cuatro cuentas Auth demo preaprovisionadas y estables; versión de seed, auditoría y conteos iniciales revisados.
- [ ] Admin crea/importa instructor demo; crea ambiente, currículo/ficha y vínculo aprendiz.
- [ ] Coordinador crea horario manual con instructor, ambiente, ficha y RAP; dry-run limpio.
- [ ] Se provoca un cruce esperado, se muestra 409/auditoría y se resuelve editando, no forzando.
- [ ] Se importa Excel sintético y se muestra propuesta IA; si falla IA, se ejecuta el camino manual declarado.
- [ ] Se publica; se consulta por ficha/instructor/ambiente en web y por Instructor/Aprendiz en móvil.
- [ ] Se resetea con Admin, confirmación exacta y correlación; se constata rollback ante fallo inducido y que `auth.users` no cambió.
- [ ] Se resemilla y se repite al menos un tramo completo; adjuntar resultados de API/E2E/Flutter.
