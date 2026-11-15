# Plan de demo reiniciable SIHS — 10 días

**Auditoría:** 2026-11-15. **Rama auditada:** `fixes-multiples-nicol` (HEAD `aaa7fcf`, `feat: agregar perspectivas a gestionar horarios`). Este documento describe el estado observable del repositorio; no certifica una base compartida ni un despliegue sin ejecutar las verificaciones indicadas.

## Resultado ejecutivo

SIHS tiene el recorrido técnico central para construir horarios: FastAPI, autenticación Supabase, roles, catálogos, relaciones, creación/edición, detección de cruces, publicación y consulta para instructor/aprendiz. La web contiene las rutas y consumidores principales; Flutter permite login y consulta de horarios publicados.

La demo completa **no está lista todavía**. Los bloqueadores P0 son: no existe un escenario demo aislado ni un endpoint transaccional de reset/seed; no existe creación/importación de instructores como operación de administración; los E2E dependen de credenciales e IDs externos y no cubren reset; y la suite móvil completa no compila. La importación IA existe como previsualización y generación de propuesta, pero requiere configuración real de IA y los bloques se persisten individualmente con `POST /horarios/`.

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
| 10 | **Reiniciar y repetir: no implementado.** Hay borrados CRUD individuales, no un reset aislado, exclusivo, auditable, transaccional ni seed. | No existe router/servicio/modelo `demo` o `reset` en `backend/app/api/v1`, `services` o `models`; búsqueda de routers confirma ausencia. | Borrar desde UI o SQL genérico puede eliminar datos institucionales, romper FKs o dejar Auth inconsistente. | P0 |

## Relaciones y orden seguro de borrado

No ejecutar `TRUNCATE`, `CASCADE` indiscriminado ni borrar `auth.users`. El esquema no etiqueta datos demo; por tanto **hoy no permite un reset seguro**.

El futuro reset debe seleccionar solo registros con `demoScenarioId` (UUID) y borrar en una única transacción PostgreSQL, en este orden lógico (los `CASCADE` se aceptan solo dentro del filtro del escenario):

1. Dependientes de horarios: `asistencias`, `anotaciones_horario`, filas de `publicacion_programada_horarios` y `horario_dia`; después `horarios`.
2. Dependientes de fichas/currículo: `ficha_usuario`, avisos demo ligados a ficha, `actividades_aprendizaje`, `resultados_aprendizaje`, `competencias_formacion`, `guias`, después `fichas`.
3. Dependientes de usuarios demo: conversaciones/mensajes, notificaciones, solicitudes, `usuario_especialidad`, `usuario_rol`, `horarios_guardados` y perfiles `usuarios`; **nunca borrar `auth.users` institucionales**. Las cuentas demo Auth deben ser allow-list explícita, no prefijo inferido.
4. Catálogos exclusivos demo, solo si fueron creados por el escenario: ambientes antes de sedes; programas antes de coordinaciones; no borrar roles, jornadas, días o trimestres institucionales compartidos.
5. Registrar al final/por transacción una auditoría inmutable de reset con actor, escenario, conteos por tabla, correlación y hash/versión del seed. La auditoría de aplicación actual (`AuditoriaService`) hace commits propios, por lo que no sirve como garantía transaccional de reset.

Las FKs comprobadas incluyen `horarios → ambiente/instructor/ficha/resultado` (`models/horario.py:38-43`), `fichas → programa/trimestre/sede`, `resultado → competencia/guía`, y el puente `horario_dia` con cascada (`models/horario.py:10-15`). El esquema SQL también define `ficha_usuario` con cascada y `auditoria.idUsuario` con `SET NULL` (`database/01_creacion.sql:132-134,316-329`). Se debe validar el catálogo real con `information_schema` antes de aplicar la migración: modelos y esquema histórico no declaran todos los mismos `ondelete`.

## Propuesta: “Escenario demo reiniciable”

### Diseño mínimo seguro que falta implementar

1. **Migración:** tabla `demo_escenarios` (`id`, `codigo` único, `versionSeed`, `estado`, `creadoPor`, `reseteadoPor`, timestamps) y columna nullable indexada `demoScenarioId` en cada entidad que pueda crearse para demo. Para Auth, una tabla `demo_auth_allowlist` enlaza IDs de `auth.users` creados específicamente para el escenario. No marcar por email, nombre o prefijo solamente.
2. **Modelo/repositorio/servicio:** `DemoScenarioService` con una transacción `SERIALIZABLE`, bloqueo asesorado por `scenario_id` y comprobación de que el escenario está en estado `resetting`. Los repositorios usados por el seed/reset deben tener variantes `*_sin_commit`; hoy múltiples repositorios hacen `db.commit()` propios (por ejemplo `horario_repository.py:95-141`, `auditoria_repository.py:12`), lo que impediría atomicidad.
3. **Endpoints exclusivos de Administrador:**
   - `POST /demo-scenarios/{codigo}/reset-preview`: conteos y plan, sin escribir.
   - `POST /demo-scenarios/{codigo}/reset`: body con `confirmacionExacta`, `idempotencyKey` y versión esperada; exige `require_admin`, MFA/política equivalente si está disponible, confirmación textual `RESETEAR <codigo>`, y retorna correlación/auditoría.
   - `GET /demo-scenarios/{codigo}/estado` y `GET /demo-scenarios/{codigo}/auditoria`.
   Ninguno acepta SQL, IDs arbitrarios ni permite reset global.
4. **Seed determinista y versionado:** fixtures Python/SQL idempotentes con UUID/IDs naturales fijos por escenario, cuatro usuarios Auth demo preprovisionados y allow-list, catálogo mínimo propio (sede, ambiente, programa, trimestre, ficha, guía, competencia, RAP), vínculos de aprendiz, horario borrador/publicado y archivo Excel sintético versionado. No reutilizar `docs-sihs/datos-muestra`: su README afirma que contiene datos institucionales reales.
5. **Auditoría y recuperación:** escribir un evento de inicio y uno de éxito/error en una tabla de auditoría de reset independiente del conjunto borrado; guardar actor, IP/correlación, versión, conteos y duración. Ante error: rollback total y estado `failed`; no dejar semilla parcial.

### Pruebas obligatorias de esa capacidad

- API: no autenticado `401`, Coordinador/Instructor/Aprendiz `403`, Admin sin confirmación `422`, escenario desconocido `404`, doble petición con misma idempotency key y rollback ante fallo inducido.
- API de ciclo completo: `reset → seed → crear ambiente/ficha/relaciones/horario → validar cruce 409 → corregir → publicar → consultas de ficha/instructor/ambiente → reset → verificar ausencia solo de datos demo → seed → repetir`.
- E2E web: usar las credenciales demo aisladas, nunca credenciales institucionales ni `E2E_TEST_*` manuales. Extender `e2e/tests/horarios-flujos.spec.ts` y `publicar-horario.spec.ts` con bootstrap/reset por API autenticada como Admin.
- E2E móvil: login Instructor y Aprendiz demo, comprobar que ambos ven solo horario publicado después de cada seed/reset.
- PostgreSQL efímero: ejecutar contra `backend/tests/docker-compose.postgres.yml`; el README backend ya limita esa suite a `sihs_test` en puerto `55440`.

## Calidad, seguridad y despliegue: hallazgos priorizados

| Hallazgo | Evidencia | Acción |
|---|---|---|
| P0: reset inexistente | No hay router/modelo/servicio demo; CRUD borra recursos individuales. | Implementar propuesta anterior y no ensayar contra base institucional. |
| P0: instructores no administrables de punta a punta | `usuarios.py` solo expone GET, especialidades y códigos; no POST/import. | Definir creación de Auth + perfil + rol + especialidades en un servicio compensable/administrado, e importador con preview/errores por fila. |
| P0: Flutter rojo | `flutter test` falla compilando `mobile/test/screens/asistencia_screen_test.dart`: `AsistenciaFalsa` no implementa `AsistenciaGateway.registrarSesion`. | Corregir el doble de prueba y ejecutar toda la suite; no modificar producción para “hacer pasar” el test. |
| P0: E2E no reproducible | `login.spec.ts` exige variables; `horarios-flujos.spec.ts` exige credenciales e IDs `E2E_TEST_*`; no cubre reset. | Hacerlos depender del escenario demo y CI efímero. |
| P1: IA dependiente de proveedor | `horarios.py:168-229` traduce `AIServiceError` a 503; `api.ts` lo contempla. | Health/readiness de IA, timeout y archivo sintético; plan B manual preensayado. |
| P1: protección de datos demo | SQL histórico contiene datos de prueba y `docs-sihs/datos-muestra/README.md` advierte de Excel institucional real. | Separar fixtures sintéticas, secretos fuera de Git y allow-list de usuarios demo. |
| P1: publicación programada | Existen router/modelo/worker (`publicaciones_programadas.py`, `worker_publicacion_service.py`), pero no hay evidencia de worker/deploy ejecutándose. | Para demo usar publicación inmediata; validar worker antes de ofrecer agenda. |
| P1: vitrina web | Comentarios explícitos de mock pendientes en pantallas citadas en matriz. | Ocultar/etiquetar como pendiente; nunca narrarlos como datos reales. |
| P1: integridad de cruces de BD | `EXCLUDE` está comentado en `01_creacion.sql:254`; validación está en servicio. | Pruebas de concurrencia y, si el modelo lo permite, restricción PostgreSQL/migración que no contradiga `horario_dia`. |
| P2: evidencia de backend no ejecutada en esta estación | `pytest` no está instalado (`/usr/bin/bash: pytest: command not found`). | Instalar entorno desde `backend/requirements.txt` y ejecutar suites relevantes sin credenciales reales. |
| P2: build/test web sin resultado en esta corrida | Los comandos Vitest/Vite comenzaron pero no completaron dentro de la ventana de 30 s de auditoría. | Ejecutarlos en CI/local con timeout registrado antes del ensayo. |

## Plan de 10 días

| Día | Prioridad, responsable sugerido | Entregable y criterio de salida |
|---:|---|---|
| 1 | P0 — líder backend + DBA | Inventario real de FKs/entorno demo; ADR de aislamiento; congelar lista de datos institucionales prohibidos. |
| 2 | P0 — backend/DBA | Migraciones de `demo_escenarios`, marcas de pertenencia y auditoría de reset; prueba de upgrade en PostgreSQL desechable. |
| 3 | P0 — backend | Servicio transaccional de seed/reset, exclusión mutua, confirmación, idempotencia y endpoints solo Admin. |
| 4 | P0 — backend + autenticación | Cuentas Auth demo allow-list, alta/importación de instructores con preview, roles y especialidades; pruebas de permisos. |
| 5 | P0 — QA API | API completa crear→usar→reset→recrear, rollback inducido, FKs, cruces y publicación; ejecutar pytest en entorno reproducible. |
| 6 | P1 — frontend | Conectar/validar cada paso demo real, retirar del guion datos mock, mensaje claro para indisponibilidad IA y botón reset admin con doble confirmación. |
| 7 | P1 — IA/backend | Excel sintético, smoke de importar→propuesta→persistir, readiness del proveedor y guion manual alterno. |
| 8 | P0 — móvil | Corregir doble `AsistenciaFalsa`, suite Flutter verde; E2E/manual móvil con Instructor y Aprendiz demo tras publicación. |
| 9 | P0 — QA/DevOps | E2E aislado web + API + móvil, health/CORS/variables/worker; registrar artefactos y no usar producción institucional. |
| 10 | P0 — equipo completo | Dos ensayos completos consecutivos con reset entre ambos; checklist firmado, plan de contingencia y decisión go/no-go. |

## Definición de “demo lista”

- Un Administrador demo entra; Coordinador, Instructor y Aprendiz demuestran permisos y vistas correctas.
- El escenario se crea desde seed determinista y ninguna consulta/reset puede tocar filas fuera de `demoScenarioId` o Auth allow-list.
- Se ejecuta todo el flujo 1–9 sin mocks funcionales; las zonas visuales sin integración están ocultas o claramente etiquetadas.
- Un cruce controlado retorna `409`, se corrige sin `forzar`, se publica y se verifica web/móvil desde los roles adecuados.
- Reset transaccional confirmado por Admin deja auditoría, elimina solo datos demo y reconstituye exactamente la versión de seed.
- API, web, móvil y E2E relevantes están verdes en un entorno desechable; health, CORS, secretos y dependencia IA/alternativa manual están verificados.

## Checklist de ensayo

- [ ] URL API, web, Supabase demo, CORS y `GET /api/v1/health` comprobados.
- [ ] Credenciales demo por rol, never expuestas en capturas ni Git; sesión anterior cerrada.
- [ ] Escenario en versión de seed esperada; auditoría y conteos iniciales revisados.
- [ ] Admin crea/importa instructor demo; crea ambiente, currículo/ficha y vínculo aprendiz.
- [ ] Coordinador crea horario manual con instructor, ambiente, ficha y RAP; dry-run limpio.
- [ ] Se provoca un cruce esperado, se muestra 409/auditoría y se resuelve editando, no forzando.
- [ ] Se importa Excel sintético y se muestra propuesta IA; si falla IA, se ejecuta el camino manual declarado.
- [ ] Se publica; se consulta por ficha/instructor/ambiente en web y por Instructor/Aprendiz en móvil.
- [ ] Se resetea con Admin, confirmación exacta y correlación; se constata que no se tocaron datos no demo.
- [ ] Se resemilla y se repite al menos un tramo completo; adjuntar resultados de API/E2E/Flutter.
