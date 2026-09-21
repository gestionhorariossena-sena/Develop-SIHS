# Guía para features nuevas — convenciones ya establecidas

Antes de empezar cualquier ticket del backlog: esto documenta los patrones que
ya usa el sistema, para que una pantalla nueva se sienta parte del mismo
proyecto en vez de reinventar su propio estilo. Cada ticket enlaza acá en vez
de repetir esto — léelo primero.

## 1. Patrón de pantalla "lista de una entidad"

Fichas.tsx, Instructores.tsx y Ambientes.tsx son la referencia — copiá su
estructura, no inventes una nueva:

- **Card de filtros** arriba: buscador de texto libre + selects de filtro +
  "Ordenar por" + botón "Limpiar filtros" (solo visible si hay filtros
  activos) + 3 tarjetas de resumen (KPIs) en la esquina superior derecha de
  esa misma card.
- **Tabla** con paginación de 10 por página (clamped, sin `useEffect` de
  reseteo — ver el patrón `paginaSegura = Math.min(paginaActual, totalPaginas)`
  en cualquiera de esas tres páginas).
- **Drawer lateral** (`DrawerRelacionados`/`SeccionDrawer`,
  `frontend/src/components/relacionados/`) al hacer clic en una fila — nunca
  un modal centrado ni una navegación a otra pantalla para ver el detalle.
- **Deep link bidireccional** vía `?id=` con `useSearchParams` — si esta
  entidad tiene una "Vista por X" asociada (agregada, tipo calendario/grid),
  el drawer debe tener un link hacia allá y viceversa. Ver
  Fichas.tsx ↔ VistaFichas.tsx como ejemplo.
- **Filtros cruzados sin N+1**: si necesitás filtrar una entidad por datos de
  otra (ej. instructores por ficha), no pidas los horarios de cada fila uno
  por uno — pedí `GET /horarios/` una sola vez y derivá índices con
  `frontend/src/components/horario/indexarHorarios.ts` (ya tiene
  `indexarPorInstructor`, `indexarPorFicha`, `indexarPorAmbiente` — agregale
  una función nueva ahí si hace falta, no dupliques la lógica en la página).

## 2. Colores y estilo visual

Ver `_Docs/Diseño/GUIA_DE_MARCA.md` — es la fuente de verdad de color,
tipografía y componentes. Resumen rápido: verde institucional (`sena-600`)
solo para la acción principal de la pantalla, todo lo demás en la escala
`slate-*`. Un módulo sin pantalla todavía se muestra **deshabilitado**, nunca
oculto (ver cualquier ítem sin `ruta` en `AppShell.tsx`).

## 3. Permisos en el backend

Todo endpoint de **lectura** de un catálogo (fichas, instructores, ambientes,
sedes, coordinaciones, trimestres, etc.) usa
`require_lectura_catalogo` (Coordinador + Administrador) — nunca
`require_admin` a secas para un GET. Los de **escritura**
(crear/editar/borrar) sí son `require_admin` o `require_admin_o_coordinador`
según el caso — mirá `app/api/v1/fichas.py` como referencia exacta. Si
agregás un endpoint de catálogo nuevo, seguí el mismo patrón — no lo dejes
en el default de FastAPI.

## 4. Cambios de esquema (migraciones)

Nunca se aplican directo contra la base compartida. El flujo es: escribir el
archivo de migración de Alembic a mano (ver cualquier archivo en
`backend/alembic/versions/` como plantilla, todas tienen un docstring
explicando el porqué del cambio) y que quien tenga acceso la corra con
`alembic upgrade head`. La base compartida no tiene el `stamp head` del
baseline todavía — no lo intentes arreglar vos, es un problema conocido.

## 5. Ramas y PRs

- `develop`/`main` están protegidas — todo entra por PR.
- Una rama por persona (no una rama por tarea) — hacé commits seguidos en tu
  propia rama y pedí el PR cuando esté listo. No dejes ramas de un solo fix
  colgando después de mergear, bórralas.
- Corré `tsc --noEmit`, `npm run lint`, `npm run build` y la suite de tests
  (`pytest` en `backend/`, `vitest run` en `frontend/`) antes de pedir el PR
  — que quede todo en verde es requisito, no un nice-to-have.

## 6. Tests

Cada página nueva lleva su `.test.tsx` con mocks de `apiGet`/`apiPost`/etc.
por ruta (`vi.mock('../services/api', ...)`) — mirá `Fichas.test.tsx` o
`Ambientes.test.tsx` como plantilla de cómo mockear el fetch inicial de
`AppShell` (`/usuarios/me`) sin que rompa el resto del test.

## 7. Antes de reportar un ticket como terminado

1. Funciona en modo claro y oscuro (todo el sistema tiene `dark:` en cada
   clase de color — no lo olvides en lo nuevo).
2. Los datos son reales (`GET` al backend), no texto de ejemplo/hardcodeado.
3. `tsc`, `lint`, `build` y tests en verde.
4. Si agregaste una pantalla nueva, tiene su ítem en `AppShell.tsx` → `NAV`
   con su `ruta`, y su `<Route>` en `AppRouter.tsx`.
