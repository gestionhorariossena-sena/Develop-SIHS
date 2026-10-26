# Frontend SIHS

Cliente web construido con React + Vite + TypeScript + Tailwind.

## Requisitos y configuración

Se requiere Node.js y pnpm. Desde PowerShell, en la raíz del repositorio:

```powershell
Set-Location frontend
pnpm install
Copy-Item .env.example .env
```

Completa `frontend/.env` con la URL y la clave pública de Supabase y la URL
del backend. Consulta [`../database/README.md`](../database/README.md).

## Ejecución

```powershell
pnpm dev
```

Vite muestra la dirección local, normalmente `http://localhost:5173`. Para
cargar datos reales, inicia también el backend siguiendo
[`../backend/README.md`](../backend/README.md).

## Pruebas unitarias y lint

```powershell
pnpm test
pnpm test:coverage
pnpm lint
```

`pnpm test:coverage` ejecuta la suite Vitest, genera el reporte en `coverage/`
y aplica el piso de 30% en sentencias, ramas, funciones y líneas configurado
en `vite.config.ts`. CI usa este mismo comando.

## Pruebas E2E

La suite Playwright compartida está en [`../e2e/`](../e2e/) y ejecuta los
flujos en Chromium, levantando Vite automáticamente. La prueba de login
autentica una cuenta institucional de prueba y verifica que aparezca el panel
del rol esperado. El backend y Supabase deben estar disponibles según
`VITE_API_URL` y las variables de `frontend/.env`. Instala el navegador una
vez y, desde PowerShell, pasa las credenciales y el rol por variables de
entorno (no se guardan en el repositorio):

```powershell
pnpm exec playwright install chromium
$env:E2E_LOGIN_IDENTIFIER = "correo-de-prueba@sena.edu.co"
$env:E2E_LOGIN_PASSWORD = "contraseña-de-prueba"
$env:E2E_EXPECTED_ROLE = "Aprendiz"
pnpm test:e2e
```

`E2E_EXPECTED_ROLE` acepta `Aprendiz`, `Instructor`, `Coordinador` o
`Administrador`; debe corresponder al rol asignado a la cuenta. La cuenta debe
poder iniciar sesión en Supabase y no tener cambio obligatorio de contraseña
pendiente. Los selectores del formulario usan sus etiquetas accesibles
(`getByLabel`), no placeholders. Para abrir el navegador mientras corre la
prueba:

```powershell
pnpm test:e2e --headed
```

Los resultados y trazas de fallos se guardan en `test-results/` y el reporte
HTML en `playwright-report/`; ambos directorios están excluidos de Git.

El test que valida solo la presentación del formulario puede ejecutarse sin
credenciales ni backend:

```powershell
pnpm test:e2e --grep "muestra los campos del formulario"
```

## Documentación de desarrollo

- [`ESTRUCTURA.md`](./ESTRUCTURA.md) — qué es cada carpeta/archivo, y cómo
  una pantalla consume el backend (con ejemplo copiable).
- [`OBJETIVO_Y_SERVICIOS_FALTANTES.md`](./OBJETIVO_Y_SERVICIOS_FALTANTES.md) —
  qué pantallas faltan y de qué módulo del backend dependen.
