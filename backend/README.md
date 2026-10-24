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
