# Backend SIHS

API REST del sistema, implementada con FastAPI, SQLAlchemy y PostgreSQL
(Supabase).

## Requisitos y configuración

Se requiere Python compatible con las dependencias del proyecto y acceso a
las variables de Supabase. Desde PowerShell, en la raíz del repositorio:

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Completa `backend/.env` con los valores privados. Para configurarlos de forma
segura, consulta [`../database/README.md`](../database/README.md).

## Ejecución

Con el entorno virtual activo:

```powershell
uvicorn app.main:app --reload
```

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- OpenAPI: `http://127.0.0.1:8000/openapi.json`

## Pruebas

Desde `backend/`, con el entorno virtual activo:

```powershell
pytest
```

## Migraciones

Las migraciones del proyecto se administran con Alembic en
[`alembic/versions/`](./alembic/versions/). Antes de generar o aplicar una
migración, sigue el flujo descrito en
[`../database/README.md`](../database/README.md). No apliques cambios de
esquema a una base compartida sin autorización.

## Documentación de desarrollo

- [`ESTRUCTURA.md`](./ESTRUCTURA.md): organización del código y patrones para
  agregar módulos.
- [`OBJETIVO_Y_SERVICIOS_FALTANTES.md`](./OBJETIVO_Y_SERVICIOS_FALTANTES.md):
  módulos pendientes.
- [`PENDIENTE_MVP.md`](./PENDIENTE_MVP.md): pendientes identificados para el
  MVP.
### Integración con PostgreSQL desechable

La suite usual usa SQLite en memoria. Para verificar persistencia y endpoints
contra PostgreSQL real, arranca únicamente la base de pruebas local (no usa
Supabase ni lee `backend/.env`):

```powershell
docker compose -f tests/docker-compose.postgres.yml up -d --wait
$env:SIHS_TEST_DATABASE_URL = "postgresql+psycopg://sihs_test:sihs_test_only@127.0.0.1:55440/sihs_test"
pytest tests/test_real_postgres.py -v
docker compose -f tests/docker-compose.postgres.yml down
Remove-Item Env:SIHS_TEST_DATABASE_URL
```

La suite rechaza cualquier host, puerto, nombre de base o credenciales que no
sean los del contenedor desechable. Incluye una prueba de persistencia JSONB en
`HorarioGuardadoRepository` y una prueba HTTP autenticada que publica un
horario y verifica que solo el instructor asignado lo recibe en `Mi horario`.

## Actualización de generación y entorno local (2026-11-21)

En `app/scheduling/generator.py`, el bloqueo de recursos compara intervalos de tiempo por **solapamiento real**, no solo por igualdad de franjas. Dos clases que se tocan en el límite (por ejemplo 06:00–08:00 y 08:00–10:00) no se superponen, mientras que 07:00–09:00 y 08:00–10:00 sí. Hay casos unitarios en `tests/test_scheduling_generator.py`.

Desde la raíz y con Docker disponible, `make test-run` levanta un PostgreSQL aislado y ejecuta `tests/test_real_postgres.py`; `make test-down` lo elimina. Es una opción Unix/Make alternativa a los comandos PowerShell anteriores. No usar credenciales de bases reales para esta suite.

El repositorio también incluye `backend/Dockerfile.dev`, `compose.demo.yml`, `supabase/config.toml` y un seed sintético para el [entorno local de demo](../DEMO_LOCAL.md). Esta configuración de demo es distinta del entorno remoto y no sustituye las migraciones Alembic de operaciones habituales. No se ha certificado en esta actualización documental que el stack levante correctamente de extremo a extremo.

### Identidad y registro de instructores (2026-11-21)

El sistema **ya no utiliza códigos de instructor para el alta**. Se retiraron los endpoints `POST /usuarios/instructor/codigo/generar` y `POST /usuarios/instructor/codigo/validar` y sus esquemas/servicios de emisión. El registro de Instructor ocurre en Supabase Auth y el Administrador asigna el rol real mediante el flujo de `usuario-rol`; solicitar un rol en metadatos no confiere permisos. Las operaciones académicas siguen utilizando `idUsuario` (UUID) y relaciones de rol, no el código de registro.

Los campos históricos `usuarios.codigoInstructor` y `idTrimestre` no se borraron de base de datos para evitar pérdida de datos o cambios destructivos de migración. No deben interpretarse como requisito de acceso.

## Alta institucional de instructores (2026-11-21)

El router `/api/v1/instructores/alta` permite a **Administrador y Coordinador** crear cuentas, asignarles el rol `Instructor` y enviarles credenciales temporales mediante SMTP. No acepta peticiones de Instructor o Aprendiz.

- `POST /api/v1/instructores/alta/`: alta individual con nombre, correo, documento y datos opcionales de contrato/horas/sigla.
- `POST /api/v1/instructores/alta/importar`: recibe `multipart/form-data` con `archivo` .xlsx; `confirmar=false` devuelve la previa sin efectos; `confirmar=true` procesa hasta 200 filas si todas son válidas.
- Tamaño máximo: 2 MB. Columnas obligatorias: `nombre`, `correo`, `documento`; opcionales: `tipoContrato`, `horasContratadasSemana`, `sigla`. La estructura oficial de Excel de coordinación está **pendiente de recibir y validar**.
- Se rechaza silenciosamente la reutilización de una identidad existente: un correo ya presente en Supabase Auth o documento/correo existentes en SIHS devuelven estado `omitido` sin cambiar contraseñas ni roles.
- Las cuentas nuevas se crean con `debeCambiarClave=True`; el frontend obliga a cambiar la clave inicial. `EmailService.enviar_alta_instructor` envía usuario y clave al correo del instructor; el secreto nunca forma parte de las respuestas API ni de las auditorías.
- `SMTP_USER` y `SMTP_PASSWORD` deben configurarse en el backend antes de realizar altas. El correo se intenta tras confirmar la creación. Si falla, el resultado es `correo_pendiente` y el instructor debe usar el flujo de recuperación de contraseña o soporte administrativo.
- El sistema **no implementa caducidad temporal real** de la contraseña: se fuerza el cambio en primer acceso, pero no se anuncia una expiración de horas sin respaldo técnico. Configurar/verificar SMTP, Supabase Service Role y el dominio frontend antes de producción.

