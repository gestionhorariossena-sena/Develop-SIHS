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
SUPABASE_ANON_KEY, DATABASE_URL (pooler Supabase 6543),
ALEMBIC_DATABASE_URL (pooler Supabase 5432). La SERVICE_ROLE_KEY solo
corresponde al backend. En DEMO usa EMBEDDED_PUBLICATION_WORKER=false.

Variables del frontend: VITE_APP_ENV (demo/institucional),
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y
VITE_API_URL=http://127.0.0.1:8000/api/v1.

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

- El comando check compara los project-ref del frontend, el backend y
  las dos conexiones PostgreSQL; no hace conexiones de red.
- El backend valida su archivo de entorno seleccionado al arrancar.
- No ejecutes alembic upgrade, seeds, scripts de importación ni resets
  en la base institucional.
- La selección institucional es una barrera para errores humanos, no
  reemplaza la autorización o privilegios mínimos del proveedor.
- El selector no cambia Render, Vercel ni la aplicación móvil.
- GET http://127.0.0.1:8000/api/v1/health comprueba el servidor FastAPI,
  pero no acredita una conexión exitosa a la BD.
- Para probar un error, cambia temporalmente solo el project-ref de
  VITE_SUPABASE_URL del entorno DEMO; check debe fallar. Restáuralo.
- Nunca compartas DATABASE_URL, claves privadas o capturas con secretos.
