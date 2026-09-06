# Guía de marca — SIHS (SENA CGMLTI)

**Versión 2 (2026-09-06)** — reemplaza por completo la v1. Pedido explícito
del usuario: adoptar el sistema visual de los mockups de Stitch
(`stitch_sena_schedule_management_mockups/`) en toda la app, en vez del
sistema anterior basado en sidebar + `sena-*`/`slate-*`. Si algo de acá
contradice una captura vieja en `mockups-institucionales/` o
`Dashboard.jpeg`/`Login.jpeg`, **gana esta guía** — esas capturas quedan
como referencia histórica, no como la fuente de verdad actual.

**Fuente de este sistema**: `stitch_sena_schedule_management_mockups/DESIGN.md`
(el único mockup que sigue en el repo, en la raíz del proyecto) — los
valores de color/tipografía de acá se copiaron literalmente de ahí, no se
inventó ninguno.

## Logo

- Archivo: `frontend/src/assets/sena-logo.jpeg`.
- Contenedor cuadrado `rounded-xl`, `h-9 w-9` en el navbar.
- Acompañado del wordmark "SENA" (verde, `text-primary`) + "SIHS" (`text-on-surface`), y debajo "CGMLTI Calle 05" en `text-on-surface-variant`.

## Color

Tokens tipo Material Design 3, definidos en `frontend/src/index.css` con
`@theme` (Tailwind v4, sin `tailwind.config.js`):

| Token | Hex | Uso |
|---|---|---|
| `surface` | `#f8fafc` | Fondo de página |
| `surface-container-lowest` | `#ffffff` | Tarjetas, navbar, dropdowns |
| `surface-container-low` / `surface-container` | `#f1f5f9` / `#e2e8f0` | Fondos alternos, hover de filas |
| `surface-container-high` | `#cbd5e1` | Hover de botones/pills del nav |
| `on-surface` | `#0f172a` | Texto principal |
| `on-surface-variant` | `#475569` | Texto secundario, íconos neutros |
| `outline` / `outline-variant` | `#cbd5e1` / `#e2e8f0` | Bordes |
| `primary` | `#16a34a` | **Acción principal** — botón primario, navbar activo, avatar |
| `on-primary` | `#ffffff` | Texto/ícono sobre `primary` |
| `primary-container` / `on-primary-container` | `#dcfce7` / `#14532d` | Fondo suave de ítem activo (nav, badges positivos) |
| `secondary` | `#39a900` | Verde SENA "institucional" — chip "Trimestre · Sincronizado", acentos secundarios |
| `secondary-container` / `on-secondary-container` | `#eaf7ec` / `#14532d` | Fondo suave de esos chips |
| `tertiary` | `#d97706` | Alertas/advertencias (ámbar) |
| `tertiary-container` / `on-tertiary-container` | `#fef3c7` / `#92400e` | Fondo suave de badges de alerta |
| `error` | `#dc2626` | Errores, acciones destructivas |
| `error-container` / `on-error-container` | `#fee2e2` / `#991b1b` | Fondo suave de badges de error/conteo |

Regla simple: `primary` es la acción/estado activo; `secondary` es un acento
institucional de menor jerarquía (chips informativos); `tertiary` es
advertencia; `error` es error/destructivo. Nunca fondo saturado con texto del
mismo color — siempre "container" claro + texto oscuro del mismo matiz para
texto, y solo el token base (saturado) para el fondo de un botón con texto
blanco encima.

`sena-*` (`sena-600` = `#39a900`, etc.) sigue existiendo en `index.css` como
alias apuntando a estos mismos valores — es compatibilidad para clases ya
escritas, no lo uses en código nuevo; usa `primary`/`secondary` directamente.

### Semántico / badges

Mismo criterio que antes, con los tokens nuevos: `bg-primary-container
text-on-primary-container` para positivo/confirmado, `bg-tertiary-container
text-on-tertiary-container` para atención/advertencia, `bg-error-container
text-on-error-container` para error/conteo urgente, `bg-surface-container
text-on-surface-variant` para neutro/pendiente.

### Color por jornada y grid de horario (sin cambios de esta versión)

Esto sigue igual que en la v1 — es una regla de accesibilidad específica del
grid de horarios, no de la marca general:

| Jornada | Clase de celda | Barra de encabezado |
|---|---|---|
| Mañana | `bg-emerald-200` / `bg-emerald-300/70` | `bg-slate-900` |
| Tarde | `bg-blue-200` / `bg-blue-300/70` | `bg-slate-900` |
| Noche | `bg-emerald-200` / `bg-emerald-300/70` | `bg-slate-900` |

El texto del grid (`GridHorario.tsx`, `CeldaHorario.tsx`) es **siempre
`text-slate-900` (negro), sin variante `dark:`**, y las celdas vacías son
**siempre** `bg-emerald-200`/`bg-blue-200`, también sin `dark:`. Motivo (no
tocar sin releer esto): antes el texto era claro pensado para fondo oscuro,
pero la celda no tenía `dark:bg-*`, así que en modo oscuro quedaba texto
claro sobre fondo claro, casi ilegible. La solución fue fijar fondo saturado
+ texto negro fijo en los dos temas, no dos paletas. Si se toca este grid al
reskinearlo: no agregar `dark:text-*` claro dentro de estas celdas, y no
agregar `dark:bg-*` oscuro sin también pasar el texto a blanco.

## Tipografía

Dos familias vía Google Fonts (`index.css`, `@import url(...)`):

- **Hanken Grotesk** (600/700) — `h1`-`h6` y cualquier título de pantalla o
  sección (aplicado globalmente en `index.css`, no hace falta poner la clase
  de fuente a mano si usas una etiqueta `<h1>`-`<h6>`).
- **Geist** (400/500/600/700) — cuerpo, tablas, formularios, labels (es la
  fuente de `body`, tampoco hace falta clase extra para texto normal).

Escala (mismas clases de Tailwind de antes, solo cambia la familia):

| Nivel | Clase | Uso |
|---|---|---|
| Título de pantalla | `text-2xl font-bold text-on-surface` (etiqueta `<h1>`) | "Panel de programación" |
| Título de tarjeta/sección | `text-lg font-semibold text-on-surface` (`<h2>`/`<h3>`) | "Horario de hoy" |
| Etiqueta de KPI/campo | `text-xs font-medium uppercase tracking-wide text-on-surface-variant` | Labels de formulario |
| Cuerpo | `text-sm text-on-surface-variant` o `text-on-surface` según jerarquía | Texto de tablas |
| Dato grande (KPI) | `text-3xl font-bold text-on-surface` | Números destacados |

## Íconos

**Material Symbols Outlined** (vía Google Fonts, clase `.material-symbols-outlined`
ya definida en `index.css`) — reemplaza los SVG inline que traía la v1.
Uso: `<span className="material-symbols-outlined text-[20px]">notifications</span>`
(el nombre del ícono es el texto del span, tal como lo usa Google Fonts).
No mezclar con SVG inline nuevos — si hace falta un ícono que no está en
Material Symbols, usar el más parecido antes de volver a SVG a mano.

## Componentes y espaciado

- **Tarjetas**: `rounded-xl border border-outline-variant bg-surface-container-lowest p-5`.
- **Botón primario**: `rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-on-primary-container`.
- **Botón secundario**: `rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high`.
- **Botón/acción sin backend todavía**: mismo estilo que reemplaza, pero
  `disabled` + `cursor-not-allowed` + `title="Aún no implementado en el
  backend"` — nunca ocultar la acción.
- **Radio de borde**: `rounded-xl` (antes `rounded-lg`) para inputs/botones/tarjetas, `rounded-full` para avatares/badges/píldoras/pills del nav.
- **Píldoras de nav**: `rounded-full px-3.5 py-1.5 text-sm font-semibold`, activo = `bg-primary-container text-on-primary-container`.

## Layout

- **`frontend/src/components/AppShell.tsx`** — navbar horizontal fijo arriba
  (logo+marca a la izquierda, nav central con desplegables por grupo,
  búsqueda+notificaciones+perfil a la derecha), compartido por toda pantalla
  autenticada. Réplica de `stitch_sena_schedule_management_mockups/code.html`.
  No duplicar este markup en una pantalla nueva — envolver el contenido en
  `<AppShell activo="...">`.
- Los grupos de `NAV` en `AppShell.tsx` (Programación/Formación/Recursos/
  Operación/Administración) son desplegables que se abren con un clic en su
  título; un grupo con un solo ítem visible se renderiza como link plano sin
  desplegable (ej. "Mi trabajo" → "Mi horario" para un Instructor).
- Los ítems de `NAV` sin `ruta` son módulos que aún no existen en el backend
  y se muestran deshabilitados (mismo patrón de botón deshabilitado).
- **`frontend/src/components/AuthLayout.tsx`** — layout separado para
  Login/Registro/Recuperar, reskineado a los mismos tokens (logo `h-12 w-12`,
  tarjeta centrada), sin navbar porque esas pantallas no tienen sesión
  todavía.
- **`frontend/src/pages/Presentacion.tsx`** — página pública en `/`, antes de
  iniciar sesión. Header propio (sin `AppShell`, sin sesión todavía) + hero +
  tarjetas de funcionalidades + franja institucional + CTA final. Réplica de
  `mockups-stitch/presentacion_pre_login_sihs_sena/`. Todo el contenido es de
  mercadeo/navegación real (`Link` a `/login` y `/registro`) — no pide nada
  al backend, no le agregues fetches.

## Contenido de vitrina pendiente de conectar

El rediseño 2026-09-06 priorizó fidelidad visual completa a los mockups de
Stitch por pedido explícito del usuario, incluso donde el backend todavía no
tiene el dato real detrás. Esos casos quedaron como **contenido estático
hardcodeado**, cada uno marcado en el código con el comentario `// Contenido
de mockup (Stitch) — pendiente de conectar a un dato real del backend`
(buscar ese texto literal encuentra los 16 casos actuales). Ningún control
sobre ese contenido finge funcionar — si implicaba una acción, quedó
`disabled` con `title="Aún no implementado en el backend"`.

Ver `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md` → sección "Contenido de
vitrina del frontend" para el detalle de qué haría falta en el backend para
reemplazar cada uno por un dato real.

## Cómo usar esta guía

1. Antes de tocar una pantalla, revisar esta guía para tokens de color,
   tipografía y componentes — no reinventar una paleta o escala de texto
   distinta.
2. Si es una pantalla autenticada, envolverla en `<AppShell>` en vez de
   recrear navbar/header.
3. Si el brief cambia otra vez (nuevo color de marca, nueva fuente, etc.),
   actualizar este archivo en el mismo commit que el cambio de código.
