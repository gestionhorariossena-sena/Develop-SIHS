# Estructura actual del frontend SIHS

Actualizada con referencia al código de `fixes-multiples-nicol` en el commit `e4024b2` (2026-11-21). Esta guía describe el código versionado; no representa una certificación de ejecución.

## Stack

- React 19, TypeScript, Vite 8 y React Router 7.
- Tailwind CSS 4 con tokens en `src/index.css` (`@theme`).
- Supabase JS para autenticación; `src/services/api.ts` para el consumo de la API.
- Vitest y Testing Library para pruebas de React; los escenarios E2E de Playwright están en `../e2e/tests/`.

## Mapa del código

| Ruta | Responsabilidad |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Montaje y proveedores de tema, router y sesión; `Suspense` muestra carga de rutas |
| `src/routes/AppRouter.tsx` | Rutas y carga diferida de páginas con `lazy` |
| `src/routes/ProtectedRoute.tsx` | Protección de navegación y comprobación de roles en cliente |
| `src/context/`, `src/hooks/` | Sesión, preferencias y hooks |
| `src/services/api.ts` | Peticiones HTTP al backend con token Supabase |
| `src/types/api.ts` | Tipos compartidos de respuestas y solicitudes |
| `src/components/AppShell.tsx` | Navegación por grupos y opciones según rol |
| `src/components/horario/` | Grillas, celdas, cruces y adaptadores de horario |
| `src/components/horarios/` | Cabecera de gestión y drawer de bloques |
| `src/pages/` | Páginas de gestión, administración y autoservicio |
| `src/pages/horario/` | Utilidades de grilla, ocupación y parámetros de URL |
| `src/index.css` | Tokens cromáticos, tipografía y estilos globales |

## Rutas y navegación principales

| Rol | Pantallas o entradas |
| --- | --- |
| Gestión (Administrador/Coordinador) | `/dashboard`, `/horarios/nuevo`, `/horarios/asistente-ia`, `/horarios/completos`, `/calendario`, `/horarios/auditoria`, `/horarios/historial`, `/horarios/publicaciones-programadas` |
| Gestión | `/fichas`, `/programas`, `/tematicas`, `/instructores`, `/ambientes`, `/sedes` |
| Solo Administrador | `/usuarios`, `/roles`, `/aprobar-solicitudes`, `/panel-administracion` |
| Instructor | `/mi-horario`, `/asistencia`, `/mis-solicitudes-cambio` |
| Aprendiz | `/mi-horario-aprendiz`, `/mi-asistencia`, `/mensajes`, `/notificaciones` |

`/horarios/crear` permanece registrada para enlaces anteriores; la entrada de creación manual en el menú actual usa `/horarios/nuevo`. Las perspectivas de ficha/instructor/ambiente mantienen rutas propias; no asumir que la unificación propuesta ya fue completada. La cabecera `CabeceraGestionHorarios` enlaza **Lista, Calendario y Conflictos** mediante rutas existentes. `gestionarHorariosQuery.ts` contiene utilidades de URL; su cabecera todavía describe una migración por fases, por lo que no se debe documentar como una única ruta universal plenamente implementada.

## Flujo de datos y permisos

1. `supabaseClient` gestiona la sesión.
2. `apiGet`, `apiPost`, `apiPut`, `apiPatch` y `apiDelete` consumen la URL base `VITE_API_URL`, ya terminada en `/api/v1`.
3. Los tipos públicos de la API se representan en `src/types/api.ts`.
4. Las páginas cargan datos y los muestran mediante componentes reutilizables.
5. Las comprobaciones de menú y `ProtectedRoute` mejoran la experiencia, pero la seguridad se aplica en FastAPI.

## Diseño y consistencia

La referencia vigente es [Guía de marca v3](../docs-sihs/Diseño/GUIA_DE_MARCA.md): verde bosque primario, verde SENA secundario, superficies piedra cálida y advertencias arcilla/ámbar. No introducir una nueva paleta por pantalla ni seguir ejemplos antiguos basados en `sena-*` como patrón recomendado.

## Pruebas y build

Desde `frontend/`:

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

Para pruebas E2E y preparación del entorno consulta [README del frontend](README.md) y [guía de testing](../docs-testing/README.md).
