# Diagnóstico Docker local de SIHS

Fecha: 2026-11-22 (America/Bogota). Se inspeccionó y posteriormente se reparó el arranque del entorno demo. No se incluyen valores de claves, tokens, contraseñas ni archivos `.env` completos.

## Estado final verificado

`make demo-up` termina correctamente y deja el entorno listo para pruebas:

- Frontend HTTP 200 en `http://127.0.0.1:5173`.
- FastAPI salud HTTP 200 en `http://127.0.0.1:8000/api/v1/health`.
- Supabase REST HTTP 200 en `http://127.0.0.1:54321/rest/v1/`.
- Mailpit SIHS HTTP 200 en `http://127.0.0.1:8025`.
- Desde FastAPI se comprobó TCP hacia Supabase API, PostgreSQL y `mailpit:1025`.
- Un inicio de sesión nuevo con la cuenta demo llegó al dashboard y las llamadas autenticadas a `/api/v1/usuarios/me` devolvieron HTTP 200.

## Servicios actuales

| Servicio | Función | Puerto interno | Puerto publicado | Host | Estado |
|---|---|---:|---:|---|---|
| `sihs-demo-frontend-1` | React/Vite | 5173 | `127.0.0.1:5173` | navegador: `127.0.0.1` | Activo |
| `sihs-demo-backend-1` | FastAPI/Uvicorn | 8000 | `127.0.0.1:8000` | navegador: `127.0.0.1` | Activo |
| `sihs-demo-mailpit-1` | SMTP demo y buzón web SIHS | 1025, 8025 | `127.0.0.1:8025` | backend: `mailpit` | Activo y saludable |
| `supabase_db_sihs` | PostgreSQL 17 | 5432 | `127.0.0.1:54322` | backend: `host.docker.internal` | Activo y saludable |
| `supabase_kong_sihs` | API Gateway Supabase | 8000 | `127.0.0.1:54321` | backend: `host.docker.internal` | Activo y saludable |
| `supabase_auth_sihs` | Supabase Auth / GoTrue | 9999 | interno de Supabase | vía Kong | Activo y saludable |
| `supabase_studio_sihs` | Supabase Studio | 3000 | `127.0.0.1:54323` | host | Activo y saludable |
| `supabase_inbucket_sihs` | Buzón de correos nativos de Supabase | 1025, 8025 | UI `127.0.0.1:54324` | red Supabase | Activo y saludable |
| `supabase_rest_sihs` | PostgREST | 3000 | vía Kong | red Supabase | Activo |
| `supabase_realtime_sihs` | Realtime | 4000 | vía Kong | red Supabase | Activo y saludable |
| `supabase_storage_sihs` | Storage API | 5000 | vía Kong | red Supabase | Activo y saludable |
| `postgres-test` | PostgreSQL de integración | 5432 | `127.0.0.1:55440` cuando se inicia | pruebas | No requerido por demo |

Existe otro stack Docker llamado `brota-demo` en los puertos 3001, 5174 y 55321–55324. No es parte de SIHS.

## Docker y topología

- `compose.demo.yml` declara `backend`, `frontend` y `mailpit`.
- `backend/Dockerfile.dev` usa Python 3.14 y Uvicorn con recarga.
- `frontend/Dockerfile.dev` usa Node 22 Alpine y Vite.
- `sihs-demo_default` conecta frontend, backend y Mailpit.
- `supabase_network_sihs` conecta los componentes internos de Supabase.
- Las redes están separadas. FastAPI conecta con Supabase por los puertos publicados en el host mediante `host.docker.internal`.
- Volúmenes principales: `supabase_db_sihs` para datos de PostgreSQL, más volúmenes de Storage y Edge Runtime. FastAPI monta `backend/.env` como solo lectura y el código `backend/app`; Vite monta `frontend/src`.

## Backend, PostgreSQL y Auth

`backend/app/core/config.py` carga `backend/.env` mediante una ruta absoluta. Las variables usadas son:

| Variable | Finalidad | Estado local por nombre |
|---|---|---|
| `APP_NAME`, `APP_ENV` | Aplicación y entorno | Configuradas |
| `DATABASE_URL`, `ALEMBIC_DATABASE_URL` | SQLAlchemy y Alembic | Configuradas |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth, validación y administración | Configuradas |
| `FRONTEND_URL` | CORS y enlaces | Configurada |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NOMBRE` | SMTP propio de FastAPI | Las variables demo se inyectan desde Compose |
| `GEMINI_API_KEY` | Capa IA opcional | Configurada en `.env` |

SQLAlchemy usa `DATABASE_URL`, UTF-8, `pool_pre_ping`, reciclado de conexiones y `prepare_threshold=None` para compatibilidad con poolers. La URL efectiva del contenedor backend apunta al PostgreSQL local en `host.docker.internal:54322`.

El navegador usa `@supabase/supabase-js` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El cliente adjunta el token Bearer a FastAPI. FastAPI valida ese token contra `SUPABASE_URL/auth/v1/user` y usa Service Role solo para altas administrativas. La validación de login nueva confirmó que frontend, Auth y FastAPI apuntan al mismo stack local.

## Supabase local

`supabase/config.toml` habilita API, Auth, Realtime, Storage y Studio. Puertos: API 54321, PostgreSQL 54322, Studio 54323, UI de correo nativo 54324 y Analytics 54327. Las migraciones están habilitadas; se usa `supabase/migrations/20261118231423_sihs_schema_from_20261118_backup.sql` y el seed `supabase/seed.sql`.

El API de Supabase y la base de datos responden. No se ejecutaron migraciones, reinicios de base de datos ni escrituras de datos como parte de la validación.

## Correo

### Mailpit de SIHS

- FastAPI usa `mailpit:1025` al ejecutarse con `APP_ENV=demo`.
- No requiere autenticación ni STARTTLS en demo.
- Los mensajes propios de SIHS se consultan en `http://127.0.0.1:8025`.
- Se comprobó desde FastAPI la conexión TCP a `mailpit:1025`.

### Buzón de Supabase

- Supabase opera su propio buzón local para correos nativos de Auth.
- Se consulta en `http://127.0.0.1:54324`.
- Es independiente de Mailpit SIHS y pertenece a la red interna de Supabase.

En producción, `EmailService` exige `SMTP_USER` y `SMTP_PASSWORD`, ejecuta STARTTLS y autenticación. En demo evita ambos deliberadamente.

## Cargadores masivos

| Flujo | UI / endpoint | Requisitos |
|---|---|---|
| Instructores | Excel `.xlsx` / `/instructores/alta/importar` | `openpyxl`, `python-multipart`, PostgreSQL, Supabase Service Role y SMTP |
| Aprendices | Excel `.xlsx` / `/aprendices/alta/importar` | `openpyxl`, `python-multipart`, PostgreSQL, Supabase Service Role y SMTP |
| Fichas | CSV / creación de fichas por fila | parser CSV frontend, PostgreSQL y catálogos; no requiere SMTP |
| Asistente de horarios | Excel / `/horarios/asistente/importar` | `openpyxl`, `python-multipart`, PostgreSQL; Gemini opcional |
| Currículo | Excel / vista previa curricular | `openpyxl`, `python-multipart`, PostgreSQL |

`backend/requirements.txt` incluye FastAPI, Uvicorn, SQLAlchemy, psycopg, httpx, openpyxl y python-multipart.

## Problema encontrado y reparación aplicada

### Incidencia

Antes de la reparación, el Mailpit declarado por Compose no estaba iniciado. El backend caía al SMTP predeterminado sin autenticación; las altas que requieren correo no podían completar el envío. En un arranque también se observó que Supabase podía no quedar disponible antes de levantar SIHS, causando 503 para sesiones antiguas.

### Reparación

Se actualizó `scripts/demo-up.sh` para comprobar `API_URL/rest/v1/` después de `supabase start` y antes de ejecutar Compose. Si Supabase no está listo, el script falla con una instrucción de diagnóstico en lugar de dejar frontend y backend en estado parcial.

Después se ejecutó `make demo-up`, que levantó Mailpit, backend y frontend. Se reinició Supabase local y se validó nuevamente API, base de datos, SMTP y autenticación.

## Riesgos y recomendaciones

| Prioridad | Riesgo | Recomendación |
|---|---|---|
| Alta | Ejecutar `docker compose -f compose.demo.yml up` directamente no dispone de las variables efímeras `DEMO_*`. | Usar siempre `make demo-up` o `scripts/demo-up.sh`. |
| Media | Supabase y SIHS viven en redes Docker distintas. | Mantener `host.docker.internal` documentado; si se añade SSR o llamadas desde Vite, usar el host adecuado al origen de la petición. |
| Media | Sesiones de navegador previas a un reinicio de Supabase pueden devolver 503 o tokens inválidos. | Cerrar sesión e iniciar nuevamente tras reiniciar Supabase. |
| Baja | El stack `brota-demo` usa puertos similares. | Confirmar que las pruebas SIHS usan 5173, 8000, 54321–54324 y 54327. |

## Límites de comprobación

Se verificaron servicios, conexiones y un login real de lectura. No se crearon usuarios, no se importaron archivos, no se enviaron correos de prueba y no se modificaron datos de la base.
