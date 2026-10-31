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

Para generar la línea base de cobertura del paquete `app`:

```powershell
pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=84
```

El reporte HTML queda en `backend/htmlcov/`. CI aplica el umbral de línea base
de S1: 84% de cobertura de sentencias sobre `app` (84,07% en la última corrida
de CI aprobada). Usa `--cov-fail-under=84` al repetir la validación local.

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
