# Guía de marca — SIHS (SENA CGMLTI)

Brief de identidad visual para que cualquier sesión de diseño futura (o
cualquier persona del equipo) tenga un único lugar de dónde sacar colores,
tipografía y reglas de uso del logo, en vez de tener que adivinar mirando
pantallas ya hechas. Todo lo de acá ya está aplicado en el frontend — es
documentación de lo que existe, no una propuesta nueva.

**Fuentes originales** (no se inventó nada, todo viene de acá):

- `mockups-institucionales/` — mockups de alta fidelidad de Login, Registro,
  Recuperar contraseña y Dashboard. Base de todo el look and feel actual.
- `plantillas-institucionales/disponibilidad-ficha-3228973B.pdf` — planilla
  real de disponibilidad ficha/grupo que usa la coordinación académica hoy en
  Excel/Sheets. Es la referencia para cualquier pantalla de horarios
  (`NuevoHorario.tsx` la sigue).
- `Dashboard.jpeg`, `Dashboard2.jpeg`, `Login.jpeg`, `Reucperacion.jpeg` —
  capturas de referencia adicionales del diseño institucional.
- `wireframes.pdf` — wireframes de baja fidelidad, útiles para flujo/orden de
  la información antes de mirar visual.

## Logo

- Archivo: `frontend/src/assets/sena-logo.jpeg`.
- Siempre en un contenedor cuadrado con esquinas redondeadas
  (`rounded-lg`/`rounded-xl`), nunca suelto sin marco.
- Tamaños en uso: `h-9 w-9` en el sidebar del dashboard, `h-12 w-12` en la
  tarjeta de Login/Registro/Recuperar (`AuthLayout.tsx`).
- Siempre acompañado del nombre del sistema: "SIHS" (peso bold) +
  "CGMLTI" o "SIHS · CGMLTI" en gris debajo/al lado, nunca el logo solo sin
  el nombre en pantallas de navegación.

## Color

### Verde institucional SENA (`sena-*`)

Definido en `frontend/src/index.css` con `@theme` (Tailwind v4, sin
`tailwind.config.js`). Es el único color de marca — todo lo demás sale de la
escala neutra de Tailwind (`slate-*`).

| Token | Hex | Uso |
|---|---|---|
| `sena-50` | `#f0f9ec` | Fondos suaves (ítem de nav activo, chip de filtro activo) |
| `sena-100` | `#ddf0d1` | Fondos suaves alternos (celdas de jornada Noche en horarios) |
| `sena-500` | `#4caf15` | Raro en uso directo — paso intermedio de la escala |
| `sena-600` | `#39a900` | **Color de marca principal** — botones primarios, barra superior de `AuthLayout`, avatar circular, ítem activo del sidebar |
| `sena-700` | `#2e8600` | Hover de botones primarios, texto sobre `sena-50` |

Regla simple: si es la acción principal de la pantalla (botón "Guardar",
"Nuevo horario", barra superior de auth) o el estado "activo/seleccionado"
(nav, filtro), usa `sena-600`/`sena-700`. Todo lo demás es neutro.

### Escala neutra (`slate-*`)

Base de todo el texto, bordes y fondos que no son de marca:

| Uso | Clase |
|---|---|
| Fondo de página | `bg-slate-50` |
| Tarjetas/paneles | `bg-white` con `border border-slate-200` |
| Texto principal | `text-slate-900` |
| Texto secundario | `text-slate-500` |
| Texto deshabilitado / placeholder | `text-slate-400` |
| Divisores de tabla | `border-slate-100` / `border-slate-200` |

### Color semántico (estados y badges)

No se inventan colores nuevos para esto — se reutiliza la paleta estándar de
Tailwind, siempre en la forma "fondo muy claro + texto oscuro del mismo
matiz" (nunca fondo saturado con texto blanco, eso se reserva para botones):

| Estado | Clases | Dónde se usa |
|---|---|---|
| Positivo / confirmado | `bg-emerald-50 text-emerald-700` | Badge "Confirmado", KPI "Horarios activos" |
| Atención / requiere revisión | `bg-orange-50 text-orange-700` | Badge "Cruce", "Requiere revisión" |
| Neutro / pendiente | `bg-slate-100 text-slate-600` | Badge "Por confirmar" |
| Notificación | `bg-orange-500` (punto sólido, sin texto) | Punto sobre el ícono de campana |

### Color por jornada (específico de Horarios)

Viene de la planilla institucional real (`plantillas-institucionales/`), que
ya usa este código de color para diferenciar Mañana/Tarde/Noche de un
vistazo:

| Jornada | Clase de celda | Barra de encabezado |
|---|---|---|
| Mañana | `bg-emerald-200` / `bg-emerald-300/70` | `bg-slate-900` |
| Tarde | `bg-blue-200` / `bg-blue-300/70` | `bg-slate-900` |
| Noche | `bg-emerald-200` / `bg-emerald-300/70` | `bg-slate-900` |

Las barras "JORNADA MAÑANA/TARDE/NOCHE" son siempre `slate-900` (casi negro)
independientemente de la jornada — así es en la planilla original, la
diferenciación va en el color de las celdas, no en la barra.

#### Grid de horario en modo oscuro

El texto del grid (`GridHorario.tsx`, `CeldaHorario.tsx`) es **siempre
`text-slate-900` (negro), sin variante `dark:`**, y las celdas vacías son
**siempre** `bg-emerald-200`/`bg-blue-200` (verde/azul, tabla de arriba),
también sin variante `dark:`. Es la única parte del frontend que rompe a
propósito la convención "todo tiene su par `dark:`" — motivo:

- Antes las celdas usaban tonos casi blancos (`-50`) y el texto usaba
  `dark:text-slate-200` (gris claro), pensado para un fondo oscuro. Pero el
  fondo de la celda no tenía variante `dark:`, así que en modo oscuro seguía
  siendo casi blanco — el resultado era texto claro sobre fondo claro, casi
  ilegible ("las letras casi ni se leen").
- La solución correcta NO es ponerle `dark:bg-...` oscuro a la celda,
  porque entonces haría falta texto blanco encima, no negro — y el pedido
  explícito fue texto negro. En vez de eso, el fondo pasa a un tono ya lo
  bastante saturado (`-200`/`-300`, "azul oscuro"/"verde oscuro" frente al
  `-50` anterior) para que texto negro fijo tenga buen contraste en
  cualquier tema, sin necesitar dos paletas.
- Si se vuelve a tocar este grid: no agregar `dark:text-*` claro a nada que
  quede dentro de estas celdas, y no agregar `dark:bg-*` oscuro sin también
  cambiar el texto a blanco — son las dos mitades de la misma regla.

## Tipografía

Sin librería de fuentes externa — pila del sistema, definida en
`index.css`:

```css
font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

Escala en uso (clases de Tailwind, no hay tamaños custom):

| Nivel | Clase | Uso |
|---|---|---|
| Título de pantalla | `text-2xl font-bold text-slate-900` | "Panel de programación", "Nuevo horario" |
| Título de tarjeta/sección | `text-lg font-semibold text-slate-900` | "Horario de hoy" |
| Etiqueta de KPI/campo | `text-xs font-medium uppercase tracking-wide text-slate-400` | Encabezados de tarjeta, labels de formulario |
| Cuerpo | `text-sm text-slate-700` | Texto de tablas y contenido general |
| Dato grande (KPI) | `text-3xl font-bold text-slate-900` | Números destacados |

## Componentes y espaciado

- **Tarjetas**: `rounded-xl border border-slate-200 bg-white p-5`. Es el
  contenedor por defecto para cualquier bloque de contenido nuevo.
- **Botón primario**: `rounded-lg bg-sena-600 px-4 py-2 text-sm font-semibold
  text-white hover:bg-sena-700`.
- **Botón secundario**: `rounded-lg border border-slate-300 px-4 py-2 text-sm
  font-semibold text-slate-700 hover:bg-slate-50`.
- **Botón/acción sin backend todavía**: mismo estilo que el que reemplaza,
  pero `disabled` + `cursor-not-allowed` + `title="Aún no implementado en el
  backend"` (nunca ocultar la acción — mostrarla deshabilitada comunica que
  existe pero no está lista, ver `Dashboard.tsx` y `NuevoHorario.tsx`).
- **Radio de borde**: `rounded-lg` para inputs/botones, `rounded-xl` para
  tarjetas/paneles, `rounded-full` para avatares/badges/píldoras.
- **Separación entre secciones**: `gap-4`/`gap-6` y `mb-6` entre bloques
  grandes de una pantalla.

## Layout

- **`frontend/src/components/AppShell.tsx`** — sidebar + header institucional
  compartido por toda pantalla autenticada bajo `/dashboard` (hoy:
  `Dashboard.tsx`, `NuevoHorario.tsx`). Réplica de
  `mockups-institucionales/03-dashboard.png`. No duplicar este markup en una
  pantalla nueva — envolver el contenido en `<AppShell activo="...">`.
- Los ítems de `NAV` sin `ruta` en `AppShell.tsx` son módulos que aún no
  existen en el backend y se muestran deshabilitados (mismo patrón de botón
  deshabilitado descrito abajo). Cuando el módulo tenga pantalla, basta con
  agregarle `ruta` ahí para que quede habilitado.
- **`frontend/src/components/AuthLayout.tsx`** — layout separado para
  Login/Registro/Recuperar (logo `h-12 w-12`, sin sidebar). No usa `AppShell`
  porque esas pantallas no tienen sesión todavía.

## Cómo usar esta guía

Antes de diseñar una pantalla nueva (con o sin Claude):

1. Revisar si ya existe un mockup para esa pantalla en
   `mockups-institucionales/` o en las capturas sueltas de esta carpeta —
   replicar esa referencia, no improvisar un layout nuevo.
2. Si es una pantalla autenticada bajo `/dashboard`, envolverla en
   `<AppShell>` (ver arriba) en vez de recrear sidebar/header.
3. Si no hay mockup, usar los tokens de esta guía (color, tipografía,
   componentes) para que la pantalla nueva se sienta parte del mismo
   sistema, en vez de inventar una paleta o escala de texto distinta.
4. Si el brief cambia (nuevo color de marca, nueva fuente, etc.), actualizar
   este archivo en el mismo commit que el cambio de código — que nunca quede
   desactualizado respecto a `index.css`.
