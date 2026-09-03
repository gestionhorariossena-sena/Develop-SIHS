# Prompt para IA de mockups — pantalla "Calendario general" (SIHS)

Pega esto en una IA de generación de imágenes (Midjourney, DALL·E, Ideogram,
Google Whisk, etc.) para conseguir referencias visuales. Al final hay una
traducción al inglés — varias de estas herramientas interpretan mejor los
prompts en inglés, probá primero con el español y si el resultado no
convence, probá con esa versión.

Una vez elijas una imagen (o combines partes de varias), yo la adapto a
nuestra línea de diseño real: mismos componentes de `AppShell.tsx`, mismos
colores exactos (`sena-600` en vez de un verde genérico), mismo grid de
horario que ya existe — la imagen es solo para decidir el layout y la
sensación general, no para copiarla literalmente.

---

## Prompt (español)

Diseño de interfaz de una pantalla web de escritorio para un sistema de
gestión de horarios académicos de una institución técnica (SENA,
Colombia). Estilo dashboard SaaS moderno, minimalista, profesional —
referencia visual: Linear, Notion Calendar, Google Calendar en modo
semana/mes, con la limpieza de un panel de administración educativo.

**La pantalla es "Calendario general"**: una vista de calendario mensual
que agrupa TODAS las clases programadas de la institución en un mismo
vistazo (no de un solo instructor o ficha — es la vista panorámica para un
coordinador académico). Cada día del mes muestra pequeñas píldoras/chips
de color representando las clases de ese día, con overflow tipo "+3 más"
cuando hay muchas. Debe incluir, en la parte superior del calendario, un
selector de vista (Mes / Semana) y navegación de mes anterior/siguiente,
y en una esquina un botón o pestaña claramente visible con el texto "Ver
historial de horarios" que lleve a un listado archivado de horarios
guardados en versiones anteriores.

**Layout general de la pantalla** (toda la app comparte este armazón, no
inventar uno nuevo):
- Barra lateral izquierda fija, angosta (~240px), fondo blanco, con el
  logo institucional arriba, ítems de navegación agrupados por secciones
  con etiquetas pequeñas en mayúscula ("PROGRAMACIÓN", "FORMACIÓN",
  "RECURSOS"...), ítem activo resaltado en verde institucional suave.
- Barra superior con buscador centrado-izquierda, y a la derecha: badge
  de trimestre actual, ícono de notificaciones, avatar circular de
  usuario con su nombre.
- El contenido principal (el calendario) va en una tarjeta blanca grande
  con bordes redondeados y borde gris muy sutil, con harto espacio en
  blanco alrededor — nada denso ni sobrecargado.

**Paleta de color** (usarla literal, no inventar otra):
- Verde institucional como color de marca: `#39a900` (botones primarios,
  ítem de nav activo, acentos puntuales) — úsalo con moderación, es un
  acento, no el color dominante.
- Fondo de página: gris muy claro casi blanco (`#f8fafc`).
- Tarjetas: blanco puro con borde gris clarito (`#e2e8f0`).
- Texto principal: gris casi negro (`#0f172a`), nunca negro puro.
- Los chips de clases en el calendario usan 2-3 colores distintos para
  diferenciar jornada u origen (verde institucional, azul medio, y un
  tercero neutro), siempre con texto oscuro legible encima — nada de
  texto blanco sobre pastel.
- Nada de morados, rosados intensos ni gradientes — la paleta es sobria,
  casi monocromática con el verde como único acento fuerte.

**Tipografía**: sans-serif del sistema (tipo Segoe UI / system-ui),
sin serifas, pesos claros: bold para títulos, medium para el cuerpo.

**Bordes y forma**: esquinas redondeadas medianas en tarjetas y botones
(no cuadradas, no muy ovaladas), badges y avatares en píldora
(`border-radius` completo). Sombras muy sutiles, casi planas.

Formato: mockup de alta fidelidad de una pantalla de escritorio completa
(resolución tipo 1440x900), como si fuera una captura de Figma, no una
ilustración ni un dibujo — interfaz real y funcional.

Generar 2-3 variaciones de layout para poder comparar.

---

## Prompt (English)

High-fidelity desktop web app UI mockup for an academic schedule
management dashboard (SENA, Colombia — a technical education
institution). Modern minimalist SaaS dashboard style, references: Linear,
Notion Calendar, Google Calendar month/week view, clean educational admin
panel aesthetic.

**The screen is "General Calendar"**: a monthly calendar view that
aggregates ALL scheduled classes across the entire institution in one
glance (not scoped to a single instructor or class group — this is the
bird's-eye view for an academic coordinator). Each day cell shows small
colored pill/chip badges representing that day's classes, with a "+3
more" overflow indicator when there are many. Include, above the
calendar, a Month/Week view toggle and previous/next month navigation,
and in a clearly visible corner a button or tab labeled "View schedule
history" that leads to an archive of previously saved schedule versions.

**Overall screen layout** (shared shell across the whole app, don't
invent a new one):
- Fixed narrow left sidebar (~240px), white background, institutional
  logo at the top, nav items grouped under small uppercase section
  labels ("PROGRAMACIÓN", "FORMACIÓN", "RECURSOS"...), active item
  highlighted with a soft institutional green background.
- Top bar with a search field on the left, and on the right: current
  term badge, notification bell icon, circular user avatar with name.
- Main content (the calendar) sits inside one large white rounded card
  with a subtle gray border, generous whitespace around it — nothing
  dense or cluttered.

**Color palette** (use literally, don't invent another):
- Institutional green as brand accent: `#39a900` (primary buttons,
  active nav item, small accents) — used sparingly, it's an accent, not
  the dominant color.
- Page background: near-white light gray (`#f8fafc`).
- Cards: pure white with a very light gray border (`#e2e8f0`).
- Main text: near-black dark gray (`#0f172a`), never pure black.
- Calendar chips use 2-3 distinct colors to tell apart shift/origin
  (institutional green, a medium blue, and one neutral tone), always
  with readable dark text on top — no white text on pastel backgrounds.
- No purples, no bright pinks, no gradients — the palette is sober,
  nearly monochrome with green as the single strong accent.

**Typography**: system sans-serif (Segoe UI / system-ui style), no
serifs, bold weight for headings, medium weight for body text.

**Shape**: medium rounded corners on cards and buttons (not square, not
overly pill-shaped except for badges/avatars, which ARE full pill
shape). Very subtle, almost flat shadows.

Format: high-fidelity full desktop screen mockup (1440x900-ish), looking
like a real Figma screenshot — not an illustration, not a sketch, an
actual functional-looking interface.

Generate 2-3 layout variations to compare.
