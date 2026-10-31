# Auditoría técnica de SIHS

**Fecha de auditoría:** 2026-10-09
**Auditor:** Claude Code, por encargo del equipo (reunión de reparto del 2026-10-09)
**Alcance:** solo lectura. No se modificó esquema, no se publicaron horarios reales, no se tocó producción. Los únicos comandos con efecto fueron `pytest` del backend (suite propia, contra SQLite en memoria — ver `backend/tests/conftest.py:60-61`) y un `git clone --depth 1` de un repositorio externo de referencia a `/tmp` (no al repo de SIHS).

**Cómo leer este documento:** cada hallazgo está etiquetado como:
- **IMPLEMENTADO** — existe en el código, con archivo y línea citados.
- **VERIFICADO** — además de existir, se ejecutó y se observó el resultado (ej. la suite de tests corrió realmente).
- **EN DESARROLLO** — existe parcialmente o está deliberadamente simplificado (lo dice el propio código).
- **PROPUESTO** — recomendación de esta auditoría, todavía no es parte del sistema.

---

## 0. Resumen ejecutivo

SIHS es un sistema real y sustancialmente construido, no un prototipo. El backend tiene **154 endpoints REST**, 42 archivos de modelos/schemas/servicios/repositorios con un patrón consistente, una suite de **315 tests que pasan realmente** (7 skipped, 0 fallos, corrida en vivo el 2026-10-09), y una base de datos con 23 tablas documentadas con un nivel de detalle inusual: casi cada decisión de esquema tiene un comentario explicando el porqué y citando el documento o la fecha de la decisión.

El objetivo del sistema, en palabras del propio repositorio (`backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`):

> Detectar y evitar que un instructor, un ambiente o una ficha queden **cruzados** en el mismo horario. Todo lo demás (usuarios, roles, catálogos) existe para que este único problema se pueda resolver.

No se encontró código C#, Java, Go ni ningún otro backend alterno: **el backend es 100% Python (FastAPI)**, ya cumple el requisito del instructor de mantenerse en Python. No hay nada que migrar.

El hallazgo más importante para la reunión de reparto: **el equipo no ha adoptado todavía ninguna disciplina formal de testing/cobertura** (no hay umbral de cobertura configurado, no hay E2E, no hay CI que bloquee por cobertura), pese a tener ya 55 archivos de test de backend. Existe un bootcamp externo de referencia (`bc-testing-adso`, ver §7) que parece ser exactamente el currículo que el instructor espera que seaplique — y ningún artefacto de ese bootcamp (matriz de rotación, umbral en CI, vocero aleatorio) está adoptado todavía en SIHS. Esto debería ser el eje de la hoja de ruta de las dos semanas (§9).

---

## 1. Estructura del repositorio

```
sihs/
├── backend/          FastAPI — lógica de negocio centralizada (todos los clientes la consumen)
│   ├── app/
│   │   ├── ai/           Cliente Gemini (LLM) + 3 tareas de IA conversacional/explicativa
│   │   ├── api/v1/        34 routers, 154 endpoints
│   │   ├── core/          config, conexión DB, autenticación Supabase
│   │   ├── models/        26 modelos SQLAlchemy (uno por tabla de dominio)
│   │   ├── repositories/  24 repositorios (capa de acceso a datos)
│   │   ├── schemas/       26 módulos Pydantic (validación/serialización)
│   │   ├── scheduling/    generator.py — motor CP-SAT (OR-Tools), NO es IA/LLM
│   │   ├── services/      30 servicios (reglas de negocio)
│   │   └── workers/       worker de publicaciones programadas
│   ├── alembic/versions/  23 migraciones
│   ├── tests/             55 archivos, 315 tests (pasan en vivo)
│   └── requirements.txt
├── frontend/         React 19 + Vite + TypeScript + Tailwind 4 — consumido por Coordinadores/Admins
│   └── src/{pages,components,services,hooks,context,utils,types}
├── mobile/           Flutter — consumido por Instructores/Aprendices, **solo lectura**
│   └── lib/{screens,models,providers,services,theme,widgets}
├── database/         Scripts SQL versionados a mano (01_creacion.sql, migrations/)
├── _Docs/            Documentación de requisitos, elicitación, diagramas, mockups — muy extensa
└── .github/workflows/ci.yml   lint+build+test de frontend, pytest de backend
```

**Patrón arquitectónico del backend (verificado en múltiples módulos):**
`endpoint (api/v1/*.py)` → `schema Pydantic (schemas/*.py)` valida entrada → `service (services/*.py)` aplica reglas de negocio → `repository (repositories/*.py)` hace las queries SQLAlchemy → `model (models/*.py)` mapea a la tabla PostgreSQL. Es el mismo patrón en los 23 módulos de dominio, sin excepciones encontradas.

---

## 2. Stack tecnológico (verificado contra archivos de dependencias reales)

### Backend — `backend/requirements.txt`

| Librería | Versión | Para qué (verificado por uso real en el código) |
|---|---|---|
| fastapi | 0.141.1 | Framework API — 154 endpoints en `api/v1/` |
| pydantic / pydantic-settings | 2.13.4 / 2.15.0 | Validación de entrada/salida (`schemas/`), config (`core/config.py`) |
| sqlalchemy | ≥2.0 | ORM — `models/`, `repositories/` |
| psycopg[binary] | ≥3.2 | Driver PostgreSQL |
| alembic | ≥1.13 | Migraciones — 23 versiones en `alembic/versions/` |
| uvicorn | 0.52.4 | Servidor ASGI |
| pytest | 9.1.1 | Testing — 55 archivos |
| httpx | 0.28.1 | Cliente HTTP — usado también para llamar a Gemini (`app/ai/client.py`) |
| ortools | 9.15.6755 | Motor de optimización CP-SAT — `app/scheduling/generator.py`, generación automática de horarios. **No es IA/LLM.** |
| openpyxl | 3.1.5 | Lectura de Excel — importación del asistente de horarios |
| reportlab | 5.0.1 | Generación de PDF (`services/pdf_service.py`). Elegido explícitamente sobre WeasyPrint por ser pip-instalable sin dependencias de sistema (comentario en el propio requirements.txt) |
| python-multipart | 0.0.20 | Subida de archivos (`UploadFile`) en el endpoint de importación |

No se encontró Celery, Redis, Django, Flask, ni ningún otro framework web o de colas. El "worker" de publicaciones programadas (`app/workers/publicacion_programada_worker.py`) es un script Python simple, no una cola de tareas — ver §5.

### Frontend — `frontend/package.json`

React 19.2, React Router 7, Vite 8, TypeScript ~6.0, Tailwind 4, Vitest 4 + Testing Library (48 archivos `.test.tsx`), `@supabase/supabase-js` 2.112 para autenticación directa desde el cliente.

### Mobile — `mobile/pubspec.yaml`

Flutter, `supabase_flutter`, `dio` (HTTP), `provider` (estado), 9 archivos de test. Confirmado como **solo lectura** tanto por el nombre del paquete (`sihs_mobile`) como por el propio `ARQUITECTURA_MOBILE.md`: "instructores y aprendices VEN horarios, no los editan".

### Código C# — búsqueda explícita

```
find . -iname '*.cs' -not -path './.git/*'   →  0 resultados
```

**No se identificaron componentes C# en los recursos inspeccionados.** El backend es 100% Python. No aplica ninguna estrategia de migración (sección 9 del prompt maestro queda cerrada con esta declaración).

---

## 3. Base de datos (PostgreSQL / Supabase)

Fuente: `database/01_creacion.sql` (330 líneas, script a mano) + `database/migrations/*.sql` + 23 migraciones Alembic. No se pudo conectar en vivo al proyecto Supabase real desde este entorno (sin MCP de Supabase ni credenciales en este contexto de auditoría) — el esquema documentado aquí viene del script SQL versionado y de los modelos SQLAlchemy, que según `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md` ya fue verificado en vivo contra Supabase por el propio equipo ("probado en vivo contra Supabase", fecha 2026-08-26). Se marca como **IMPLEMENTADO** (visto en código) y no como **VERIFICADO en vivo por esta auditoría**.

### Decisión de arquitectura clave: Supabase Auth, no tabla propia de contraseñas

`usuarios."idUsuario"` es `UUID REFERENCES auth.users(id)`, no un entero propio. No hay tabla `password_reset_tokens` — todo el flujo de login/recuperación lo maneja Supabase Auth de forma nativa. Esto está documentado explícitamente como decisión v2 (2026-08-23) en el propio script SQL.

### Tablas (23)

| Tabla | PK | FK principales | Para qué |
|---|---|---|---|
| `roles` | idRol | — | Catálogo de roles |
| `usuarios` | idUsuario (UUID→auth.users) | — | Perfil de dominio (no credenciales) |
| `usuario_rol` | (idUsuario, idRol) | →usuarios, →roles | N:M usuario↔rol |
| `especialidades` | idEspecialidad | — | Catálogo |
| `usuario_especialidad` | (idUsuario, idEspecialidad) | →usuarios, →especialidades | N:M instructor↔especialidad |
| `coordinaciones` | idCoordinacion | — | Catálogo |
| `programas` | idPrograma | →coordinaciones | Programas de formación |
| `trimestres` | idTrimestre | — | Periodos académicos |
| `fichas` | idFicha | →programas, →trimestres | Grupo de aprendices |
| `ficha_usuario` | (idFicha, idUsuario) | →fichas, →usuarios | N:M ficha↔usuario (aprendiz o instructor líder); tiene `rolEnFicha` (vocero/subvocero, migración `4933158644c8`) |
| `guias` | idGuia | →programas, →trimestres | Agrupa resultados de aprendizaje |
| `competencias_formacion` | idCompetencia | →programas | — |
| `resultados_aprendizaje` | idResultado | →competencias_formacion, →guias (nullable) | Lo que se enseña en un bloque |
| `actividades_aprendizaje` | idActividad | →resultados_aprendizaje | ❌ sin capa de código todavía (solo tabla) |
| `sedes` | idSede | — | — |
| `ambientes` | idAmbiente | →sedes | Aulas/laboratorios; tiene `piso`, `capacidad`, `especialidadSala`, `responsableLlaves` (migración `e4d98e84c4cd`) |
| `jornadas` | idJornada | — | Mañana/tarde/noche |
| `diasDeLaSemana` | idDia | — | Catálogo de días |
| **`horarios`** | idHorario | →jornadas, →trimestres, →ambientes, →usuarios(instructor), →fichas, →resultados_aprendizaje | **Tabla central del sistema.** CHECK `horaFin > horaInicio`. 4 índices sobre las FK más consultadas para detección de cruces |
| `horario_dia` | (idHorario, idDia) | →horarios, →diasDeLaSemana | N:M horario↔día |
| `horarios_guardados` | idHorarioGuardado | →usuarios | Tabla puente JSONB — ver nota crítica abajo |
| `auditoria` | idAuditoria | →usuarios (nullable, ON DELETE SET NULL) | RNF-26/27 — acciones sensibles + intentos de login fallido |
| `solicitud_cambio_horario` | — | — | Migración `d5fb5bdff6fd` |
| `publicaciones_programadas` | — | →horarios (vía tabla puente) | Migración `f7b812a4d091` — ver §5.C |

### Hallazgo de diseño documentado por el propio equipo: `horarios_guardados` ≠ `horarios`

Esto es la inconsistencia más importante del esquema, y está **documentada por el propio equipo, no descubierta por esta auditoría** (comentario en `database/01_creacion.sql` líneas ~245-260):

`horarios_guardados` guarda `bloques` y `grid` como **JSONB de texto libre** (ficha, instructor y ambiente son strings, no FKs reales), porque el editor visual `frontend/src/pages/NuevoHorario.tsx` todavía no está conectado al módulo `horarios` real. Es decir: **hoy existen dos caminos paralelos para "crear un horario"** — uno con integridad referencial real y detección de cruces (`horarios`), y otro de borrador visual sin validación relacional (`horarios_guardados`). El propio `OBJETIVO_Y_SERVICIOS_FALTANTES.md` lo marca como "el trabajo de frontend más importante que queda".

### RLS (Row Level Security)

```sql
-- ALTER TABLE horarios ENABLE ROW LEVEL SECURITY;   (comentado, no activo)
-- CREATE POLICY "instructor_ve_su_horario" ...        (comentado, no activo)
```

**EN DESARROLLO / no activo.** La autorización hoy vive enteramente en la capa de aplicación (`require_role`/`require_roles` en `backend/app/core/supabase_auth.py:154-166`), no en PostgreSQL. Es un patrón válido, pero significa que **cualquier acceso directo a la base (service role key, scripts, Supabase Studio) no tiene ninguna barrera de autorización por fila** — solo la API FastAPI la aplica.

### EXCLUDE constraint (segunda barrera anti-cruce a nivel de BD)

También comentado/no activo, bloqueado porque el día de la semana vive en `horario_dia` (tabla separada) y un `EXCLUDE USING gist` no puede cruzar dos tablas. El propio equipo documenta que no es urgente porque `HorarioService._detectar_cruces` ya cubre los 4 tipos de cruce en la capa de aplicación.

---

## 4. Los tres flujos fundamentales (trazados en código real)

### A. Constructor manual de horarios

| Paso | Archivo:línea | Qué hace |
|---|---|---|
| 1. UI | `frontend/src/pages/NuevoHorario.tsx:239` | `guardarHorario()` — checkbox "guardar como borrador" controla `publicado` |
| 2. Dry-run opcional | `frontend/src/pages/NuevoHorario.tsx:357` | Antes de guardar de verdad, llama al dry-run para anticipar cruces sin persistir |
| 3. Endpoint | `backend/app/api/v1/horarios.py:223` | `POST /horarios/` → `HorarioResponse`, 201 |
| 4. Validación | `backend/app/schemas/horario.py` | Pydantic valida la forma del payload |
| 5. Servicio | `backend/app/services/horario_service.py:138` | `crear(db, data, forzar=False)` |
| 6. Reglas de negocio | `horario_service.py:486` | `_detectar_cruces()` — 4 validaciones: instructor duplicado, ambiente duplicado, ficha duplicada, resultado repetido mismo día |
| 7. Reglas adicionales | `horario_service.py:869,930` | `_validar_fortaleza_instructor`, `_validar_reglas_instructor` (ej. RF-011 — horas semanales) |
| 8. Persistencia | `backend/app/repositories/horario_repository.py` | INSERT vía SQLAlchemy |
| 9. Tabla afectada | `horarios`, `horario_dia` | — |
| 10. Respuesta | `_a_response()` (`horario_service.py:57`) | Serializa con días, instructor, ficha, ambiente, resultado |

**Nota crítica (ya señalada en §3):** este flujo trazado es el del módulo `horarios` real, con FKs e integridad. El botón "Guardar" de `NuevoHorario.tsx` en producción hoy escribe en `horarios_guardados` (JSONB), no en este flujo — la migración del frontend a este módulo real está pendiente (ver `OBJETIVO_Y_SERVICIOS_FALTANTES.md`). **Al presentar, aclarar esta diferencia explícitamente**, porque el instructor puede probar el botón real y ver el camino JSONB.

Conflictos: `forzar: bool` permite a un rol autorizado pasar por encima de una advertencia de cruce (ver `horarios_estado.py` tests, `test_horarios_forzar_rf011.py`, `test_horarios_audit_forzar.py`) — queda auditado en la tabla `auditoria`.

### B. Constructor/carga de horarios mediante IA

**Hallazgo importante: son DOS mecanismos distintos, y solo uno usa IA (LLM) de verdad.**

1. **Importación de Excel — sí usa IA (Gemini).**
   `frontend/src/pages/AsistenteHorarios.tsx:36` → `POST /horarios/asistente/importar` (`backend/app/api/v1/horarios.py:160`) → `backend/app/services/asistente_horario_service.py:318 previsualizar_excel()`. Gemini (`backend/app/ai/client.py`, modelo `gemini-3.5-flash-lite`) clasifica las columnas del Excel subido (qué columna es ficha, cuál instructor, etc.) porque las plantillas reales no tienen encabezados consistentes entre coordinaciones. Devuelve una previsualización editable, no escribe nada todavía.

2. **Generación de la propuesta de horario — NO usa IA/LLM, es optimización combinatoria pura.**
   `POST /horarios/asistente/generar-propuesta` (`horarios.py:193`) → `asistente_horario_service.py:660 generar_propuesta()` → `backend/app/scheduling/generator.py` → **OR-Tools CP-SAT solver**. El propio docstring del generador es explícito:
   > "Esto es CP-SAT puro (OR-Tools), sin ningún LLM de por medio — requisito 7 de la arquitectura: las restricciones duras nunca se delegan a un LLM."

   Esta es una decisión de arquitectura deliberada y defendible técnicamente: un LLM no garantiza restricciones duras (no-cruce), un solver de programación por restricciones sí. **Para la presentación: no llamar a esto "horario generado por IA" sin matizar** — es un dato que un instructor de software puede cuestionar con razón si se presenta mal.

3. **Preguntas sobre el horario — sí usa IA (Gemini).**
   `POST /horarios/asistente/preguntar` (`horarios.py:209`) → `backend/app/ai/tasks/responder_pregunta.py`. Conversacional, no escribe en la base.

4. **Otros usos de IA confirmados:** `backend/app/ai/tasks/classify_document.py`, `explain_conflict.py` (explicación en lenguaje natural de por qué un horario tiene un cruce — `POST /horarios/auditoria-cruces/resumen-ia`, `horarios.py:132`).

La capa de IA es explícitamente opcional y con degradación documentada: si `GEMINI_API_KEY` no está configurada, `main.py` lo advierte en el arranque y el endpoint responde 503 en vez de fallar silenciosamente (`backend/app/main.py:43-47`).

### C. Publicador de horarios

| Paso | Archivo:línea | Qué hace |
|---|---|---|
| 1. UI | `frontend/src/pages/HorariosCompletos.tsx:95,132` | Botón "Publicar ahora" / "Despublicar" |
| 2. Petición | `apiPatch('/horarios/{id}/estado', { publicado: true })` | — |
| 3. Endpoint | `backend/app/api/v1/horarios.py:343` | `PATCH /horarios/{id}/estado`, requiere `require_puede_programar` |
| 4. Servicio | `backend/app/services/horario_service.py:357 cambiar_estado()` | — |
| 5. Regla de bloqueo | `horario_service.py:373-385` | Si el horario está reservado por una publicación **programada** pendiente, lanza `PublicacionProgramadaPendienteError` → HTTP 409 |
| 6. Persistencia | UPDATE sobre `horarios.publicado` | — |
| 7. Efecto secundario | `horario_service.py:273 _notificar_publicacion()` | Solo si pasa de borrador→publicado (no repite aviso en despublicar/republicar). Notifica por ficha, agrupado |
| 8. Auditoría | `AuditoriaService.registrar(...)` en el endpoint | Registra PUBLICAR/DESPUBLICAR en tabla `auditoria` |
| 9. Lectura del cliente | `GET /usuarios/me/horarios`, `GET /ficha-usuario/mi-horario` | Mobile y web leen por este camino — solo ven lo publicado |

**Publicación programada (capa adicional real, no trivial):** `backend/app/services/publicacion_programada_service.py` (`programar`, `cancelar`, `reprogramar`, `ejecutar`) + `backend/app/workers/publicacion_programada_worker.py:21 procesar_vencidas()` — un script que se ejecuta periódicamente (no una cola de tareas) y publica automáticamente los horarios cuya fecha programada ya pasó. Hay una "huella" (`_huella()`, línea 29) que detecta si el conjunto de horarios cambió entre que se programó y que se ejecuta, para invalidar la publicación programada si ya no corresponde al mismo contenido.

**Rollback:** no se usan transacciones explícitas multi-tabla complejas en este flujo (es un UPDATE simple); SQLAlchemy maneja el rollback automático de sesión en caso de excepción (patrón estándar de `Session`, visto en `core/database.py`). El commit del commit reciente `2d01aee feat: habilitar edición transaccional de horarios` sugiere que la edición (no la publicación) es donde se añadió manejo transaccional explícito — **no verificado en detalle por esta auditoría, marcar como pendiente de revisión por David** (responsable de este flujo, ver §9).

**Escenarios de error cubiertos por tests reales:** `test_publicaciones_programadas.py`, `test_publicacion_programada_postgres.py`, `test_horarios_audit_forzar.py`, y el hallazgo documentado en el propio commit más reciente del repo (`ce68671 docs: document scheduled publication migration blocker` — 2026-10-09, el mismo día de esta auditoría) indica que hay un **bloqueador de migración activo relacionado con publicación programada**, sin resolver a la fecha de esta auditoría. Recomendación: que David lo traiga como primer punto del viernes.

---

## 5. Otros hallazgos

| # | Hallazgo | Severidad | Evidencia |
|---|---|---|---|
| H1 | RLS no activo — autorización solo en capa de aplicación | Media | `database/01_creacion.sql` (política comentada) |
| H2 | Dos caminos paralelos para "crear horario" (`horarios` real vs `horarios_guardados` JSONB) | Alta | §3, §4.A — documentado por el propio equipo |
| H3 | N+1 queries — **ya corregido y con test de regresión real** | — (resuelto) | `backend/tests/test_horarios_listado_sin_n_mas_1.py`: 47s medidos en producción contra Supabase con 130+ horarios, corregido con `selectinload`, el test cuenta queries SQL reales ejecutadas |
| H4 | Bloqueador de migración de publicación programada, sin resolver a la fecha | Alta | commit `ce68671`, 2026-10-09 |
| H5 | `actividades_aprendizaje` tiene tabla pero cero capa de código | Baja | `OBJETIVO_Y_SERVICIOS_FALTANTES.md` — no bloquea nada |
| H6 | 16 elementos de UI con datos hardcodeados tipo "vitrina" (mockup fiel, sin backend real detrás) | Media | `OBJETIVO_Y_SERVICIOS_FALTANTES.md`, tabla completa de pantallas afectadas — cada uno marcado en el `.tsx` con el comentario `// Contenido de mockup (Stitch) — pendiente de conectar` |
| H7 | Sin umbral de cobertura ni gate de calidad en CI | Alta (ver §7) | `.github/workflows/ci.yml` corre tests pero no mide/exige cobertura; no hay `pytest-cov` en requirements.txt ni config de cobertura en `frontend/package.json` |
| H8 | Sin pruebas E2E | Alta (ver §7) | No se encontró Playwright/Cypress en ninguna de las tres apps |
| H9 | No se encontró código C# | — (cierra sección 9 del prompt maestro) | búsqueda exhaustiva, 0 resultados |
| H10 | Auditoría (tabla `auditoria`) documentada como "hecha en código pero sin aplicar a Supabase" a la fecha del último informe interno (2026-08-31) | Media — **a revalidar**, puede estar ya resuelto | `OBJETIVO_Y_SERVICIOS_FALTANTES.md` |
| H11 | CORS correctamente restringido (no es un hallazgo negativo — buena práctica confirmada) | — (positivo) | `backend/app/main.py:94-100`: origin regex solo para localhost + `frontend_url` explícito, no wildcard con `allow_credentials=True` |
| H12 | Middleware de errores no manejados diseñado específicamente para no romper CORS en el error — con un incidente real documentado como motivación | — (positivo, buena ingeniería) | `backend/app/main.py:48-78`, incidente del 2026-09-24 citado en el propio comentario |

No se encontró duplicación de lógica significativa entre servicios (patrón repositorio/servicio consistente), ni dependencias evidentemente innecesarias en `requirements.txt` (cada librería tiene comentario de uso real).

---

## 6. Rendimiento — estado real, no estimado

| Aspecto | Estado |
|---|---|
| N+1 en listado de horarios | **Resuelto y verificado con test** — de 47s medidos a O(1) queries (§5, H3) |
| Resto de endpoints | **Pendiente de medición** — no hay `pytest-benchmark`, `py-spy` ni `EXPLAIN ANALYZE` ejecutado en este repositorio a la fecha |
| Algoritmo de generación de horarios (CP-SAT) | Sin benchmark registrado; el propio código documenta una simplificación deliberada del MVP (un bloque semanal por necesidad, no varios) — **optimización de alcance, no de rendimiento** |
| Latencia de Gemini | **Medida en vivo una vez**: 28.9s con hoja de 52 encabezados (comentario en `app/ai/client.py:27-33`), por eso el timeout de lectura es 90s |
| Async/await | No se encontró uso de rutas `async def` en los endpoints revisados (`horarios.py`) — FastAPI corre los `def` síncronos en threadpool; **no hay evidencia de que I/O-bound esté aprovechando async**, pero tampoco evidencia de que sea un cuello de botella medido |

No se inventan cifras de mejora. Todo objetivo de rendimiento para la hoja de ruta debe marcarse **PROPUESTO** hasta que exista una medición.

---

## 7. Testing — estado real y el bootcamp de referencia

### Lo que existe en SIHS hoy

- **Backend:** 55 archivos de test, **315 passed, 7 skipped, 0 failed** (corrida en vivo el 2026-10-09, SQLite en memoria, 65s). CI (`.github/workflows/ci.yml`) ejecuta `pytest -v` en cada push/PR.
- **Frontend:** 48 archivos `.test.tsx` (Vitest + Testing Library). CI ejecuta `npm run lint && npm run build && npm run test`.
- **Mobile:** 9 archivos de test (`mobile/test/{models,providers,screens,widgets}`).
- **Lo que NO existe:** umbral de cobertura configurado en ningún proyecto, pruebas E2E (Playwright/Cypress), pruebas de integración contra PostgreSQL real en Docker (los tests de backend corren contra SQLite, no Postgres — algunas diferencias de dialecto podrían no detectarse, ver `conftest.py:8` que importa explícitamente el dialecto SQLite para adaptar tipos).

### El bootcamp de referencia: `bc-testing-adso` (ergrato-dev)

Por indicación del usuario se clonó `https://github.com/ergrato-dev/bc-testing-adso` (solo lectura, a `/tmp`, fuera del repo de SIHS) para verificar qué currículo de testing espera el contexto institucional (ADSO/SENA). Es un bootcamp de **9 semanas núcleo + 1 opcional, 8h/semana**, con stack React + FastAPI entre sus combinaciones soportadas — coincide exactamente con el stack de SIHS.

**Punto clave: el umbral de cobertura exigido sube cada semana y nunca baja (regla de "trinquete"):**

| Semana | Piso mínimo de cobertura | Cómo se exige |
|:---:|:---:|---|
| 1 | Línea base (se registra, no se exige) | — |
| 2 | 30% | CI bloquea el PR |
| 3 | 40% | CI |
| 4 | 50% | CI |
| 5 | 60% | CI |
| 6 | 70% | CI |
| 7 | 75% | CI |
| 8–9 | **80%** | CI; condición para poder sustentar |

Temario semana por semana: **1** E2E con Playwright (resultado visible desde el día 1) · **2** unitarias + umbral en CI · **3** componentes React (Testing Library) · **4** pruebas de API (estados HTTP, validación, errores) · **5** dobles de prueba (mocks/stubs/spies) · **6** integración contra PostgreSQL/MySQL real en Docker · **7** Playwright a fondo (flakiness, locators) · **8** CI completo con BD como servicio · **9** integrador + sustentación con "vocero aleatorio" · **10** (opcional) TDD.

**Conclusión honesta para la reunión:** SIHS ya tiene la semana 2 parcialmente cubierta (hay 315 tests unitarios/de API reales) pero **cero de la infraestructura que el bootcamp exige formalmente**: sin cobertura medida, sin umbral en CI, sin E2E, sin integración contra Postgres real, sin matriz de rotación ni vocero aleatorio. Esto no es un juicio negativo — es el punto de partida correcto para que Edith estructure el bootcamp interno (Artifact D) y para que la hoja de ruta de dos semanas (§9) empiece literalmente por la semana 1 de este currículo, adaptada al tiempo disponible (2 semanas, no 9).

---

## 8. Clasificación de hallazgos por severidad/impacto/esfuerzo

| Hallazgo | Severidad | Impacto si no se corrige | Esfuerzo estimado |
|---|---|---|---|
| H4 — bloqueador de migración de publicación programada | Alta | Publicación programada inservible en producción | Bajo-medio (ya diagnosticado por el equipo, según el propio commit) |
| H2 — doble camino `horarios` vs `horarios_guardados` | Alta | Confusión de dominio, riesgo de que lo que el usuario "crea" nunca detecte cruces reales | Alto (migrar el editor visual completo) |
| H7/H8 — sin cobertura ni E2E | Alta (de cara al instructor) | Es literalmente el criterio de evaluación señalado por el instructor | Medio, repartible en 2 semanas (ver roadmap) |
| H1 — RLS no activo | Media | Superficie de riesgo si se usa la service-role key fuera de la API | Bajo (activar políticas ya documentadas como patrón) |
| H6 — UI vitrina sin backend real | Media | Riesgo de presentar como real algo que no lo es | Bajo por elemento, ya inventariado |
| H10 — tabla auditoria sin aplicar a Supabase (a revalidar) | Media | Pérdida de trazabilidad de acciones sensibles | Bajo (correr el CREATE TABLE) — **revalidar primero si ya se aplicó** |
| H5 — `actividades_aprendizaje` sin código | Baja | No bloquea nada | Medio, no urgente |

---

## 9. Lo que esta auditoría NO pudo verificar

- Conexión en vivo a Supabase (esquema real tal cual está desplegado hoy, políticas RLS realmente activas, triggers, vistas) — esta auditoría solo tuvo acceso al script SQL versionado y a los modelos ORM, no al MCP de Supabase ni a credenciales.
- Si el bloqueador de migración (H4, commit `ce68671`) ya fue resuelto después de ese commit.
- Si la tabla `auditoria` (H10) ya fue aplicada al proyecto Supabase compartido.
- Comportamiento transaccional detallado de "edición transaccional de horarios" (commit `2d01aee`) — se confirmó que existe la intención pero no se leyó el diff completo de esa feature.
- Rendimiento bajo carga real (sin mediciones salvo el caso N+1 ya resuelto y la latencia de Gemini).

Estos puntos quedan como primera tarea de Mateo (auditor/integrador) al revisar las entregas del domingo: pedir a cada responsable que confirme o corrija estos cinco puntos con evidencia propia.
