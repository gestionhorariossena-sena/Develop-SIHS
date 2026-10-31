# SIHS — Plataforma de presentación técnica

Aplicación local, estática (HTML/CSS/JS, sin build ni dependencias de npm) que
convierte la auditoría real de SIHS en una experiencia interactiva para
proyectar en TV y sustentar ante el instructor.

## Por qué HTML/CSS/JS vanilla y no React+Vite

El prompt original pedía React + TypeScript + React Flow si resultaba
apropiado. Se optó deliberadamente por HTML/CSS/JS sin build porque:

1. **Cero riesgo de instalación en el día de la reunión.** No depende de
   `npm install`, versiones de Node, ni de que el entorno del TV tenga
   conectividad para bajar paquetes.
2. Cumple exactamente los mismos requisitos funcionales (interactividad,
   animaciones SVG, navegación, zoom/scroll, simulaciones paso a paso,
   modo expositor, tablero con persistencia local) sin una capa de
   tooling adicional que pueda fallar silenciosamente.
3. Si el equipo prefiere migrar a React más adelante, los datos ya están
   separados de la lógica de render (`data.js` vs `render.js`/`main.js`),
   así que portar es mecánico.

Si el equipo prefiere la ruta original con React/Vite/React Flow, es un
cambio de implementación, no de contenido — todo el contenido real
(`data.js`) es reutilizable.

## Cómo abrir

```bash
cd docs/presentacion-interactiva
python3 -m http.server 8080
# abrir http://localhost:8080 en el navegador que se vaya a proyectar
```

También abre directamente como archivo (`file://.../index.html`) en
navegadores modernos, pero se recomienda el servidor local para evitar
restricciones de `file://` en algunos navegadores.

## Estructura

```
_Docs/presentacion-interactiva/
  AUDITORIA_SIHS.md   Informe de auditoría completo (Artifact F)
  index.html           Shell de la app (sidebar + topbar + overlay expositor)
  styles.css            Tema oscuro, componentes compartidos
  data.js               TODO el contenido real extraído de la auditoría
  render.js              Helpers de dibujo SVG (diagrama de arquitectura, ERD)
  main.js                 Router + las 5 páginas + modo expositor
  entregables/            (reservado para materiales de cada responsable)
  evidencias/              (reservado para capturas/evidencia del domingo)
```

## Las 5 secciones (+ hallazgos)

- **A — Explorador de arquitectura y base de datos**: diagrama de nodos
  reales (clic = detalle con archivo/función), ERD de las 23 tablas,
  modo docente con 12 conceptos de base de datos explicados con ejemplos
  de SIHS.
- **B — Simulador de flujos**: Publicar, Constructor manual, Carga con
  IA, Backend→cliente. Cada paso cita archivo y función reales;
  controles de play/pausa/siguiente/atrás/reiniciar; explicación
  simple/técnica intercambiable.
- **C — Python Engineering Lab**: SQLAlchemy (con el caso real de N+1
  resuelto), librerías reales de `requirements.txt` con ejemplo y
  limitación, demo interactiva de Pydantic, declaración explícita de que
  no se encontró código C# en SIHS.
- **D — Testing Bootcamp**: estado real de tests de SIHS (315 passed, 7
  skipped, corrida en vivo) + el bootcamp externo `bc-testing-adso` como
  currículo de referencia (umbral de cobertura por semana) + matriz de
  casos distinguiendo ejecutados de diseñados.
- **E — Equipo y hoja de ruta**: agenda de la reunión, responsabilidades
  de Nicol/David/Dayana/Edith/Mateo, tablero Kanban (persistencia en
  `localStorage` de este navegador — exportable/importable como JSON,
  **sin sincronización real entre integrantes**), hoja de ruta del 12 al
  25 de octubre de 2026.
- **F — Hallazgos de auditoría**: los 12 hallazgos (H1-H12) con
  severidad, resumen y evidencia — detalle completo en
  `AUDITORIA_SIHS.md`.

## Límites conocidos (léase antes de presentar)

- No hubo conexión en vivo a Supabase durante esta auditoría; el esquema
  de base de datos viene del script SQL versionado y los modelos ORM, no
  de una inspección directa del proyecto Supabase compartido.
- El tablero Kanban (Artifact E) no sincroniza entre navegadores ni
  personas — es deliberadamente local, con exportación/importación JSON
  como mecanismo manual de compartir estado.
- El ERD de Artifact A es una representación simplificada en grilla
  (no un layout de fuerzas), suficiente para explicar relaciones en
  pantalla pero no un diagrama de ingeniería inversa automático.
- Las simulaciones de Artifact B muestran datos de entrada/salida
  **ficticios** — ningún nombre, ficha o ambiente corresponde a un
  registro real.
- Ver además la sección "Lo que esta auditoría NO pudo verificar" al
  final de `AUDITORIA_SIHS.md` y en Artifact F.
