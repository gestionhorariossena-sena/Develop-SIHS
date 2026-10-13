# SIHS — Sistema de Información de Horarios SENA

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
npm install
Copy-Item .env.example .env
npm run dev
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
| [`_Docs/`](./_Docs/) | Documentación funcional, técnica y de diseño |

Guías de referencia:

- [Arquitectura móvil](./_Docs/Arquitectura/ARQUITECTURA_MOBILE.md)
- [Flujo de trabajo del monorepo](./_Docs/Documentación%20general/GUIA_MONOREPO.md)
- [Índice de informes de pruebas](./_Docs/Informes%20de%20pruebas/README.md)

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
