# Switch local SIHS (PowerShell)

Permite iniciar FastAPI y Vite con un proyecto Supabase DEMO o institucional.
No toca despliegues ni archivos .env existentes. Uso exclusivo local.

## Preparación (una vez)

Desde la raíz del repositorio, copia las plantillas:

    Copy-Item backend/.env.example backend/.env.demo
    Copy-Item backend/.env.example backend/.env.institucional
    Copy-Item frontend/.env.example frontend/.env.demo.local
    Copy-Item frontend/.env.example frontend/.env.institucional.local

Completa cada archivo con credenciales del proyecto correspondiente. Nunca
subas estos archivos a Git ni copies datos institucionales hacia DEMO.

Variables del backend: APP_ENV (demo/institucional), SUPABASE_URL,
SUPABASE_ANON_KEY, SIHS_DEMO_PROJECT_REF, SIHS_INSTITUTIONAL_PROJECT_REF,
DATABASE_URL (pooler Supabase 6543),
ALEMBIC_DATABASE_URL (pooler Supabase 5432). La SERVICE_ROLE_KEY solo
corresponde al backend. En DEMO usa EMBEDDED_PUBLICATION_WORKER=false.

Variables del frontend: VITE_APP_ENV (demo/institucional),
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y
VITE_API_URL=http://127.0.0.1:8000/api/v1.

SIHS_DEMO_PROJECT_REF e SIHS_INSTITUTIONAL_PROJECT_REF son los IDs publicos
que aparecen en las URLs de los dos proyectos Supabase. Deben ser distintos
y sus valores deben ser identicos en ambos archivos del backend.

Los dos URLs de PostgreSQL deben usar el usuario postgres.<project-ref>
y corresponder al identificador presente en SUPABASE_URL.

## Ejecutar desde la raíz (Windows PowerShell)

    .\scripts\start-env.ps1 -Mode demo -Action check
    .\scripts\start-env.ps1 -Mode demo
    .\scripts\start-env.ps1 -Mode institucional -Action check
    .\scripts\start-env.ps1 -Mode institucional

El modo predeterminado es demo. El modo institucional pide escribir
INSTITUCIONAL antes de abrir dos terminales (backend y frontend).
El backend requiere un entorno virtual en backend/.venv y el frontend
requiere pnpm instalado y dependencias instaladas.

Antes de cambiar entre entornos, detén ambos servidores y cierra
sesión en el navegador para evitar reutilizar sesiones Auth.

## Seguridad, comprobaciones y límites

- El comando check compara los project-ref de la allow-list, el frontend, el backend y
  las dos conexiones PostgreSQL; no hace conexiones de red.
- El backend valida su archivo de entorno seleccionado al arrancar.
- No ejecutes alembic upgrade, seeds, scripts de importación ni resets
  en la base institucional.
- La selección institucional es una barrera para errores humanos, no
  reemplaza la autorización o privilegios mínimos del proveedor.
- El selector no cambia Render, Vercel ni la aplicación móvil.
- GET http://127.0.0.1:8000/api/v1/health comprueba que FastAPI responde.
- GET http://127.0.0.1:8000/api/v1/health/ready ejecuta SELECT 1 en PostgreSQL
  y devuelve 200 si conecta, 503 si no. No expone credenciales.
- Ejecuta en backend: python -m pytest tests/test_health.py -v.
  La prueba de disponibilidad simula la conexión; para evidencia real
  consulta /health/ready con el servidor DEMO iniciado.
- Para probar un error, cambia temporalmente solo el project-ref de
  VITE_SUPABASE_URL del entorno DEMO; check debe fallar. Restáuralo.
- Nunca compartas DATABASE_URL, claves privadas o capturas con secretos.
