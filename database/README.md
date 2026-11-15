# Base de datos SIHS

SIHS usa PostgreSQL administrado por Supabase. Las aplicaciones se conectan
a la misma instancia: el backend accede a PostgreSQL y Supabase Auth; los
clientes web y móvil usan Supabase Auth y consumen la API del backend.

## Credenciales y archivos `.env`

Solicita las credenciales de desarrollo a una persona autorizada del equipo
y compártelas únicamente por un canal privado. Nunca publiques ni agregues
archivos `.env` al repositorio.

Desde PowerShell, en la raíz del repositorio, crea los archivos locales:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
Copy-Item mobile\.env.example mobile\.env
```

Completa solo los valores necesarios para el componente que vas a ejecutar:

- Backend: `backend/.env` contiene las conexiones PostgreSQL y la
  configuración de Supabase. `SUPABASE_SERVICE_ROLE_KEY` es secreta y solo
  debe estar en el backend cuando una función administrativa la requiera.
- Frontend: `frontend/.env` usa las variables `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL`. No pongas claves secretas en el
  cliente web.
- Móvil: `mobile/.env` usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
  `API_BASE_URL`.

Para ejecutar cada aplicación, consulta el
[README principal](../README.md) y las guías de
[backend](../backend/README.md), [frontend](../frontend/README.md) y
[móvil](../mobile/README.md).

## Esquema y datos de desarrollo

- [`01_creacion.sql`](./01_creacion.sql) contiene el esquema SQL inicial.
- [`02_datos_prueba.sql`](./02_datos_prueba.sql) contiene datos de ejemplo
  para desarrollo.
- [`migrations/`](./migrations/) conserva scripts históricos de cambios
  manuales.
- [`backend/alembic/versions/`](../backend/alembic/versions/) contiene las
  migraciones Alembic que se mantienen actualmente.

No ejecutes el esquema inicial, los datos de prueba ni una migración contra
una base compartida o productiva sin revisar el SQL, confirmar el destino y
obtener autorización. Los datos de prueba pueden crear o modificar usuarios
y registros; úsalos únicamente en una instancia aislada destinada a pruebas.

## Crear y aplicar migraciones

Los cambios de esquema deben partir del modelo correspondiente en
`backend/app/models/`. Desde PowerShell:

```powershell
Set-Location backend
.\.venv\Scripts\Activate.ps1
alembic revision --autogenerate -m "descripcion-corta"
```

Revisa manualmente el archivo que Alembic genera en
`backend/alembic/versions/`; la generación automática puede requerir ajustes.
Aplica migraciones solo después de verificar el destino de la conexión y con
aprobación para cualquier base compartida:

```powershell
alembic upgrade head
```

## Resolución de problemas

- Comprueba que cada componente tenga su `.env` local y que las variables
  coincidan con los nombres de su archivo `.env.example`.
- Verifica `DATABASE_URL` para la conexión de la aplicación y
  `ALEMBIC_DATABASE_URL` para Alembic.
- Si se rotó una contraseña o clave, solicita el valor actualizado por un
  canal privado; no lo pegues en incidencias públicas o commits.
