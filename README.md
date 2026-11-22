# SIHS — Sistema Integral de Horarios SENA

Monorepositorio de gestión de programación académica. Contiene API FastAPI, aplicación web React/TypeScript, cliente Flutter y recursos para pruebas y demostraciones locales.

> **Estado de esta guía (22 de noviembre de 2026):** describe la implementación presente en `fixes-multiples-nicol`, el objetivo de la demo y las comprobaciones pendientes. El informe de Codex del 22/11 identificó un desajuste **entre Compose declarado y los contenedores activos**: no equivale a una prueba de funcionamiento superada. El equipo/Codex puede estar corrigiendo el entorno simultáneamente; antes de actuar, volver a inspeccionar el estado real.

> **Cambio del 22/11/2026 — CSV exclusivo para instructores:** el importador `/instructores/alta/importar` ya **no** recibe XLSX. La primera fila canónica es `nombre,correo,documento,contrato,horas,sigla` (sigla opcional; las otras cinco obligatorias). Admite coma o punto y coma, BOM UTF-8, Windows-1252/Latin-1, comillas y saltos de línea CSV válidos. Acepta encabezados equivalentes `tipoContrato`/`tipo_contrato`, `horasContratadasSemana`/`horas_contratadas_semana`, `email`. Convierte internamente a `tipoContrato` y `horasContratadasSemana`. Límite: **2 MB y 200 instructores**. El archivo del kit ahora es **`01_instructores_alta_masiva.csv`**. El registro individual sigue disponible. **No se cambiaron los formatos de Aprendices/Currículo/IA (XLSX) ni Fichas/Ambientes (CSV).**

## Objetivo de este ciclo: prueba integral antes de la sustentación

Queremos demostrar con **datos piloto coherentes y reemplazables** el recorrido de SIHS: preparar catálogos académicos → importar instructores, aprendices, fichas, ambientes y plan curricular → comprobar cuentas y vínculos → generar, revisar, guardar y publicar horarios (manual o asistido con IA) → consultar los resultados según cada rol. Esta fase usa **Docker + Supabase Auth + PostgreSQL locales**: los Excel son de prueba, no registros institucionales oficiales. La IA **no reemplaza** la carga de los catálogos de referencia.

No confundir los tres conceptos:

- **Carga masiva de instructores:** crea cuentas de Instructor y sus datos contractuales a partir de un `.csv`, con invitación de acceso. **No importa horas docentes asignadas**.
- **Carga masiva de aprendices:** crea cuentas de Aprendiz y las vincula por `codigoFicha` a fichas **ya existentes**. No importar contraseñas provenientes del archivo.
- **Exportar carga docente:** desde Instructores descarga un **CSV de salida**, calculado a partir de horarios existentes. **No recibe Excel ni asigna clases**.

### Vistas actuales y permisos

| Entrada desde la web | Ruta / archivo principal | Archivo que recibe o función | Permisos |
| --- | --- | --- | --- |
| Datos académicos → **Aprendices** | `/aprendices` · `frontend/src/pages/Aprendices.tsx` | Directorio de nombre, correo, documento, ficha, programa, estado, acceso; búsqueda, filtro y paginación | Administrador / Coordinador |
| Aprendices → **Carga masiva** | `/aprendices/carga-masiva` · `frontend/src/pages/CargaAprendices.tsx` | Excel `.xlsx` → revisión de filas → confirmación individual → reporte | Administrador / Coordinador |
| Instructores → **Cargar desde CSV** | `/instructores/registrar?modo=excel` · `frontend/src/pages/AltaInstructores.tsx` | CSV `.csv` con `nombre,correo,documento,contrato,horas` obligatorios y `sigla` opcional | Administrador / Coordinador |
| Instructores → **Exportar carga docente** | `/instructores` · `frontend/src/utils/exportarCargaDocente.ts` | Descarga `.csv` con horas calculadas; **no es importador** | Gestión |
| Fichas → **Carga masiva** | `/fichas` · `frontend/src/pages/Fichas.tsx` | CSV: `codigoFicha,codigoPrograma,trimestre,sede` (sede opcional) | Creación según permiso real de API |
| Ambientes → **Carga masiva** | `/ambientes` · `frontend/src/pages/Ambientes.tsx` | CSV: `numeroAmbiente,nombreAmbiente,tipoAmbiente,sede,estadoAmbiente` | Según permisos de API |
| Programas → plan curricular | `/programas` · `frontend/src/pages/Programas.tsx` | Excel pedagógico con competencias y resultados de aprendizaje | Administrador |
| Temáticas → **Carga masiva** | `/tematicas` · `frontend/src/components/tematicas/CargaMasivaTematicas.tsx` | **El mismo Excel curricular que Programas**; seleccionar programa; reutiliza competencias/resultados coincidentes por descripción | Administrador |
| Programación → **Importar con IA** | `/horarios/asistente-ia` · `frontend/src/pages/AsistenteHorarios.tsx` | Maestro de fichas para generar propuesta; wizard propio, distinto del componente genérico de cargas | Administrador / Coordinador |

**Importante:** Programas y Temáticas son **dos entradas al mismo modelo curricular** (competencia → resultado → fase/horas). Importar el mismo contenido **una sola vez**; no son catálogos independientes. Para la IA, el programa, las fichas, los resultados, los instructores y los ambientes deben existir antes de generar la propuesta. La fase (`numeroFase`) afecta qué resultados se seleccionan para una ficha.

Los cargadores estándar comparten `frontend/src/components/cargaMasiva/FlujoCargaMasiva.tsx`: selección, **vista previa sin escritura**, confirmación, resultados por registro. El parser curricular reside en `backend/app/services/curriculo_service.py`; la creación de cuentas en `backend/app/api/v1/alta_instructores.py` y `backend/app/api/v1/alta_aprendices.py`. El asistente de IA **no** se unificó con los cargadores de catálogo.

### Archivos piloto usados para probar el flujo

Los siguientes son **artefactos de prueba compartidos por separado en la conversación**, no archivos que deban suponerse versionados en GitHub. Conservarlos fuera del repositorio si incluyen correos personales:

| Orden | Nombre del archivo piloto | Dónde cargarlo |
| --- | --- | --- |
| 01 | `01_instructores_alta_masiva.csv` | Instructores → Cargar desde Excel |
| 02 | `02_ambientes_importar.csv` | Ambientes → Carga masiva |
| 03 | `03_fichas_importar.csv` | Fichas → Carga masiva |
| 04 | `04_curriculo_programa_DEMO_ADSO.xlsx` | **Temáticas → Carga masiva** seleccionando `DEMO-ADSO`, **o** Programas → plan curricular (no ambos) |
| 05 | `05_maestro_fichas_para_asistente_IA.xlsx` | Programación → Importar con IA |
| 06 | `06_maestro_piloto_adaptado_2_fichas_4_instructores.xlsx` | Referencia de coordinación con varias hojas; **no** sustituye la importación separada de catálogos |
| 07 | `SIHS_aprendices_desde_semilla_importable.xlsx` | Aprendices → Carga masiva (sustituye el archivo antiguo llamado `07_aprendices_datos_de_prueba_NO_IMPORTABLE.xlsx`) |
| 08 | `08_aprendices_semilla_local.sql` | Alternativa **opcional** de prueba directa en DB; **no ejecutarla si se utilizó el Excel de aprendices** |
| — | `00_LEEME_ORDEN_DE_PRUEBAS.md` | Guía del paquete externo; usar junto a esta guía vigente |

El lote piloto usa fichas `3407178` y `3407179`, programa `DEMO-ADSO`, período `Demo vigente`, sede `Sede Demo SIHS`, cuatro instructores de prueba y cuatro aprendices sintéticos. Un instructor puede tener un correo real de pruebas: **no subir ese dato al repositorio**. Los `@example.com` no entregan mensajes reales; se revisan **en el buzón local**, si SMTP funciona. Los correos `@sihs.local` de una semilla SQL pueden no superar la validación `EmailStr` del cargador: para el Excel importable usar direcciones `@example.com`.

### Arquitectura local y función del SMTP

```text
Navegador (http://127.0.0.1:5173)
  ├─ React/Vite → FastAPI (http://127.0.0.1:8000/api/v1)
  └─ supabase-js → Supabase API/Auth (http://127.0.0.1:54321)

SIHS Compose (red sihs-demo_default):
  backend (FastAPI) ── host.docker.internal:54322 ── PostgreSQL local Supabase
                   ├─ host.docker.internal:54321 ──── Supabase Auth/API
                   └─ mailpit:1025 ───────────────── Mailpit dedicado (solo demo)

Supabase CLI (red supabase_network_sihs):
  PostgreSQL, Auth, REST, Studio (54323), su buzón nativo (UI 54324)
```

**SMTP es Simple Mail Transfer Protocol**: el backend lo usa para enviar el correo con la **contraseña temporal generada en servidor** a las cuentas nuevas de instructores y aprendices. **Supabase Auth** crea/autentica la identidad, **PostgreSQL** registra perfil/rol/ficha, **SMTP/Mailpit** captura la invitación. Las contraseñas **no** se importan desde Excel ni se muestran en la vista previa; el usuario debe cambiarlas en el primer ingreso. Si el envío falla después de crear la identidad, puede quedar una cuenta con correo pendiente: verificar el resultado por fila antes de repetir.

**Configuración deseada del Compose actual (`compose.demo.yml`):** `APP_ENV=demo`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_USER=""`, `SMTP_PASSWORD=""`. En esa topología `EmailService.correo_demo_local()` omite STARTTLS y autenticación **solo en modo demo**. Su interfaz está en **http://127.0.0.1:8025**. Los correos nativos del Supabase CLI se inspeccionan **por separado** en **http://127.0.0.1:54324**. No son el mismo buzón. En otros entornos se requiere SMTP con credenciales y STARTTLS según `backend/app/services/email_service.py`; no usar el SMTP anónimo de demo en producción.

**Hallazgo reproducido por diagnóstico local de Codex (22/11/2026):** frontend, FastAPI, PostgreSQL y Supabase están operativos; pero en los contenedores observados **no existía el Mailpit dedicado**, no figuraban las variables SMTP de Compose y FastAPI usaba los valores por defecto `smtp.gmail.com:587` sin credenciales. Esto explica el aviso **«No es posible crear cuentas todavía: el correo SMTP no está configurado»**. Se confirmó la deriva entre **configuración declarada y contenedores activos**, no la resolución posterior de ella. La conectividad con Supabase local estaba disponible; eso **no demuestra** que todos los intentos de alta funcionen hasta probar la petición real.

### Arranque y verificación para el equipo / Codex

Usar desde la raíz del repositorio:

```bash
git branch --show-current
# Verifica que estés en fixes-multiples-nicol antes de modificar archivos.
make demo-up
make demo-info
docker compose -f compose.demo.yml ps
curl -I http://127.0.0.1:8025
```

`make demo-up` invoca **`scripts/demo-up.sh`**, que arranca/verifica Supabase CLI, obtiene `API_URL`, `DB_URL`, `ANON_KEY` y `SERVICE_ROLE_KEY` a través de `supabase status -o env` y las inyecta como variables `DEMO_*` antes de lanzar Compose. **No ejecutar `docker compose -f compose.demo.yml up` aisladamente** si esas variables no están presentes: el diagnóstico detectó que pueden quedar vacías y desconectar FastAPI de la BD o de Auth. No imprimir ni copiar los valores de claves en informes o logs.

Para verificar SMTP **sin mostrar secretos**:

```bash
docker exec sihs-demo-backend-1 python -c "from app.core.config import settings; from app.services.email_service import EmailService; print('APP_ENV:', settings.app_env); print('SMTP:', settings.smtp_host, settings.smtp_port); print('Configurado:', EmailService.smtp_configurado())"
```

En la configuración esperada, la salida incluye `APP_ENV: demo`, `SMTP: mailpit 1025` y `Configurado: True`. Comprobar también que el servicio `mailpit` aparece en `docker compose -f compose.demo.yml ps` y que la UI responde. **No hacer `make demo-reset` para reparar el SMTP:** ese comando elimina datos locales de prueba. Evitar modificar/detener el stack ajeno `brota-demo`.

Secuencia de aceptación antes de la sustentación:

1. **Revisar conectividad:** inicio de sesión con Administrador, salud de API, SMTP efectivo y Mailpit.
2. **Instructores:** cargar archivo 01 CSV con los encabezados `nombre,correo,documento,contrato,horas,sigla`; validar 4 filas; confirmar; comprobar cuentas/roles y 4 invitaciones o estados específicos; ensayo de primer inicio y cambio de clave. Un 503 puede indicar SMTP o Supabase Admin; revisar el diagnóstico de la pantalla y los logs de backend.
3. **Ambientes y Fichas:** cargar archivos 02 y 03; verificar programa `DEMO-ADSO`, período `Demo vigente` y sede `Sede Demo SIHS` existentes. Probar duplicados y mensajes de error por fila.
4. **Aprendices:** usar el Excel 07 desde Aprendices → Carga masiva; ficha obligatoria; confirmar, comprobar listado por ficha, rol Aprendiz, correo y acceso.
5. **Currículo:** cargar archivo 04 **en Temáticas o Programas**; verificar competencias, resultados, horas y fase 1. No duplicarlo.
6. **Programación:** subir 05 al asistente con IA, revisar propuesta, conflictos y disponibilidad de instructores/ambientes; guardar/publicar; verificar desde Instructor y Aprendiz.

**Estado de pruebas:** se incorporaron archivos de tests y comprobaciones de UI/API, pero no hay evidencia de que todo este circuito se haya ejecutado satisfactoriamente en Docker. Ejemplos de suites para ejecutar, desde sus respectivas carpetas:

```bash
cd backend
python -m pytest tests/test_alta_instructores.py tests/test_alta_aprendices.py tests/test_email_demo.py -q
cd ../frontend
pnpm exec vitest run tests/unit/pages/AltaInstructores.test.tsx tests/unit/pages/CargaAprendices.test.tsx tests/unit/pages/Tematicas.test.tsx tests/unit/pages/Fichas.test.tsx
pnpm lint
pnpm build
```

Si alguna prueba falla, registrar **comando, salida sin secretos, ruta, estado HTTP, caso y corrección**; no marcar «resuelto» solamente por haber hecho commit. Los errores 500/503 requieren consultar `docker compose -f compose.demo.yml logs --tail=100 backend mailpit` sin compartir contraseñas.

### Coordinación de trabajo paralelo

En este ciclo los cambios GitHub deben hacerse desde la cuenta **Nicol (`nicolneira07-tech`) exclusivamente en `fixes-multiples-nicol`**. Codex está investigando/reparando el entorno de Docker simultáneamente: **antes de editar Compose, scripts de arranque, EmailService o README, comparar los cambios recientes y evitar sobrescribir trabajo no integrado**. No hacer `pull` destructivo, `reset`, `down -v`, cambios a `main/develop` ni despliegues sin coordinar. El archivo diagnóstico `DIAGNOSTICO_DOCKER_SIHS.md` fue aportado fuera del repositorio; documenta el estado observado el 22/11, que debe **revalidarse**, no asumirse permanente.

Fuentes de detalle: [guía de cargas masivas](docs/GUIA_CARGAS_MASIVAS.md), [demo local](DEMO_LOCAL.md) y [frontend](frontend/README.md). Si estas guías anteriores discrepan sobre el SMTP, **la configuración efectiva debe compararse con `compose.demo.yml` y `EmailService`; nunca aplicar instrucciones históricas ciegamente**.

---

## Dónde empezar

| Área | Documentación |
| --- | --- |
| Web (React, Vite, TypeScript y Tailwind v4) | [frontend/README.md](frontend/README.md) y [estructura](frontend/ESTRUCTURA.md) |
| API (FastAPI, SQLAlchemy, Supabase Auth) | [backend/README.md](backend/README.md) |
| App Flutter (instructor y aprendiz) | [mobile/README.md](mobile/README.md) |
| Base de datos y migraciones | [database/README.md](database/README.md) |
| Demo local desechable | [DEMO_LOCAL.md](DEMO_LOCAL.md) |
| Guía visual vigente | [Guía de marca v3](docs-sihs/Diseño/GUIA_DE_MARCA.md) |
| Arquitectura y requisitos | [Índice documental](docs-sihs/README.md) |
| Testing | [docs-testing/README.md](docs-testing/README.md) |

## Funcionamiento actual

- **Gestión:** administrador y coordinador pueden consultar programación, crear horarios manualmente en `/horarios/nuevo`, consultar importación con IA en `/horarios/asistente-ia`, revisar horarios, calendario, conflictos, historial y publicaciones programadas.
- **Datos académicos:** fichas, programas, temáticas, instructores, **aprendices**, ambientes y sedes.
- **Autoservicio:** instructor y aprendiz cuentan con pantallas de horario y asistencia acordes a sus permisos; Flutter ofrece la consulta y las operaciones móviles descritas en su propia guía.
- **Autorización:** Supabase Auth autentica; la API valida permisos por rol. Ocultar una ruta o menú en React no reemplaza los controles de backend.
- **Carga inicial:** `AppRouter.tsx` usa importaciones diferidas de páginas y `App.tsx` muestra un fallback mediante `Suspense`.
- **Horario:** el generador valida solapamientos de intervalos, incluidos cruces parciales. La prueba local con PostgreSQL está separada de las pruebas ordinarias.

## Trabajar en la rama de este ciclo

Las actualizaciones de este ciclo se hacen exclusivamente en `fixes-multiples-nicol`. No se debe cambiar de rama ni integrar en `main` o `develop` sin una instrucción explícita.

```bash
git branch --show-current
git pull origin fixes-multiples-nicol
```

## Nota sobre documentación histórica

El material de **Semana 4** que sigue fue redactado para el bootcamp de testing y conserva su valor como consigna histórica. **No describe el estado ni el flujo de ramas vigente de SIHS.**

---

## Archivo histórico: Semana 4

### SIHS · Semana 4 — El API desde cuatro ángulos

> **Rama base:** `semana-4` · **Equipo:** Nicol, David, Dayana y Edith · **Reto:** ≥4 tests nuevos de API por persona + 1 mutante detectado por persona · **Tiempo estimado:** 3 h · **Piso de cobertura:** 50 % en frontend y backend, **sin reducir umbrales heredados superiores**.

**Este README es exclusivo de `semana-4`.** La rama nace de `semana-3`, como base de planificación: **los PR personales pendientes de S2/S3 no se consideran integrados automáticamente**. Antes del cierre de S4, revisar e incorporar por PR los cambios previos que correspondan; no sobreescribir trabajos paralelos. No modificar el README de `main`, `develop` ni de semanas anteriores para este reto.

## 🎯 Parte 1 — Rotación de capa (10 min)

En S2: **Nicol = API**, **David = CI** (rol transversal), **Dayana = BD**, **Edith = Front**. Como David no tuvo una de las cuatro capas de esta consigna, recibe **E2E/seguridad**, nueva para él. El reparto asigna **una capa distinta por persona**, sin repetir la de S2. Aunque roten los ángulos, **todos escriben pruebas HTTP contra endpoints reales FastAPI**.

| Integrante | Capa S2 | Capa S4 / ángulo | Recurso real de SIHS | Rama personal | Revisor de otra capa |
|---|---|---|---|---|---|
| **Nicol** | API | **Front — contrato JSON consumido por React** | `/api/v1/notificaciones`: lista, conteo, lectura individual y error | `test/s4-front-contrato-nicol` | David (E2E) |
| **David** | CI (transversal) | **E2E — permisos, autenticación y errores API** | `/api/v1/fichas`: creación/listado según rol; peticiones inválidas y errores genéricos | `test/s4-e2e-seguridad-david` | Edith (BD) |
| **Dayana** | BD | **API — CRUD del recurso central** | `/api/v1/horarios`: crear, consultar, actualizar y eliminar | `test/s4-api-horarios-dayana` | Nicol (Front) |
| **Edith** | Front | **BD — dependencias de datos** | `/api/v1/solicitudes-acceso`: solicitud duplicada y filtro por estado; relaciones en fichas si aplica | `test/s4-bd-datos-edith` | Dayana (API) |

**No duplicar casos existentes:** revisar `backend/tests/` y añadir al menos cuatro escenarios **nuevos por persona**. Los escenarios siguientes son una propuesta verificable contra los routers actuales, no afirmaciones de tests ya implementados.

### Nicol — Front / contrato de notificaciones (≥4)

Archivo sugerido: `backend/tests/test_s4_contrato_notificaciones_nicol.py`. Router: `backend/app/api/v1/notificaciones.py`. Pantalla consumidora: `frontend/src/components/NotificacionesPanel.tsx`.

1. `GET /api/v1/notificaciones/` autenticado: `200`, JSON array con campos exactos que consume la interfaz (por ejemplo `idNotificacion`, `tipo`, `mensaje`, `leida`, `fechaCreacion`); comparar esquema con `app/schemas/notificacion.py`.
2. `GET /api/v1/notificaciones/conteo-no-leidas`: `200`, `application/json` y `noLeidas` numérico.
3. `PATCH /api/v1/notificaciones/{id}/leida`: respuesta JSON actualizada con `leida=true` y los campos usados al refrescar la lista.
4. `PATCH /api/v1/notificaciones/{id-inexistente}/leida`: `404` con `detail` utilizable por el frontend; comprobar ausencia de stack trace o SQL.

Usar `TestClient`, identidad simulada y servicio/repo aislado; verificar **código, cuerpo y Content-Type** en al menos uno. No sustituir pruebas HTTP por mocks de la interfaz React.

### David — E2E / seguridad transversal HTTP (≥4)

Archivo sugerido: `backend/tests/test_s4_seguridad_errores_david.py`. Router: `backend/app/api/v1/fichas.py`, dependencias `app/core/supabase_auth.py` y manejo de errores en `app/main.py`.

1. `POST /api/v1/fichas/` sin token → `401` y error JSON.
2. `POST /api/v1/fichas/` con rol sin permiso → `403` y error JSON (crear datos de acceso falsos con fixtures).
3. `GET /api/v1/fichas/` con rol autorizado → respuesta definida por contrato, sin red real.
4. Enviar **JSON sintácticamente mal formado** a un endpoint que reciba body: verificar el código **real de FastAPI** (normalmente `422`, no asumir `400`), `application/json` y ausencia de traceback, SQL o secretos.
5. Caso adicional recomendado: payload con tipos inválidos y respuesta segura, o `500` simulado con `TestClient(..., raise_server_exceptions=False)`.

Los tests deben ejecutarse mediante HTTP simulado contra `app`; **no** llamar entornos productivos ni usar credenciales reales. Para roles, diferenciar no autenticado (`401`) de autenticado sin permisos (`403`).

### Dayana — API / CRUD de horarios (≥4)

Archivo sugerido: `backend/tests/test_s4_crud_horarios_dayana.py`. Router: `backend/app/api/v1/horarios.py`.

1. `POST /api/v1/horarios/` con datos válidos y rol programador → `201`, campos de respuesta.
2. `GET /api/v1/horarios/{id}` existente → `200`; contrastar identidad y campos esenciales.
3. `GET /api/v1/horarios/{id-inexistente}` → `404` y `detail`.
4. `PUT /api/v1/horarios/{id}` o método de actualización que realmente defina el router → validar el cambio; alternativa adicional: `DELETE` según la ruta existente.
5. Recomendado: `POST` inválido → `422` y estructura de error; o cruce de horario → `409` con estructura de conflictos.

Confirmar las rutas exactas y preparar datos sin dependencias externas; reutilizar fixtures y aislar el servicio/repositorio donde corresponda. El `409` sólo se exige si ese escenario real existe.

### Edith — BD / datos y reglas (≥4)

Archivo sugerido: `backend/tests/test_s4_datos_solicitudes_edith.py`. Router: `backend/app/api/v1/solicitudes_acceso.py`.

1. `POST /api/v1/solicitudes-acceso/` válido → `201` con contrato de respuesta, simulando el servicio.
2. Solicitud duplicada pendiente → verificar el contrato **actual `400`** y `detail`; el reto propone `409` como ejemplo, pero **no cambiarlo a ciegas**: si se acuerda estandarizar a `409`, documentar y corregir implementación, consumidores y tests.
3. `GET /api/v1/solicitudes-acceso/?estado=pendiente` con administrador simulado → sólo registros pendientes; otros estados sin contaminación.
4. `GET /api/v1/solicitudes-acceso/?estado=...` inválido → `422` en JSON, sin acceso a BD real.
5. Recomendado: recurso relacionado inexistente (rol de solicitud) → `404`; o regla de integridad en `fichas` conforme al servicio existente.

Simular servicio/repositorio con `monkeypatch` y `vi.mock` **no aplica** a Python. Verificar las respuestas HTTP reales, no sólo las funciones Python. Buscar una regla dependiente de datos auténtica y evitar inventar restricciones de borrado.

## 🧪 Parte 2 — Pruebas HTTP y mutantes (2 h)

- Framework existente: **FastAPI + pytest + `fastapi.testclient.TestClient`**. Reutilizar `backend/tests/conftest.py`: fixture `client` sustituye `get_db` por SQLite en memoria; `fake_supabase` y `autenticar_como` simulan autenticación. Si una tabla no está en SQLite, elegir un mock de servicio/repositorio en el endpoint probado o ampliar las fixtures **sólo cuando sea necesario**, sin conectar Supabase/PostgreSQL de producción.
- Cada integrante agrega **≥4 tests API nuevos**, con `status_code`, contenido JSON y, en al menos uno, encabezado `Content-Type: application/json`. Diferenciar `400`, `401`, `403`, `404`, `409`, `422`, `500` según el contrato implementado; **no forzar valores que el backend no usa**.
- Un **mutante por integrante**: modificar temporalmente un código de estado, condición, permiso o estructura de error; ejecutar un test que falle, guardar **log rojo**, restaurar código y guardar **log verde**. Nunca subir el mutante final ni presentar la descripción sin evidencia de ejecución.
- Registrar cada hallazgo de contrato/seguridad en el **PR individual**, con endpoint, reproducción, comportamiento anterior, corrección y test que evita regresión. Corregir el backend en la misma semana cuando corresponda, coordinando si afecta otra capa.
- No incluir secretos, `.env`, tokens auténticos, migraciones sobre BD compartida ni llamadas a producción. Datos y fechas deterministas; controles de dependencia restaurados entre tests.

### Ejemplo de hallazgo

> 🔎 Hallazgo: `POST /api/v1/...` con JSON inválido devolvía un formato no documentado. Reproducción: petición de TestClient. Corrección: respuesta JSON uniforme con `detail`. Prueba: `test_json_malformado_devuelve_error_json_seguro`. **Sólo registrar si se reproduce realmente.**

## 🔄 Ramas personales, PR y revisiones cruzadas

Partir siempre de `semana-4`, **nunca directamente de `develop` o `main`**:

```bash
git fetch origin
git switch semana-4
git pull --ff-only origin semana-4
git switch -c test/s4-<capa>-<nombre>
# Implementar ≥4 tests, guardar evidencia mutante rojo/verde...
git add backend/tests/ docs-testing/
git commit -m "test(s4): pruebas API desde angulo <capa>"
git push -u origin test/s4-<capa>-<nombre>
```

| PR individual | Base | Revisor cruzado | Criterio para fusionar |
|---|---|---|---|
| Nicol `test/s4-front-contrato-nicol` | `semana-4` | David | ≥4 tests, mutante rojo/verde, CI verde y revisión |
| David `test/s4-e2e-seguridad-david` | `semana-4` | Edith | ≥4 tests, `401/403` y autorizado, mutante, CI verde y revisión |
| Dayana `test/s4-api-horarios-dayana` | `semana-4` | Nicol | ≥4 tests CRUD, mutante, CI verde y revisión |
| Edith `test/s4-bd-datos-edith` | `semana-4` | Dayana | ≥4 tests según datos, mutante, CI verde y revisión |

Cada persona hace commits desde **su cuenta de GitHub**. El revisor de otra capa ejecuta los tests propios y comprueba evidencia de mutante; no simular aprobaciones. **No fusionar** con CI fallido ni revisión pendiente. La rama general S4 se incorpora a `develop` por flujo aprobado una vez cerrado el trabajo; no tocar `main` durante las entregas individuales.

## 📈 Parte 3 — Cobertura y PR exclusivo de umbrales (20 min)

1. Tras fusionar los cuatro PR personales a `semana-4`, ejecutar la cobertura real del frontend **y** backend, además de lint/build y CI.
2. Registrar en `docs/matriz-rotacion.md` las métricas de frontend (sentencias, ramas, funciones, líneas), global de backend, los PR y las evidencias.
3. Crear desde `semana-4` la rama técnica `chore/s4-umbrales-cobertura` y un **quinto PR** a `semana-4`; no mezclar el aumento de umbrales en los PR personales.
4. Por cada métrica: **umbral nuevo = máximo(50 %, piso de cobertura real, umbral heredado vigente)**. Si la medición no alcanza el umbral heredado, agregar o corregir tests y código; **jamás reducir umbrales** para forzar CI verde.
5. El frontend no incorpora tareas nuevas de implementación esta semana, pero **sí debe medirse y mantener su cobertura**. Si estuviera por debajo de 50 %, asignar pruebas de componentes adicionales y registrarlo en la matriz.

**Umbrales heredados conocidos (mínimos que no pueden reducirse):**

| Métrica | Umbral anterior |
|---|---:|
| Front — sentencias | 76,73 % |
| Front — ramas | 64,85 % |
| Front — funciones | 73,89 % |
| Front — líneas | 79,59 % |
| Backend — global | 84 % |

Comprobar si S2/S3 aprobadas subieron estas cifras: el valor vigente puede ser mayor. **No confundir pisos del reto (50 %) con los umbrales reales del repositorio.**

```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest -v --cov=app --cov-report=term --cov-fail-under=84

cd ../frontend
pnpm install --frozen-lockfile
pnpm test:coverage
pnpm lint
pnpm build
```

### Entregables y checklist

- [ ] Columna **S4** de la matriz: una capa distinta a S2 para cada integrante.
- [ ] Cuatro suites personales con **≥4 tests nuevos API** cada una (≥16 total).
- [ ] Cuerpo, código y Content-Type verificados, errores y datos simulados.
- [ ] Cuatro mutantes independientes con evidencia **roja y verde** y código restaurado.
- [ ] Hallazgos de contratos/seguridad registrados y corregidos cuando se reproduzcan.
- [ ] Seguridad `401`, `403` y autorizado probada en endpoints reales.
- [ ] Cuatro PR personales revisados por otra capa, CI verde y fusionados en `semana-4`.
- [ ] Cobertura real de **frontend y backend** en matriz sin retrocesos.
- [ ] Quinto PR de umbrales cerrado con piso ≥50 % y umbrales heredados conservados; CI verde.
- [ ] Integración de `semana-4` a `develop` acordada con el equipo.

## 🎙️ Vocero aleatorio

Cada integrante prepara **un endpoint de otra persona**: explicar códigos HTTP, mostrar aislamiento de BD mediante `client`/`get_db` y mocks, y ejecutar una solicitud mal formada con TestClient o `curl` contra **entorno local**, explicando JSON y código. No depender de credenciales ni servicios reales.

---

## 📘 Información general del proyecto

### SIHS — Sistema de Información de Horarios SENA

SIHS es un monorepo con una API REST, un cliente web y una aplicación móvil
para consultar y gestionar información académica y horarios. Los tres
clientes usan Supabase para autenticación y PostgreSQL; la web y el móvil
consumen la API FastAPI.

## Inicio rápido

### Requisitos

- Git
- Python y Node.js
- Flutter SDK, solo para ejecutar la aplicación móvil
- Acceso al proyecto Supabase del equipo

Antes de iniciar, configura las variables de entorno siguiendo
[`database/README.md`](./database/README.md). No compartas ni subas archivos
`.env`.

### Backend

En PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

La API queda en `http://127.0.0.1:8000`; Swagger, en
`http://127.0.0.1:8000/docs`. Completa `backend/.env` antes de usar las
funciones que requieren Supabase.

### Aplicación web

En otra terminal de PowerShell:

```powershell
cd frontend
pnpm install
Copy-Item .env.example .env
pnpm dev
```

Vite muestra la URL local, normalmente `http://localhost:5173`. Consulta
[`frontend/README.md`](./frontend/README.md) para pruebas unitarias y E2E.

### Aplicación móvil (opcional)

```powershell
cd mobile
flutter pub get
Copy-Item .env.example .env
flutter run
```

La configuración de red para emuladores y dispositivos físicos está en
[`mobile/README.md`](./mobile/README.md).

## Estructura

| Ruta | Contenido |
|---|---|
| [`backend/`](./backend/) | API FastAPI, reglas de negocio, pruebas y migraciones Alembic |
| [`frontend/`](./frontend/) | Cliente web React, TypeScript y Vite |
| [`mobile/`](./mobile/) | Aplicación Flutter |
| [`database/`](./database/) | Esquema SQL y guía de Supabase |
| [`docs-sihs/`](./docs-sihs/) | Documentación funcional, técnica y de diseño |

Guías de referencia:

- [Arquitectura móvil](./docs-sihs/Arquitectura/ARQUITECTURA_MOBILE.md)
- [Flujo de trabajo del monorepo](./docs-sihs/Documentación%20general/GUIA_MONOREPO.md)
- [Índice de informes de pruebas](./docs-testing/informes-historicos/README.md)

Cada componente mantiene su propia guía de ejecución. Para cambios de esquema
de base de datos, revisa primero
[`database/README.md`](./database/README.md); no ejecutes scripts de creación,
datos de prueba o migraciones contra una base compartida sin autorización.

## Flujo de trabajo

El trabajo se integra normalmente mediante Pull Request hacia `develop`. Crea
una rama para cada cambio:

```powershell
git switch develop
git pull origin develop
git switch -c feature/nombre-del-cambio
```

Al terminar:

```powershell
git add ruta/de/los/archivos
git commit -m "tipo(área): descripción breve"
git push -u origin feature/nombre-del-cambio
```

## Licencia y autores

Proyecto académico desarrollado en el programa de formación ADSO del SENA.

## Pruebas de Semana 3

Los tests de componentes de la Semana 3 (Login, Registro, NotificacionesPanel y RecuperarContrasena), su evidencia de mutación y la matriz de revisión están documentados en la [guía completa de Semana 3](./docs-testing/SEMANA_3_GUIA.md), los [informes de pruebas](./docs-testing/reportes/) y la [matriz de rotación](./docs/matriz-rotacion.md).
