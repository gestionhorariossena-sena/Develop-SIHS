# Revisión Técnica Total — SIHS

**Fecha:** 2026-09-20
**Alcance:** monorepo completo (`backend/`, `frontend/`, `mobile/`, `database/`, `.github/`, `_Docs/`)
**Commit base:** `b2c6819` (rama `main`), con 24 archivos modificados sin commitear en el árbol de trabajo
**Naturaleza:** auditoría de estado, no de cambios. Cubre seguridad, corrección, rendimiento, calidad, experiencia de uso y operación.

> Este documento **no reemplaza** a `AUDITORIA_TECNICA.md` (que justifica el reinicio del
> proyecto anterior) ni a `AUDITORIA_LOGICA_NEGOCIO.md`. Es una foto del sistema **actual**
> y el plan de trabajo que se deriva de ella.

---

## 0. Resumen ejecutivo

El sistema está **sustancialmente construido y en buen estado funcional**. El núcleo del
problema del proyecto — detectar cruces de instructor/ambiente/ficha — está implementado,
probado y con reglas de negocio documentadas hasta el detalle de cada corrección hecha en
vivo. Eso es poco común y vale reconocerlo.

Verificación ejecutada durante esta revisión:

| Comprobación | Resultado |
|---|---|
| `pytest` (backend) | ✅ **195 pasan** en 35 s |
| `vitest` (frontend) | ✅ **210 pasan** / 31 archivos, 78 s |
| `tsc -b && vite build` | ✅ compila |
| `eslint .` | ❌ **1 error** → **CI en rojo hoy** |
| Cadena de migraciones Alembic | ✅ lineal, una sola cabeza (`2fcba25519cd`) |
| Secretos en archivos versionados | ✅ ninguno |

Los problemas reales no están en la lógica de negocio sino en **cuatro frentes**:

1. **Un riesgo de pérdida de datos latente** en la configuración de Alembic (C-1).
2. **La integridad de horarios depende solo de la capa de aplicación** — sin red de
   seguridad en la base de datos (C-2).
3. **Control de acceso incompleto en el cliente web** — el andamiaje existe pero no se usa (A-1).
4. **Escalabilidad**: el sistema funciona con el volumen real de hoy (~130 horarios) porque
   ya se apagaron dos incendios de N+1; quedan los mismos patrones sin corregir en otras
   rutas, y ningún listado tiene paginación (A-3, A-4, A-5).

Se identificaron **32 hallazgos**: 4 críticos, 9 altos, 10 medios, 9 de higiene; más
**7 módulos de backend sin interfaz** y **1 funcionalidad con interfaz pero sin backend**.

---

## 1. Método

- Lectura directa del código de los caminos críticos (auth, horarios, asistente IA,
  generador OR-Tools, repositorios, rutas del cliente).
- Ejecución real de las tres suites (`pytest`, `vitest`, `eslint`/`vite build`).
- Contraste sistemático entre lo que el backend expone y lo que el frontend/móvil consume.
- Inspección del esquema SQL, la cadena de migraciones y la configuración de CI/despliegue.
- No se ejecutaron pruebas de penetración ni carga; los hallazgos de seguridad son de
  revisión de código y se marcan como **verificados por lectura**, no explotados.

---

## 2. Inventario: qué está construido

| Capa | Estado | Tamaño |
|---|---|---|
| Backend FastAPI | 25 routers, 27 servicios, 25 repositorios, 27 modelos | ~16.900 LOC Python |
| Frontend React | 33 páginas, 21 componentes, 31 archivos de test | ~13.400 LOC TS/TSX |
| Móvil Flutter | Login + pantalla de horario. Sin tests, fuera de CI | ~1.260 LOC Dart |
| Base de datos | 17+ tablas, 19 migraciones Alembic, esquema SQL de referencia | ~800 LOC SQL |
| IA (Gemini) | Clasificador de columnas, explicador de conflictos, Q&A | opcional, degrada limpio |
| Optimizador | CP-SAT (OR-Tools), MVP funcional | 241 LOC |
| CI | GitHub Actions: lint + build + test (front), pytest (back) | 1 workflow |
| Despliegue | `backend/Procfile` (Railway), `frontend/vercel.json` | sin contenedores |

---

## 3. Hallazgos

Cada hallazgo lleva: **evidencia** (archivo:línea), **impacto**, **corrección propuesta** y
**esfuerzo estimado** (S = <½ día, M = 1-2 días, L = 3-5 días).

---

### 3.1 CRÍTICOS — atender antes de cualquier otra cosa

---

#### C-1 · `alembic autogenerate` propondría borrar 8 tablas con datos

**Evidencia:** `backend/alembic/env.py:18-40`

El bloque de importación de modelos lista 21 módulos, pero **faltan 7**:

```
anotacion_horario · asistencia · aviso · mensajeria
notificacion · solicitud_acceso · solicitud_cambio_horario
```

Esos módulos definen 8 tablas reales (`anotaciones_horario`, `asistencias`, `avisos`,
`conversaciones`, `mensajes`, `notificaciones`, `solicitudes_acceso`,
`solicitud_cambio_horario`) que **existen en la base de datos compartida** — se crearon con
sus propias migraciones (`36cc5d3be997`, `49fb9918b2ea`, `8bde7868dac6`, `e5c53749014d`,
`b73491403bb8`, `d5fb5bdff6fd`, `003634f47c9d`).

Como no están en `Base.metadata`, Alembic las ve como "tablas que sobran en la base" y
`include_object` (`env.py:58-71`) solo filtra claves foráneas hacia el esquema `auth`, no
tablas huérfanas.

**Impacto:** quien corra `alembic revision --autogenerate` genera un `upgrade()` con
`op.drop_table()` para las 8. Si ese archivo se revisa por encima y se aplica, **se pierden
notificaciones, avisos, mensajes, asistencias, anotaciones y solicitudes en producción**.
Esto es más probable de lo que parece porque, según lo registrado, la base compartida aún
no tiene el `stamp` del baseline aplicado, así que el primer autogenerate está pendiente.

**Corrección:**
1. Agregar los 7 módulos al import de `env.py` (corrección real, 5 minutos).
2. Endurecer `include_object` para que **nunca** devuelva `True` en `type_ == "table"` con
   `reflected=True` y sin `compare_to` — es decir, que un DROP de tabla nunca se autogenere;
   si alguna vez hay que borrar una, se escribe a mano y se revisa.
3. Añadir un test que compare `Base.metadata.tables.keys()` contra los `__tablename__`
   descubiertos en `app/models/` y falle si alguno no está registrado — así el problema no
   vuelve cuando se agregue el modelo número 28.

**Esfuerzo:** S

---

#### C-2 · La no-superposición de horarios no está garantizada bajo concurrencia

**Evidencia:** `backend/app/services/horario_service.py:115-133` (`crear`) · `database/01_creacion.sql:250-259` (restricción `EXCLUDE` comentada)

`crear()` sigue el patrón *comprobar-y-después-escribir*:

```python
errores = HorarioService._detectar_cruces(db, data)   # lee
if errores and not forzar: raise CruceHorarioError(errores)
horario = HorarioRepository.crear(db, nuevo_horario, data.dias)  # escribe
```

Entre la lectura y la escritura no hay bloqueo, ni transacción serializable, ni restricción
de base de datos. **Dos coordinadores guardando bloques solapados al mismo tiempo pasan
ambos la validación y ambos insertan.** El sistema queda con el cruce exacto que existe para
prevenir, y sin ninguna señal de que ocurrió.

El `EXCLUDE USING gist` que lo resolvería está escrito y comentado en el SQL de creación,
con una nota correcta explicando por qué no se activó: un `EXCLUDE` no puede cruzar
`horarios` con `horario_dia`.

**Impacto:** el objetivo central del sistema tiene un agujero de corrección bajo uso
concurrente. Con 2-3 coordinadores es improbable pero **no imposible**, y es precisamente
el tipo de fallo que no deja rastro y se descubre en el aula.

**Corrección (dos opciones, elegir una):**

- **(a) Restricción real en la base** — la robusta. Requiere desnormalizar el día a una
  columna de `horarios` (un bloque de N días pasa a ser N filas, o se agrega una tabla
  `horario_bloque` con `(idHorario, idDia, rango)`), y entonces:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE horario_bloque ADD CONSTRAINT "sinCruceInstructor"
    EXCLUDE USING gist ("idInstructor" WITH =, "idDia" WITH =, rango WITH &&);
  -- ídem para idAmbiente e idFicha
  ```
  Es un cambio de modelo con migración de datos: **L**, pero cierra el problema de raíz y
  además acelera la detección de cruces (el índice GiST hace el trabajo).

- **(b) Bloqueo pesimista** — el parche inmediato. Envolver `crear`/`actualizar` en una
  transacción que tome `SELECT ... FOR UPDATE` sobre las filas de instructor/ambiente/ficha
  implicadas, o un `pg_advisory_xact_lock` derivado de `(idInstructor, idTrimestre)`.
  **S/M**, no cambia el modelo, no protege contra escritores que no pasen por el servicio.

**Recomendación:** hacer (b) ya, planificar (a) para el siguiente trimestre.

**Esfuerzo:** S/M ahora, L completo

---

#### C-3 · CI está en rojo

**Evidencia:** `frontend/src/components/horario/GridAsistente.tsx:220`

```
error  Fast refresh only works when a file only exports components.
       Use a new file to share constants or functions between components
       react-refresh/only-export-components
```

`GridAsistente.tsx` exporta el componente **y** la función `celdasDesdeHorarios()`.
`npm run lint` falla → el job `frontend` de `.github/workflows/ci.yml` falla → **cualquier
push a cualquier rama entra en rojo**.

El archivo aún está sin versionar (`??` en `git status`), así que el rojo llegará en el
momento del commit.

**Impacto:** un CI rojo que se vuelve costumbre deja de ser una señal. Es el mecanismo que
protege al equipo de todo lo demás en este documento.

**Corrección:** mover `celdasDesdeHorarios` a `frontend/src/components/horario/celdasAsistente.ts`
(hay precedente exacto en la misma carpeta: `convertirHorarios.ts`, `indexarHorarios.ts`).

**Esfuerzo:** S

---

#### C-4 · Cualquiera en internet puede bloquear la cuenta de cualquier usuario

**Evidencia:** `backend/app/api/v1/auditoria.py:12-27`

`POST /api/v1/auditoria/intento-fallido-login` es **público y sin límite**, y acepta un
identificador de texto libre. Tres peticiones con el correo de una persona la dejan
bloqueada 15 minutos (`auditoria_service.py:15-16`), porque `Login.tsx` consulta
`GET /auditoria/estado-login` **antes** de intentar autenticar y se niega a continuar.

```bash
# Verificado por lectura de código, no ejecutado:
for i in 1 2 3; do
  curl -X POST $API/auditoria/intento-fallido-login \
       -d '{"identificador":"coordinador@sena.edu.co"}'
done
# → esa persona no puede entrar durante 15 minutos
```

Es **repetible indefinidamente**: quien quiera puede mantener bloqueado al coordinador
durante todo un día de programación. También permite inflar la tabla `auditoria` sin límite.

La limitación está **documentada con honestidad** en el propio docstring del endpoint. Eso
está bien, pero la mitigación sigue pendiente y el riesgo es de denegación de servicio
dirigida, no teórico.

**Impacto:** denegación de servicio por usuario, trivial de ejecutar, sin autenticación.
Adicionalmente `GET /auditoria/estado-login` es un oráculo público del estado de cualquier
cuenta.

**Corrección — el problema de fondo es que el bloqueo se cuenta del lado equivocado.**
El login del cliente web habla directo con Supabase Auth, así que este backend no puede
confirmar que quien reporta el fallo realmente lo intentó. Dos caminos:

- **Preferido:** enrutar **todo** el login por `POST /usuarios/login-documento`, que ya
  existe, ya hace el intercambio contra Supabase desde el servidor y ya registra el fallo
  de forma confiable (`usuarios.py:41-72`). Eliminar entonces los dos endpoints públicos de
  auditoría. Esto además unifica el flujo de login en un solo camino auditable.
- **Mitigación mínima si lo anterior no cabe:** limitar por IP (p. ej. `slowapi`), exigir
  que el identificador exista antes de registrar, y **nunca** revelar el estado de bloqueo de
  una cuenta a un llamador no autenticado.

**Esfuerzo:** M

---

### 3.2 ALTOS

---

#### A-1 · Ninguna ruta del cliente web restringe por rol

**Evidencia:** `frontend/src/routes/AppRouter.tsx` (25 rutas) · `frontend/src/routes/ProtectedRoute.tsx:18-21`

`ProtectedRoute` acepta una prop `roles`, la implementa correctamente, y **tiene pruebas**
(`ProtectedRoute.test.tsx`). Pero **ninguna** de las 25 rutas de `AppRouter.tsx` la pasa.
Es código correcto que nadie invoca.

En consecuencia, un Aprendiz que escriba la URL a mano llega a `/panel-administracion`,
`/roles`, `/usuarios`, `/horarios/auditoria`, `/instructores`…

`AppShell.tsx:148-173` sí oculta los ítems del menú por rol, pero eso es **decoración, no
control de acceso**.

**Impacto:** el backend sí valida (`require_admin`, `require_lectura_catalogo`, etc.), así
que **no hay fuga de datos**. Lo que hay es: pantallas rotas llenas de errores 403 para el
usuario equivocado, cero defensa en profundidad, y un mensaje implícito de que la
autorización del cliente "ya está resuelta" cuando no lo está.

**Corrección:** pasar `roles` en cada `<Route>` según la matriz de permisos ya establecida
en `supabase_auth.py:130-160`. Añadir un test que recorra la tabla de rutas y falle si una
ruta de gestión no declara roles.

**Esfuerzo:** S/M

---

#### A-2 · Código de instructor: público, adivinable y sin límite de intentos

**Evidencia:** `backend/app/api/v1/usuarios.py:199-205` · `backend/app/services/usuario_service.py:1,36-41,57-72`

```python
import random                                             # línea 1
codigo = "INS-" + "".join(random.choice(caracteres) for _ in range(6))   # línea 37
```

Tres problemas acumulados:

1. `POST /usuarios/instructor/codigo/validar` **no exige autenticación ni limita intentos**.
2. Genera el código con `random` (Mersenne Twister), no con `secrets`. Mersenne Twister es
   predecible: observando suficiente salida se puede reconstruir el estado interno y
   **predecir los siguientes códigos**. Para un valor que habilita el alta como Instructor
   (`Registro.tsx:76-81`), el generador tiene que ser criptográfico.
3. Ante un código válido devuelve `idUsuario` — el UUID real de una persona, a un llamador
   anónimo.

**Impacto:** el código de instructor es la puerta al alta con rol Instructor. Hoy se puede
enumerar sin fricción y, con suficiente observación, predecir.

**Corrección:** `secrets.choice` en vez de `random.choice`; exigir sesión o límite estricto
por IP en `/validar`; devolver solo `{valido: bool}` sin el UUID; dar caducidad al código.

**Esfuerzo:** S

---

#### A-3 · "Auditoría de Cruces" escala de forma cuadrática

**Evidencia:** `backend/app/services/horario_service.py:358-427`

`auditar_conflictos` recorre los N horarios activos y para **cada uno** llama a
`validar_dry_run`, que a su vez dispara:

- 3 × `buscar_solape` (ficha, instructor, ambiente) — 3 consultas
- 1 × `buscar_resultado_en_ficha`, que internamente hace un `obtener_dias` **por cada fila
  que devuelve** (`horario_repository.py:222-228`)
- 1 × `_validar_reglas_instructor`, que hace `obtener_por_instructor` + un `obtener_dias`
  **por cada horario de ese instructor** (`horario_service.py:487-494`)
- 1 × `_describir` **por conflicto encontrado**, con 2 consultas más (`horario_service.py:510-528`)

Con los 131 horarios reales del centro, son **del orden de miles de viajes a Supabase**, cada
uno pagando latencia de red real (no es localhost). Es exactamente el patrón que ya causó dos
incidentes documentados en este código (47 s en `GET /horarios/`, 10 s en `/mi-horario`).

El comentario del código lo reconoce: se corrigió el N+1 más barato (los días en bloque) pero
"no elimina el costo dominante".

**Impacto:** la pantalla de Auditoría de Cruces es la herramienta de diagnóstico del
coordinador. Si tarda o agota el tiempo de espera, se deja de usar y los cruces se descubren
en el aula.

**Corrección:** reescribir `auditar_conflictos` como **un barrido en memoria**: traer los
horarios activos con sus días en 2-3 consultas (ya existe `obtener_dias_por_horarios`),
indexar por `(idDia, recurso)` y detectar solapes con comparaciones de intervalos en Python.
Pasa de miles de consultas a ~4, y de O(N²) en red a O(N log N) en memoria. La lógica de
reglas no cambia: se extrae a funciones puras que operen sobre las estructuras en memoria, y
los tests actuales de `test_horarios_auditoria_cruces.py` las siguen validando.

**Esfuerzo:** M

---

#### A-4 · N+1 remanentes en rutas ya identificadas

**Evidencia:** todas en `backend/app/services/horario_service.py`

| Línea | Función | Problema |
|---|---|---|
| `:89` | `obtener_por_instructor` | `a_response` sin días en bloque → 1 consulta por horario |
| `:107` | `obtener_por_ambiente` | ídem, y además el repositorio (`horario_repository.py:204`) no usa `selectinload` → 4 consultas perezosas más por horario |
| `:225` | `obtener_publicados_por_instructor` | ídem — y es la ruta de "Mi horario" del instructor |
| `:429` | `calcular_carga_semanal` | `obtener_dias` dentro del `sum()` |
| `:487` | `_validar_reglas_instructor` | `obtener_dias` dentro del `sum()`, en el camino caliente de **cada** guardado |

La solución ya existe y está probada en el mismo archivo (`obtener_dias_por_horarios` +
`_relaciones_para_respuesta`); simplemente no se aplicó a estas cinco rutas.

**Impacto:** "Mi horario" de un instructor con 20 bloques hace ~100 consultas donde bastan 3.
Y `_validar_reglas_instructor` penaliza **cada creación y edición de horario**.

**Corrección:** aplicar el patrón existente. Añadir un test de regresión con conteo de
consultas — ya hay precedente: `test_horarios_listado_sin_n_mas_1.py`.

**Esfuerzo:** S/M

---

#### A-5 · Ningún listado tiene paginación ni filtros de servidor

**Evidencia:** búsqueda de `limit|offset|skip|page` en `backend/app/api/v1/*.py` → **cero coincidencias**

`GET /horarios/`, `GET /usuarios/`, `GET /fichas/`, `GET /auditoria/` y el resto devuelven la
tabla completa. La tabla `auditoria` **crece de forma monótona** con cada acción del sistema
y cada intento fallido de login (que, por C-4, cualquiera puede inflar desde internet).

**Impacto:** `GET /auditoria/` es una bomba de tiempo: dentro de unos meses de uso real
devolverá decenas de miles de filas en una sola respuesta JSON, y tumbará la pantalla de
administración. El resto degrada con el crecimiento natural del catálogo.

**Corrección:** parámetros `limit`/`offset` (con tope máximo obligatorio) y filtros de
servidor en los listados; `auditoria` además ordenada descendente por fecha y con filtro de
rango obligatorio. En el cliente, paginación o scroll incremental.

**Esfuerzo:** M

---

#### A-6 · Las pruebas corren sobre SQLite; producción es PostgreSQL

**Evidencia:** `backend/tests/conftest.py:55` — `create_engine("sqlite://")`

El propio `conftest` documenta que no puede crear todas las tablas porque varios modelos usan
tipos de PostgreSQL (`JSONB`) que SQLite no compila, y necesita un `TypeDecorator` de
compatibilidad para los UUID (`conftest.py:26-47`).

**Lo que las 195 pruebas verdes nunca ejercitan:** `JSONB` (`horarios_guardados`),
`TIMESTAMPTZ` con zona horaria real, restricciones `CHECK` y `EXCLUDE`, el comportamiento del
agrupador de conexiones, las semánticas transaccionales, y **cualquier escenario de
concurrencia** — justo donde vive C-2.

**Impacto:** la suite da confianza sobre la lógica pura, que es mucho, pero **ninguna** sobre
la capa de persistencia. Los tres incidentes de producción ya documentados en este repositorio
(codificación de caracteres, sentencias preparadas del pooler, N+1) son todos de esa capa.

**Corrección:** añadir un job de CI con un servicio `postgres:16` y una suite de integración
(marcador `@pytest.mark.integracion`) que corra las migraciones de Alembic de verdad y
verifique los caminos de persistencia. Mantener SQLite para las pruebas unitarias rápidas.

**Esfuerzo:** M

---

#### A-7 · El backend no registra nada

**Evidencia:** búsqueda de `import logging|logger\.` en `backend/app/` → **cero coincidencias**

Sin `logging` configurado, sin manejador global de excepciones, sin identificador de
correlación por petición. Un error 500 en producción deja únicamente la traza por defecto de
uvicorn en la salida estándar, sin contexto de usuario, ruta ni carga útil.

La tabla `auditoria` cubre **acciones de negocio** (RNF-26/27), que es otra cosa: no registra
fallos técnicos.

**Impacto:** "a un usuario le falló algo ayer" es hoy indiagnosticable.

**Corrección:** `logging` estructurado (JSON), middleware que asigne un ID de petición y lo
devuelva en una cabecera, `@app.exception_handler(Exception)` que registre con contexto y
devuelva un error genérico al cliente. Es la base de cualquier soporte posterior.

**Esfuerzo:** S/M

---

#### A-8 · Row Level Security desactivado; toda la autorización vive en la aplicación

**Evidencia:** `database/01_creacion.sql:261-268` (RLS comentado) · `backend/app/core/database.py:31`

La decisión de arquitectura original (`AUDITORIA_TECNICA.md` §6) contemplaba RLS como segunda
capa. Hoy está comentada, y el backend se conecta con un rol privilegiado que la eludiría de
todos modos.

**Impacto:** un único fallo de autorización en un endpoint expone datos sin nada detrás. El
riesgo aumenta a medida que crece el número de endpoints (ya son 25 routers).

**Corrección:** no es urgente **si** A-1 y las dependencias de rol se mantienen rigurosas. Lo
que sí corresponde ya es una **prueba de matriz de autorización**: para cada endpoint y cada
rol, afirmar el código de estado esperado. Es lo que realmente evita la regresión silenciosa.
RLS queda como objetivo de endurecimiento posterior.

**Esfuerzo:** M (matriz de pruebas) / L (RLS)

---

#### A-9 · Divergencia de ramas y trabajo sin commitear en el árbol vivo

**Evidencia:** `git log` · `git status` · `git worktree list`

- `main` tiene **7 commits que `origin/develop` no tiene**; `origin/develop` tiene **33 que
  `main` no tiene**. Las dos ramas llevan tiempo separándose.
- **1.231 líneas modificadas sin commitear** en 24 archivos, en el directorio de trabajo de
  `main` — que es el que ejecuta el backend en vivo con `--reload`.
- Archivos fuente nuevos sin versionar: `DashboardInstructor.tsx` (562 LOC),
  `MiHorarioAprendiz.tsx`, `GridAsistente.tsx` (231 LOC), `DashboardRouter.tsx`, 2 scripts de
  backend y 3 archivos de test.
- **4 árboles de trabajo huérfanos** (`prunable`) y ramas residuales (`nicol-merge`,
  `worktree-agent-ae3ee22681200af70`).

**Impacto:** ~1.200 líneas de trabajo real existen solo en un disco. Un `git checkout`
descuidado las borra. Además `main` y `develop` divergentes hacen que "¿qué hay desplegado?"
no tenga respuesta clara.

**Corrección:** commitear el trabajo pendiente en una rama de trabajo (nunca en `main`),
reconciliar `main` ↔ `develop` de forma deliberada, `git worktree prune`, borrar ramas
residuales.

**Esfuerzo:** S (requiere criterio humano sobre qué va a dónde)

---

### 3.3 MEDIOS

---

#### M-1 · Un solo paquete de 912 kB sin división de código

`dist/assets/index-*.js` → **912,40 kB** (212 kB comprimido), 133 módulos, un solo fragmento.
Las 33 páginas se descargan para ver el login.

**Corrección:** `React.lazy()` + `Suspense` por ruta en `AppRouter.tsx`. Bajaría la carga
inicial a una fracción. Relevante: los usuarios están en red institucional y móviles.
**Esfuerzo:** S

---

#### M-2 · Validación de entrada casi ausente en los esquemas

Solo **2 de 28** archivos de `app/schemas/` usan `Field`, `constr` o `max_length`. Los campos
de texto libre (temática, descripción, mensajes, motivo de rechazo) entran sin límite de
longitud. **Corrección:** `max_length` en todo campo de texto; validadores de rango en los
numéricos. **Esfuerzo:** M

---

#### M-3 · Superficie de inyección de prompt y coste en los endpoints de IA

`backend/app/ai/prompts.py:75-83` interpola texto del usuario entre comillas:
`Pregunta del coordinador: "{pregunta}"`. `PreguntaHorarioRequest` no limita longitud, así
que se pueden enviar megabytes a Gemini por petición, y salir de las comillas es trivial.

Riesgo acotado — solo Coordinador/Administrador pueden llamarlo y el modelo no tiene acceso a
herramientas — pero es coste real y un patrón a no repetir. **Corrección:** `max_length` en
`pregunta`/`contexto`, delimitadores robustos, límite de frecuencia por usuario.
**Esfuerzo:** S

---

#### M-4 · Sin verificación de calidad de Python en CI

CI corre `pytest` y nada más para el backend: no hay `ruff`, `black`, ni `mypy`. El frontend
sí tiene ESLint + TypeScript estricto. Además `requirements.txt` mezcla dependencias de
producción y de prueba (`pytest` se instala en el despliegue) y combina fijado exacto
(`fastapi==0.141.1`) con rangos abiertos (`sqlalchemy>=2.0`), lo que hace las compilaciones no
reproducibles. **Corrección:** `ruff` (lint + formato) en CI, separar
`requirements-dev.txt`, fijar todo con `pip-compile`. **Esfuerzo:** S/M

---

#### M-5 · 21 componentes del cliente sin pruebas

Incluidos los más grandes y críticos:

| Archivo | LOC |
|---|---|
| `AsistenteHorarios.tsx` | **1.180** |
| `DashboardInstructor.tsx` | 562 |
| `AppShell.tsx` | 465 |
| `Dashboard.tsx` | 420 |
| `NotificacionesPanel.tsx` | 362 |
| `AuditoriaCruces.tsx` | 312 |
| `Presentacion.tsx` | 307 |
| `ModalBloque.tsx` | 303 |

`AsistenteHorarios.tsx` es el archivo más grande del repositorio, orquesta un asistente de
4 pasos con IA y optimizador, y no tiene ni una prueba. **Corrección:** priorizar
`AsistenteHorarios`, `AppShell` (donde vive el filtrado por rol del menú) y `AuditoriaCruces`.
Considerar además dividir `AsistenteHorarios` en componentes por paso. **Esfuerzo:** L

---

#### M-6 · La app móvil está fuera de todo control de calidad

Sin carpeta `test/`, sin job en CI, sin `flutter analyze`. Además:
- `mobile/pubspec.yaml:43` incluye `.env` como **asset empaquetado** — hoy solo lleva la clave
  anónima (pública por diseño), pero el patrón invita a que algún día se empaquete un secreto.
- `api_client.dart:33,51,67,82` — `on DioException catch (e) { rethrow; }`: variable sin usar
  y bloque sin efecto.
- `ApiException` (`api_client.dart:122-134`) nunca se instancia — código muerto.
- El manejo de errores se reduce a cerrar sesión en cualquier 401.

**Corrección:** añadir job de CI con `flutter analyze` + `flutter test`, pruebas de los
proveedores y servicios, limpiar los bloques vacíos. **Esfuerzo:** M

---

#### M-7 · El puerto por defecto del API no coincide con la documentación

`frontend/src/services/api.ts:3` → `?? 'http://127.0.0.1:8001/api/v1'`
`frontend/.env.example`, `mobile/.env.example`, `README.md` → puerto **8000**

Quien clone sin `.env` apunta a un puerto donde no hay nada. **Corrección:** unificar en 8000.
**Esfuerzo:** S

---

#### M-8 · La caché de tokens es por proceso y no se invalida al cerrar sesión

`backend/app/core/supabase_auth.py:26-28` — diccionario en memoria, TTL de 30 s, se vacía
entero al llegar a 500 entradas. Con más de una réplica cada proceso valida por su cuenta
(pérdida de eficacia, no de corrección). Un token revocado sigue siendo aceptado hasta 30 s.

Más de fondo: **cada validación es una llamada de red a Supabase**. Verificar la firma del JWT
localmente contra el JWKS del proyecto eliminaría esa dependencia del camino caliente y el
punto único de fallo que ya obligó a añadir reintentos (`supabase_auth.py:30-33`).

**Corrección:** verificación local del JWT con caché de JWKS; mantener la llamada remota solo
como respaldo. Vaciado explícito de la entrada al cerrar sesión. **Esfuerzo:** M

---

#### M-9 · Sin cabeceras de seguridad ni límite de frecuencia global

`main.py` monta únicamente `CORSMiddleware`. No hay `X-Content-Type-Options`,
`X-Frame-Options`/CSP, `Strict-Transport-Security`, ni límite de peticiones. Adicionalmente,
`allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+"` está **activo también en
producción** — justificado para desarrollo, pero debería condicionarse a
`settings.app_env == "development"`. **Esfuerzo:** S

---

#### M-10 · Cualquier cuenta de Supabase Auth obtiene automáticamente un perfil

`supabase_auth.py:100-113`: en la primera petición autenticada, si no existe fila en
`usuarios`, se crea. Si el registro de Supabase está abierto, cualquiera obtiene un perfil en
la base institucional. Sin roles no puede hacer nada (los `require_*` lo bloquean), pero
ensucia el catálogo de usuarios y difumina la frontera entre "tiene cuenta" y "está dado de
alta". **Corrección:** verificar que el registro público esté cerrado en el panel de Supabase;
si se mantiene el auto-alta, marcar esos perfiles como `pendienteAprobacion`. **Esfuerzo:** S

---

### 3.4 HIGIENE

| ID | Hallazgo | Acción |
|---|---|---|
| B-1 | 8 archivos `.xlsx`/`.jpeg` con **datos institucionales reales** (líderes de ficha, programación 2026) sueltos en la raíz y sin versionar | Mover a `_Docs/` o añadir a `.gitignore`. Riesgo de commit accidental de datos personales |
| B-2 | 4 árboles de trabajo `prunable` + ramas residuales (`nicol-merge`, `worktree-agent-*`) | `git worktree prune`, borrar ramas |
| B-3 | `infra/` y `scripts/` en la raíz están **vacíos** | Eliminarlos o poblarlos |
| B-4 | El repositorio no tiene `CLAUDE.md` pese a `GUIA_MONOREPO.md` y `GUIA_NUEVAS_FEATURES.md` con convenciones valiosas | Crear uno que apunte a esas guías |
| B-5 | `frontend/src/data/notificacionesEjemplo.ts` no lo importa nadie — código muerto | Eliminar |
| B-6 | El generador usa 3 franjas inventadas (`generator.py:46-50` (`FRANJAS_POR_JORNADA`)), no la plantilla institucional de 2 franjas | Requiere que el solver reparta varios resultados por bloque (ya analizado en el docstring) |
| B-7 | Sin índices en `usuarios.numeroDocumento` (login), `usuarios.codigoInstructor` (validación), `horario_dia.idDia` | Añadir en una migración |
| B-8 | `pytest` emite `StarletteDeprecationWarning` (httpx/TestClient) | Actualizar cuando toque |
| B-9 | 3 manejadores `onClick` sobre `div`/`span` — no accesibles por teclado | Cambiar a `<button>` |

---

## 4. Partes sin construir

### 4.1 Interfaz construida, backend inexistente

**`/solicitudes-acceso` — el flujo completo de solicitud y aprobación de acceso.**

`PanelAdministracion.tsx` (687 LOC) y `Registro.tsx` llaman a:
- `GET /solicitudes-acceso/`
- `POST /solicitudes-acceso/`
- `POST /solicitudes-acceso/{id}/aprobar`
- `POST /solicitudes-acceso/{id}/rechazar`

**Ninguno existe.** No hay `app/api/v1/solicitudes_acceso.py`, no hay router registrado en
`main.py`, no hay repositorio ni servicio. Solo existe el modelo
(`app/models/solicitud_acceso.py`) y su migración (`b73491403bb8`).

Está documentado en el código como contrato acordado por adelantado (Epic SCRUM-96) y las
pruebas del cliente pasan porque simulan `apiGet`/`apiPost`. Pero **hoy, en ejecución real,
esas pantallas devuelven 404**: el panel de administración no carga la cola y "Solicitar
acceso" no envía nada.

`CredencialTemporalService` ya está construido y probado esperando a ese endpoint.

**Esfuerzo:** M — router + servicio + repositorio, con el contrato ya definido por el cliente.

---

### 4.2 Backend construido, sin interfaz

Siete módulos completos (modelo + repositorio + servicio + router registrado) que **ningún
cliente consume**:

| Módulo | Estado |
|---|---|
| `/avisos` | backend completo, cero UI |
| `/mensajeria` (conversaciones + mensajes) | backend completo, cero UI |
| `/anotaciones-horario` | backend completo, cero UI |
| `/solicitudes-cambio-horario` | backend completo, cero UI |
| `/guias` | backend completo, cero UI |
| `/actividades-aprendizaje` | backend completo, cero UI |
| `/especialidades` | backend completo, cero UI |

Varios provienen de la reconciliación de la rama `nicol`. **Decisión requerida:** o se
construye la interfaz, o se retiran los routers. Mantener siete superficies de API públicas
que nadie usa es superficie de ataque y de mantenimiento a cambio de cero valor.

---

### 4.3 Nunca construido

- **`asistencias`** — el modelo (`models/asistencia.py`) y la migración (`8bde7868dac6`)
  existen. **No hay repositorio, ni servicio, ni router, ni UI.** Una tabla vacía en
  producción. Es, además, una de las que C-1 propondría borrar.
- **Notificaciones en tiempo real** — el panel consulta por sondeo; no hay canal en vivo
  (Supabase Realtime está disponible y sin usar).
- **Correo real** — SCRUM-129: el SMTP personalizado del panel de Supabase sigue sin
  configurar, así que la credencial temporal que genera `CredencialTemporalService` **no le
  llega a nadie**.
- **Móvil** — solo login y vista de horario. Sin notificaciones, sin asistencia, sin modo
  desconectado (todo listado como "expansión futura" en su README).
- **Respaldos** — `RESPALDOS_SUPABASE.md` documenta el procedimiento; no hay automatización
  verificable ni prueba de restauración.
- **Contenedores** — sin `Dockerfile`; el despliegue depende de la detección automática de
  Railway/Vercel. La paridad entre entornos no está garantizada.

---

## 5. Optimización y experiencia

**Rendimiento (más allá de A-3/A-4/A-5):**
- División de código por ruta → carga inicial mucho menor (M-1).
- Verificación local del JWT → elimina una llamada de red de **cada** petición autenticada (M-8).
- Índice GiST vía la restricción `EXCLUDE` de C-2 → acelera la detección de cruces como efecto colateral.
- Caché HTTP (`ETag`/`Cache-Control`) en los catálogos casi inmutables (`dias-semana`, `jornadas`, `roles`).

**Experiencia:**
- Estados de carga: `ProtectedRoute` muestra un "Cargando…" a pantalla completa mientras
  resuelve el perfil — destella en cada navegación. Usar esqueletos y una caché del perfil en
  contexto.
- Sin *error boundary* de React: una excepción en cualquier página deja la pantalla en blanco.
- Sin estado vacío diferenciado: "sin resultados" y "error al cargar" se ven igual en varias
  pantallas.
- Accesibilidad: 86 usos de `aria-label`/`htmlFor` (base razonable), pero sin auditoría
  formal de contraste, orden de foco ni navegación por teclado.
- Sin indicación de trabajo en curso durante la generación con OR-Tools, que puede tardar
  decenas de segundos.

---

## 6. Plan de trabajo

Cinco olas. La 1 es innegociable; las demás admiten reordenamiento según prioridad de negocio.

---

### Ola 1 — Estabilizar (1 semana) — **bloqueante**

| # | Tarea | Hallazgo | Esf. |
|---|---|---|---|
| 1.1 | Registrar los 7 modelos faltantes en `alembic/env.py` + endurecer `include_object` contra DROP de tablas + test de cobertura de metadatos | C-1 | S |
| 1.2 | Mover `celdasDesdeHorarios` fuera de `GridAsistente.tsx` → CI en verde | C-3 | S |
| 1.3 | Commitear las 1.231 líneas pendientes en rama de trabajo; podar árboles y ramas residuales | A-9 | S |
| 1.4 | Mover archivos con datos reales fuera de la raíz o a `.gitignore` | B-1 | S |
| 1.5 | Bloqueo pesimista en `crear`/`actualizar` de horarios (parche de C-2) | C-2 | S/M |
| 1.6 | `logging` estructurado + ID de petición + manejador global de excepciones | A-7 | S/M |

**Criterio de cierre:** CI en verde; `alembic revision --autogenerate` sobre una copia de la
base produce un diff vacío; dos peticiones concurrentes de cruce → una 201 y una 409.

---

### Ola 2 — Cerrar el control de acceso (1-2 semanas)

| # | Tarea | Hallazgo | Esf. |
|---|---|---|---|
| 2.1 | `roles` en las 25 rutas de `AppRouter.tsx` + test de la tabla de rutas | A-1 | S/M |
| 2.2 | Unificar el login por `POST /usuarios/login-documento`; retirar los endpoints públicos de auditoría | C-4 | M |
| 2.3 | `secrets` para el código de instructor; proteger y recortar `/codigo/validar` | A-2 | S |
| 2.4 | Matriz de pruebas de autorización: cada endpoint × cada rol → código esperado | A-8 | M |
| 2.5 | Cabeceras de seguridad; CORS de localhost solo en desarrollo | M-9 | S |
| 2.6 | Cerrar/controlar el auto-alta de perfiles | M-10 | S |
| 2.7 | `max_length` en todos los esquemas, incluidos los de IA | M-2, M-3 | M |

**Criterio de cierre:** la matriz de autorización pasa; ningún endpoint público que no deba
serlo; un Aprendiz que escriba `/panel-administracion` es redirigido.

---

### Ola 3 — Rendimiento y escala (1-2 semanas)

| # | Tarea | Hallazgo | Esf. |
|---|---|---|---|
| 3.1 | Reescribir `auditar_conflictos` como barrido en memoria (~4 consultas) | A-3 | M |
| 3.2 | Eliminar los 5 N+1 remanentes + tests de conteo de consultas | A-4 | S/M |
| 3.3 | `limit`/`offset` y filtros en los listados; `auditoria` con rango obligatorio | A-5 | M |
| 3.4 | División de código por ruta en el cliente | M-1 | S |
| 3.5 | Verificación local del JWT con caché de JWKS | M-8 | M |
| 3.6 | Índices faltantes (documento, código de instructor, `horario_dia.idDia`) | B-7 | S |

**Criterio de cierre:** Auditoría de Cruces con 500 horarios responde en <2 s; `GET /horarios/`
paginado; paquete inicial <300 kB.

---

### Ola 4 — Completar lo incompleto (2-3 semanas)

| # | Tarea | Hallazgo | Esf. |
|---|---|---|---|
| 4.1 | Construir `/solicitudes-acceso` (router + servicio + repositorio) contra el contrato que el cliente ya consume | §4.1 | M |
| 4.2 | Configurar SMTP en el panel de Supabase (SCRUM-129) y cerrar el flujo de credencial temporal | §4.3 | S |
| 4.3 | **Decisión:** construir UI o retirar los 7 módulos huérfanos | §4.2 | — |
| 4.4 | **Decisión:** completar `asistencias` o eliminar modelo y tabla | §4.3 | — |
| 4.5 | Pruebas de `AsistenteHorarios`, `AppShell`, `AuditoriaCruces` | M-5 | L |
| 4.6 | Job de CI para móvil (`flutter analyze` + `flutter test`) y limpieza del cliente Dart | M-6 | M |
| 4.7 | `ruff` en CI; separar `requirements-dev.txt`; fijar dependencias | M-4 | S/M |

**Criterio de cierre:** el panel de administración funciona de punta a punta contra el backend
real; ningún router sin consumidor ni justificación; las tres suites en CI.

---

### Ola 5 — Endurecimiento (planificar, no urgente)

| # | Tarea | Hallazgo | Esf. |
|---|---|---|---|
| 5.1 | Modelo `horario_bloque` + restricción `EXCLUDE USING gist` — cierre definitivo de C-2 | C-2 | L |
| 5.2 | Suite de integración contra PostgreSQL real en CI | A-6 | M |
| 5.3 | Políticas RLS en Supabase | A-8 | L |
| 5.4 | Respaldos automatizados **con prueba de restauración** | §4.3 | M |
| 5.5 | Contenerización para paridad de entornos | §4.3 | M |
| 5.6 | Notificaciones en vivo con Supabase Realtime | §4.3 | M |
| 5.7 | Auditoría de accesibilidad (contraste, foco, teclado) + *error boundary* | §5 | M |

---

## 7. Decisiones que requieren al equipo, no al código

1. **Los 7 módulos sin interfaz** — ¿se construyen o se retiran? Mantenerlos tiene coste
   permanente y valor cero.
2. **`asistencias`** — ¿está en el alcance? Si no, eliminar el modelo y la tabla.
3. **C-2** — ¿se acepta el parche de bloqueo pesimista para este trimestre, o se prioriza el
   cambio de modelo?
4. **Bloqueo por intentos fallidos (RF-001)** — ¿ventana deslizante de 15 min o desbloqueo por
   Administrador? `auditoria_service.py:8-14` (comentario de `LOGIN_LIMITE_INTENTOS`) señala que la documentación no lo define.
5. **`main` vs `develop`** — ¿cuál es la rama de despliegue? Hoy divergen en ambos sentidos.

---

## 8. Reproducir esta revisión

```bash
cd backend  && .venv/bin/python -m pytest -q          # 195 pasan
cd frontend && npm run test                            # 210 pasan
cd frontend && npm run lint                            # 1 error (C-3)
cd frontend && npm run build                           # 912 kB (M-1)

# C-1 — modelos ausentes del metadata de Alembic
diff <(ls backend/app/models/*.py | xargs -n1 basename | sed 's/\.py//' | grep -v __init__ | sort) \
     <(sed -n '/^from app.models import/,/^)/p' backend/alembic/env.py | grep -oP '^\s+\K\w+' | sort)

# A-1 — ninguna ruta declara roles
grep -c "roles=" frontend/src/routes/AppRouter.tsx     # → 0

# A-5 — ningún endpoint pagina
grep -rn "limit\|offset\|skip" backend/app/api/v1/*.py | grep -v "^.*#"

# §4.1 — el endpoint que el cliente consume no existe
grep -rn "solicitudes-acceso" backend/app/             # solo el __tablename__
```

---

*Revisión ejecutada sobre `b2c6819` el 2026-09-20. Cada hallazgo fue verificado leyendo el
código citado; los resultados de las suites provienen de ejecuciones reales de esta sesión.
Ningún hallazgo de seguridad fue explotado — todos son de revisión de código.*
