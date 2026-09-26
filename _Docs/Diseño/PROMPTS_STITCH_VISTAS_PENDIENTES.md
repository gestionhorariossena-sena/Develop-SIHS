# Prompts de Stitch — vistas que el backend ya puede alimentar

Escrito el 2026-09-24 leyendo el contrato real de cada router, no el nombre
del módulo. Cierra H-10 del `PLAN_CIERRE_DE_HUECOS_FLUJOS.md`: siete módulos
de backend completos (modelo + repositorio + servicio + router registrado) sin
un solo consumidor en el cliente.

**Cada prompt describe solo lo que los endpoints pueden llenar de verdad.**
Las secciones «No incluir» de cada uno no son estilo: son campos que el
backend no tiene, y si el diseño los muestra, la pantalla nace mintiendo o
nace bloqueada. Si algo de ahí hace falta de verdad, primero se amplía el
backend y después se rediseña.

---

## Antes de pedirle nada a Stitch: qué ya está diseñado

Tres de estas pantallas **ya tienen mockup** en `mockups-stitch/`, hecho en su
momento y nunca construido. No hay que volver a pedirlas:

| Módulo | Mockup existente | Estado |
|---|---|---|
| `/avisos` (lado lectura) | `avisos_oficiales_y_eventos_rol_aprendiz_sihs_sena/` | **Construido** el 2026-09-24 (`pages/Avisos.tsx`, ruta `/avisos`). Falta el lado de quien publica → **Prompt 1** |
| `/mensajeria` (lado Aprendiz) | `mensajer_a_de_instructores_rol_aprendiz_sihs_sena/` | **Construido** (`pages/MensajesAprendiz.tsx`, ruta `/mensajes`). Falta el lado del Instructor → **Prompt 2** |
| `/anotaciones-horario` | `mi_horario_rol_aprendiz_sihs_sena/` | **Construido** dentro de "Mi horario" del Aprendiz (`components/OrganizadorAnotacion.tsx`) |

> **Ya no hace falta el arreglo previo del Prompt 2**: `ConversacionResponse`
> ahora trae `aprendizNombre`/`instructorNombre` (se hizo al construir el lado
> del aprendiz, que tenía el mismo problema). La bandeja del instructor se
> puede construir en cuanto exista su diseño.

Los prompts de abajo cubren lo que **no** tiene diseño.

---

## Estilo común — pegar al inicio de cada prompt

> Diseña una pantalla web de escritorio para SIHS, el sistema de horarios del
> SENA (Centro CGMLTI). Sistema visual: fondo `#f8fafc`, tarjetas blancas con
> borde `#e2e8f0` y esquinas redondeadas de 12px, verde `#16a34a` como color
> de acción principal, ámbar `#d97706` para advertencias y rojo `#dc2626` para
> errores. Títulos en Hanken Grotesk semibold, cuerpo en Geist. Iconos de
> Material Symbols Outlined. Todos los textos en español de Colombia.
> La pantalla va DEBAJO de una barra de navegación horizontal que ya existe:
> no diseñes barra superior, logo, buscador ni menú de usuario, solo el
> contenido de la página.

---

## Prompt 1 — Consola de avisos (Coordinador / Administrador)

**Endpoints**: `GET /avisos/?categoria=&idFicha=` (cualquier sesión) ·
`POST /avisos/` · `PUT /avisos/{id}` · `DELETE /avisos/{id}` (Admin y
Coordinador).

```
[pegar el bloque de estilo común]

Pantalla: "Avisos y comunicados", la consola desde la que la coordinación
publica comunicados para instructores y aprendices.

Encabezado: título "Avisos y comunicados", bajada "Lo que publiques acá lo
ven los instructores y aprendices a los que va dirigido", y a la derecha un
botón verde primario "Publicar aviso".

Debajo, una fila de filtros: cuatro píldoras de categoría —"Reprogramación",
"Eventos", "Sede", "Extraordinario"— más una píldora "Todas" activa por
defecto, y un selector "Ficha" para filtrar por una ficha puntual.

Cuerpo: lista vertical de tarjetas de aviso, la más reciente arriba. Cada
tarjeta muestra:
- una insignia de categoría arriba a la izquierda, con color propio por
  categoría (reprogramación en ámbar, eventos en verde suave, sede en gris,
  extraordinario en rojo suave);
- el título del aviso en negrita;
- las dos primeras líneas del cuerpo, cortadas con puntos suspensivos;
- una línea de metadatos con: a quién va dirigido ("Ficha 3171618", "Sede
  Calle 52" o "Todo el centro"), quién lo publicó y hace cuánto;
- si el aviso tiene documento anexo, un enlace discreto con icono de
  documento que dice "Ver documento adjunto";
- si el aviso tiene fecha de vigencia, un texto pequeño "Vigente hasta el 30
  de septiembre"; y si esa fecha ya pasó, la tarjeta se ve atenuada con una
  insignia gris "Vencido";
- a la derecha, dos acciones discretas: "Editar" y "Eliminar".

Incluye el estado vacío: cuando no hay avisos en el filtro elegido, una
tarjeta centrada con icono de megáfono, el texto "Todavía no hay avisos en
esta categoría" y el mismo botón "Publicar aviso".

Incluye también el panel lateral (drawer) que se abre al pulsar "Publicar
aviso", con: campo de título; área de texto grande para el cuerpo; selector
de categoría con las cuatro opciones; un grupo de opciones excluyentes para
el destinatario ("Todo el centro" / "Una ficha" / "Una sede") que revela el
selector correspondiente al elegir; un campo de texto etiquetado "Enlace al
documento (opcional)" con el ejemplo "https://..."; un campo de fecha
"Vigente hasta (opcional)"; y abajo los botones "Cancelar" y "Publicar".

No incluir: subida de archivos por arrastre ni botón de "Adjuntar archivo"
(el sistema solo guarda un enlace, no almacena documentos), contador de
lecturas o "visto por X personas", estado de borrador, programación para
publicar más tarde, comentarios ni reacciones.
```

**Por qué esas exclusiones** — `adjuntoUrl` es un `String(500)`: no hay
endpoint de subida. No existe tabla de lecturas por usuario, ni estado
borrador, ni `fechaProgramada`. La vigencia (`vigenteHasta`) la guarda pero no
la filtra: lo de «Vencido» se calcula en el cliente.

---

## Prompt 2 — Mensajería, bandeja del Instructor

**Endpoints**: `GET /mensajeria/conversaciones` · `GET
/mensajeria/conversaciones/{id}/mensajes` · `POST
/mensajeria/conversaciones/{id}/mensajes` · `PATCH
/mensajeria/mensajes/{id}/leido`.

> **Antes de construir esta pantalla hay que resolver un hueco del backend**:
> `ConversacionResponse` devuelve `idAprendiz` e `idInstructor`, sin nombres, y
> un Instructor **no tiene permiso** sobre `GET /usuarios/` (es
> `require_lectura_catalogo`, solo Coordinador/Administrador). Tal como está,
> el instructor vería una lista de UUID. Se arregla con una línea —agregar
> `aprendizNombre`/`instructorNombre` al schema de conversación— pero hay que
> hacerlo. El prompt asume que ya está.

```
[pegar el bloque de estilo común]

Pantalla: "Mensajes", la bandeja donde un instructor del SENA responde las
consultas que le escriben sus aprendices.

Diseño de dos columnas, alto completo:

Columna izquierda (un tercio del ancho): lista de conversaciones. Arriba, el
título "Mensajes" con una insignia roja redonda con el número de
conversaciones con mensajes sin leer, y debajo un campo de búsqueda por
nombre. Cada conversación de la lista muestra: avatar circular con las
iniciales del aprendiz sobre fondo verde claro, el nombre completo del
aprendiz, el código de su ficha en texto pequeño gris, la primera línea del
último mensaje cortada, la hora del último mensaje alineada a la derecha y,
si hay mensajes sin leer, un punto verde. La conversación abierta se resalta
con fondo verde muy claro.

Columna derecha: la conversación abierta. Arriba una franja con el avatar, el
nombre del aprendiz y su ficha. En el centro, el hilo de mensajes en burbujas:
los del aprendiz alineados a la izquierda en gris claro, los del instructor a
la derecha en verde con texto blanco; cada burbuja con su hora debajo en
texto muy pequeño, y las del instructor con una marca de "leído" cuando el
aprendiz ya lo abrió. Si un mensaje trae un enlace anexo, se ve dentro de la
burbuja como una tarjeta pequeña con icono de documento. Separadores de fecha
entre días ("Hoy", "Ayer", "12 de septiembre").

Abajo, el compositor: un área de texto de una línea que crece, con el
marcador "Escribe tu respuesta…" y un botón circular verde de enviar.

Incluye dos estados más: la bandeja vacía ("Todavía no tienes mensajes. Tus
aprendices pueden escribirte desde su horario") y la columna derecha sin
conversación elegida ("Elige una conversación para leerla").

No incluir: botón para que el instructor inicie una conversación nueva (solo
el aprendiz puede abrirlas), indicador de "está escribiendo…", estado en
línea/desconectado, llamadas, mensajes de voz, reacciones, ni botón de
adjuntar archivo desde el equipo.
```

**Por qué esas exclusiones** — `POST /mensajeria/conversaciones` exige rol
Aprendiz y valida que el instructor le dicte a su ficha: un instructor no
puede abrir el hilo. No hay websockets (nada en vivo: se refresca al entrar o
con un botón), no hay presencia, y los anexos son un `adjuntoUrl`, no una
subida.

---

## Prompt 3 — Especialidades y su asignación (Administrador)

**Endpoints**: `GET/POST /especialidades/`, `PUT/DELETE /especialidades/{id}`
(solo Administrador) · `PUT /usuarios/{id}/especialidades` (asigna las de un
instructor).

```
[pegar el bloque de estilo común]

Pantalla: "Especialidades", el catálogo de áreas técnicas del centro (por
ejemplo "Programación", "Redes y telecomunicaciones", "Diseño gráfico") y de
qué instructor domina cada una. Lo usa el administrador.

Diseño de dos columnas.

Columna izquierda (dos tercios): tabla de especialidades con las columnas
Nombre, Descripción, Instructores (un número), Estado y acciones. El nombre
en negrita; la descripción en gris y a una sola línea; el número de
instructores como una píldora gris; el estado como insignia verde "Activa" o
gris "Inactiva"; las acciones como iconos de lápiz y papelera. Las filas
inactivas se ven atenuadas. Arriba de la tabla, un campo de búsqueda y un
botón verde "Nueva especialidad".

Columna derecha (un tercio): tarjeta "Instructores por especialidad". Arriba
un selector de especialidad; debajo, la lista de instructores que la tienen
asignada, cada uno con avatar de iniciales, nombre, tipo de contrato ("Planta"
o "Contrato") y un botón pequeño de quitar. Al final de la lista, un campo con
icono de búsqueda y el marcador "Agregar instructor a esta especialidad…".

Incluye el modal de "Nueva especialidad": campo de nombre, área de texto para
la descripción, un interruptor "Activa" encendido por defecto, y botones
"Cancelar" y "Guardar".

Incluye el estado vacío de la columna derecha: "Ninguna especialidad
seleccionada todavía".

No incluir: niveles o categorías jerárquicas de especialidad, cantidad de
horas, certificaciones, fechas de vigencia, ni gráficas de cobertura.
```

**Por qué esas exclusiones** — el modelo es exactamente `nombre`,
`descripcion`, `activo`. Nada más. El conteo de instructores sale de
`GET /usuarios/` (cada usuario trae `especialidades`), no de un endpoint de
estadística.

---

## Prompt 4 — Actividades de un resultado de aprendizaje (Administrador)

**Endpoints**: `GET /actividades-aprendizaje/`, `GET
/actividades-aprendizaje/resultado/{idResultado}`, `POST`, `PUT`, `DELETE`
(solo Administrador).

```
[pegar el bloque de estilo común]

Pantalla: "Actividades de aprendizaje", donde el administrador desglosa cada
resultado de aprendizaje del currículo en las actividades concretas que lo
componen.

Diseño maestro-detalle de dos columnas.

Columna izquierda (un tercio): lista de resultados de aprendizaje, cada uno
con su código en una píldora verde clara (por ejemplo "RAP1"), su descripción
en dos líneas como máximo, y a la derecha el número de actividades que tiene.
Arriba, un campo de búsqueda y un selector de programa de formación. El
resultado elegido se resalta.

Columna derecha (dos tercios): las actividades del resultado elegido. Arriba,
el código y la descripción completa del resultado como encabezado, y debajo
una fila de resumen: "6 actividades · 14 h 30 min en total". A la derecha, un
botón verde "Nueva actividad".

Debajo, la lista de actividades como tarjetas apiladas. Cada una con: el
código de la actividad en texto pequeño monoespaciado, la descripción como
texto principal, una insignia del tipo de actividad (por ejemplo "Taller",
"Exposición", "Práctica", "Evaluación") con color suave distinto por tipo, la
duración con un icono de reloj ("90 min"), y a la derecha iconos de editar y
eliminar.

Incluye el modal de "Nueva actividad": campo de código, área de texto para la
descripción, selector de tipo de actividad, campo numérico de duración en
minutos, y botones "Cancelar" y "Guardar".

Incluye los dos estados vacíos: sin resultado elegido ("Elige un resultado de
aprendizaje para ver sus actividades") y resultado sin actividades ("Este
resultado todavía no tiene actividades desglosadas").

No incluir: orden o secuencia arrastrable entre actividades, evidencias,
criterios de evaluación, responsables, fechas, ni adjuntos.
```

**Por qué esas exclusiones** — el modelo es `codigo`, `descripcion`,
`tipoActividad`, `duracionMinutos`, `idResultado`. No hay campo de orden, ni
de evidencia, ni relación con guías o instructores.

---

## Prompt 5 — Guías: **no** pedir pantalla todavía

`/guias` está registrado y funcionando, pero su modelo entero es `codigo`,
`idPrograma`, `idTrimestre`. No tiene nombre, descripción, archivo, versión ni
fecha: una pantalla propia sería una tabla de tres columnas que no le dice
nada a nadie, y el trabajo de diseñarla se perdería en cuanto el modelo crezca.

**Recomendación**: dejar `/guias` sin pantalla y decidir una de dos cosas en
la reunión de producto —

1. **Ampliar el modelo** (nombre, descripción, enlace al documento, versión) y
   recién ahí pedirle a Stitch un "Banco de guías de aprendizaje"; o
2. **Retirar el router** de `main.py` mientras tanto, que es lo que H-10
   propone para los módulos sin demanda real.

Mientras tanto, el dato ya se usa donde tiene sentido: `ResultadoAprendizaje`
tiene `idGuia`, así que la guía puede aparecer como un campo más del resultado
sin pantalla propia.

---

## Orden sugerido para construir

1. **Avisos, lado Aprendiz e Instructor** — el mockup ya existe y es lo que le
   da destino al ítem «Notificaciones» del navbar, hoy en gris (H-11).
2. **Avisos, consola de publicación** (Prompt 1) — sin esto, el tablón del
   aprendiz nace vacío y nadie puede llenarlo.
3. **Anotaciones del aprendiz** — mockup hecho, backend hecho, es la más
   barata de las tres del Aprendiz.
4. **Mensajería** (mockup del aprendiz + Prompt 2), **después** de agregarle
   los nombres al schema de conversación.
5. **Especialidades** (Prompt 3) y **Actividades** (Prompt 4), que son
   catálogo de administrador y no bloquean a nadie.
