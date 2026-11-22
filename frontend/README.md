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
pnpm lint
```

## Pruebas E2E

Playwright ejecuta el flujo de inicio de sesión en Chromium y levanta Vite
automáticamente. La prueba autentica una cuenta institucional real de prueba
y verifica que aparezca el panel del rol esperado. El backend y Supabase deben
estar disponibles según `VITE_API_URL` y las variables de `frontend/.env`.
Instala el navegador una vez y, desde PowerShell, pasa las credenciales y el
rol de la cuenta por variables de entorno (no se guardan en el repositorio):

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

## Interfaz web y rutas vigentes (2026-11-21)

La identidad visual de la rama `fixes-multiples-nicol` utiliza los tokens de [Guía de marca v3](../docs-sihs/Diseño/GUIA_DE_MARCA.md). Las páginas se cargan con `React.lazy` desde `src/routes/AppRouter.tsx`, bajo `Suspense` en `src/App.tsx`.

- El menú **Programación** dirige la creación manual a `/horarios/nuevo`; `/horarios/crear` sigue registrada por compatibilidad. La opción `/horarios/asistente-ia` corresponde al flujo de importación con IA.
- **Gestionar horarios** se consulta en `/horarios/completos`, y la cabecera comparte navegación con `/calendario` y `/horarios/auditoria`. Las vistas contextuales de fichas, instructores y ambientes conservan rutas independientes.
- El panel global presenta métricas, clases del día y conflictos; los roles Instructor y Aprendiz tienen paneles y opciones de autoservicio distintos.
- Las páginas de administración y las acciones de coordinación tienen protecciones de ruta; la autorización definitiva reside en el backend.

Para el mapa de componentes, consultas y permisos consulta [ESTRUCTURA.md](ESTRUCTURA.md).

### Comandos recomendados

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

`pnpm test:e2e` delega en `../e2e`; se necesitan sus dependencias y el entorno que requiera cada escenario. No dar por hecho que las pruebas de login funcionan sin credenciales de prueba apropiadas.
