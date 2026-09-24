# Plan de cierre de huecos — flujos por rol

Lista de trabajo derivada del mapa de flujos del 2026-09-23, levantado leyendo
el código de `main` (6fed8c2) con el backend y el frontend corriendo: 28 rutas
del cliente web, 133 endpoints y los 4 roles reales (Administrador,
Coordinador, Instructor, Aprendiz).

Cada entrada es un recorrido que hoy una persona **puede empezar y no puede
terminar**, con el sitio exacto donde se corta. No son ideas de producto:
todas se verificaron contra el código en ejecución.

Complementa a `REVISION_TECNICA_TOTAL_2026-09-20.md`, que cubre el lado
técnico (Alembic, índices, paginación). Aquí no se repite nada de eso: esto es
el lado del usuario.

## Cómo usar este documento

- Marca la casilla cuando la tarea cumpla su **Hecho cuando**, no antes.
- Cada tarea trae **Cómo probarlo**: si el comando o los pasos no pasan, no está hecha.
- El orden de los bloques es el orden recomendado. Dentro de un bloque, de arriba abajo.
- Tamaños: **S** ≈ media jornada · **M** ≈ 1-3 días · **L** ≈ una semana o más.

> **Estado al 2026-09-24.** Cerradas **11 de 15**: H-1 a H-9, H-13 y H-14 — el
> detalle de cómo quedó cada una, y las decisiones que se apartaron de lo
> sugerido acá, están en [Cierre del 2026-09-24](#cierre-del-2026-09-24) al
> final. Pendientes: **H-10, H-11 y H-12** (los tres piden decisión de producto,
> no trabajo bloqueado) y **H-15**, que es configuración del panel de Supabase,
> no código.

---

## Bloque 1 — Recorridos que se cortan

Lo más grave: un rol entero inservible y dos circuitos a medio construir.

### [x] H-1 · El Aprendiz no puede vincularse a su ficha
**Rol:** Aprendiz · **Tamaño:** S · **Bloqueante**

**Síntoma.** Un aprendiz recién registrado entra, cae en `/mi-horario-aprendiz`
y ve una pantalla vacía. No hay forma de asociarse a una ficha, así que nunca
verá un horario. El rol completo es inservible, y la app móvil hereda el mismo
vacío.

**Dónde está.**
- Backend listo y protegido: `backend/app/api/v1/ficha_usuario.py:16` (`POST /ficha-usuario/vincular`, exige rol Aprendiz).
- Pantalla que debería ofrecerlo: `frontend/src/pages/MiHorarioAprendiz.tsx:55` — el bloque `!cargando && !error && !ficha`, que hoy solo informa.
- El docstring del archivo (líneas 5-12) ya reconoce que la UI no existe.

**Qué hacer.**
1. En el estado sin ficha, mostrar un formulario de un campo (código de ficha) que llame a `POST /ficha-usuario/vincular`.
2. Al vincular con éxito, recargar `mi-ficha` y `mi-horario` sin salir de la pantalla.
3. Manejar el error de código inexistente con un mensaje que diga qué hacer, no el texto crudo del backend.

**Hecho cuando.** Una cuenta Aprendiz nueva, sin vínculo, puede escribir su
código de ficha y ver su horario sin que nadie toque la base de datos a mano.

**Cómo probarlo.** Crear una cuenta con `backend/scripts/crear_cuentas_prueba.py`,
entrar con ella y completar el flujo entero desde el navegador.

---

### [x] H-2 · El código de ficha del registro se tira a la basura
**Rol:** Aprendiz · **Tamaño:** S · Depende de H-1

**Síntoma.** El registro ya le pide el código de ficha al aprendiz y lo guarda
en la metadata de Supabase, pero nadie lo lee nunca. Se le pide un dato y luego
se le vuelve a pedir.

**Dónde está.** `frontend/src/pages/Registro.tsx:114` (`codigo_ficha` va a
`user_metadata`) · `backend/app/core/supabase_auth.py:get_current_user`, donde
se crea la fila de perfil en el primer request y solo se lee `numero_documento`.

**Qué hacer.** Al crear el perfil, si la metadata trae `codigo_ficha` y existe
esa ficha, crear el vínculo automáticamente. H-1 queda como camino de rescate
para quien se registró antes o se equivocó de código.

**Hecho cuando.** Un aprendiz que puso su código al registrarse ve su horario
en el primer inicio de sesión, sin pasos extra.

---

### [x] H-3 · `/solicitudes-acceso` — dos pantallas contra un backend inexistente
**Rol:** Administrador y quien pide acceso · **Tamaño:** M

**Síntoma.** «Solicita acceso» del registro no envía nada y el Panel de
Administración no carga su cola: **404**, porque el router nunca se escribió.
Las pruebas del cliente pasan porque simulan las llamadas.

**Dónde está.**
- Consumidores: `frontend/src/pages/Registro.tsx:383` (`POST /solicitudes-acceso/`) y `frontend/src/pages/PanelAdministracion.tsx:96, 179, 206` (listar, aprobar, rechazar).
- Modelo y migración ya existen: `backend/app/models/solicitud_acceso.py` (migración `b73491403bb8`).
- Falta: `backend/app/api/v1/solicitudes_acceso.py`, su repositorio y servicio, y el `include_router` en `backend/app/main.py`.
- `backend/app/services/credencial_temporal_service.py` ya está construido y probado esperando este flujo.

**Qué hacer.** Implementar los 4 endpoints con el contrato que el cliente ya
usa: `GET /` (solo Administrador), `POST /` (público, sin sesión), `POST /{id}/aprobar`
(recibe `idRol`), `POST /{id}/rechazar` (recibe `motivoRechazo`). Aprobar debe
apoyarse en `CredencialTemporalService`.

**Hecho cuando.** Una persona sin cuenta envía su solicitud desde `/registro`,
el Administrador la ve en `/panel-administracion` y al aprobarla se crea la
cuenta con su rol.

**Cómo probarlo.** El flujo completo en el navegador, sin tocar la base a mano.
Ojo: el correo de la credencial no llega hasta resolver H-15.

---

### [x] H-4 · El Instructor no puede pedir un cambio de horario
**Rol:** Instructor y Coordinador · **Tamaño:** M

**Síntoma.** Un instructor ve que un bloque suyo tiene un problema y no tiene
dónde decirlo. El coordinador no tiene bandeja donde recibirlo. Es el único
circuito de ida y vuelta entre ambos roles, y le faltan las dos puntas: el
backend está entero.

**Dónde está.** `backend/app/api/v1/solicitudes_cambio_horario.py`:
- `:16` `POST /` — crear (rol Instructor)
- `:28` `GET /mias` — las propias (rol Instructor)
- `:36` `GET /` — todas (Coordinador/Administrador)
- `:45` `PATCH /{id}/resolver` — resolver (Coordinador/Administrador)

El menú ya reserva el ítem: `frontend/src/components/AppShell.tsx:94`
(«Cambios», deshabilitado).

**Qué hacer.**
1. Pantalla del instructor: botón «Reportar novedad» en el detalle de franja (`DetalleFranjaAmbiente.tsx`) con tipo (novedad / permuta / cambio-ambiente) y motivo, más una lista de sus solicitudes.
2. Pantalla del coordinador: bandeja con las pendientes y acciones aprobar/rechazar.
3. Darle ruta al ítem «Cambios» del navbar.

**Hecho cuando.** Un instructor reporta una novedad y un coordinador la resuelve,
ambos desde la interfaz.

**Ojo.** `SolicitudCambioHorarioService.resolver` **no mueve el horario real** al
aprobar (v1, está en su docstring). Decidir si esta tarea incluye aplicar el
cambio o si eso es un ticket aparte.

---

## Bloque 2 — Control de acceso

El menú filtra bien; las rutas no filtran nada. Lo que protege los datos es el
backend, así que esto no es una fuga: es que la gente llega a pantallas que no
puede usar y se topa con errores en vez de con una puerta cerrada.

### [x] H-5 · Ninguna ruta declara qué rol la puede abrir
**Rol:** todos · **Tamaño:** S · **Mejor relación esfuerzo/beneficio de la lista**

**Síntoma.** Escribiendo la URL, cualquier persona con sesión llega a cualquier
pantalla. Un Aprendiz abre `/horarios/asistente-ia`, elige tipo de archivo,
sube un Excel, pulsa Continuar — y recién ahí recibe «No autorizado».
Reproducido en vivo el 2026-09-23 con la cuenta `aprendiz.demo@sihs-pruebas.com`.

**Dónde está.** `frontend/src/routes/ProtectedRoute.tsx:10` acepta `roles?: string[]`
y lo verifica contra `/usuarios/me`. **Ninguna** de las 23 rutas de
`frontend/src/routes/AppRouter.tsx` se lo pasa.

**Qué hacer.** Añadir `roles={[...]}` a cada ruta privada, con el mismo criterio
que ya usa el navbar:
- `Administrador` + `Coordinador`: las 9 de Programación, las 2 de Formación, las 3 de Recursos, `/usuarios`, `/codigo-instructor`, `/roles`
- `Administrador`: `/panel-administracion`, `/aprobar-solicitudes`
- `Instructor`: `/mi-horario`, `/mi-horario/detalle-franja`
- `Aprendiz`: `/mi-horario-aprendiz`
- sin restricción: `/dashboard` (ya reparte por rol)

**Hecho cuando.** Un Aprendiz que escribe `/horarios/asistente-ia` acaba en su
propia pantalla, sin ver el formulario ni recibir un error del backend.

**Cómo probarlo.** Con sesión de Aprendiz, escribir a mano las 23 rutas.
Ninguna debe montar contenido ajeno a su rol.

---

### [x] H-6 · El Coordinador ve botones que no puede pulsar
**Rol:** Coordinador · **Tamaño:** S

**Síntoma.** «Usuarios» y «Roles» están en su menú y puede listar ambos, pero
asignar o quitar un rol exige Administrador: los botones están a la vista y dan
403 al usarlos.

**Dónde está.** `frontend/src/components/AppShell.tsx:101` y `:103` los marcan
`soloGestion` (Administrador **o** Coordinador). En el backend,
`GET /usuarios/` y `GET /roles/` piden `require_lectura_catalogo`, pero
`backend/app/api/v1/usuario_rol.py` exige `require_admin` en asignar y remover.

**Qué hacer.** Decidir cuál es la regla real y aplicarla en los dos lados:
o el Coordinador puede asignar roles (ampliar el backend), o no los ve
(marcar ambos ítems `soloAdmin`, que ya existe como opción en el mismo archivo).

**Hecho cuando.** No queda ninguna acción visible para un rol que no pueda ejecutarla.

---

### [x] H-7 · Dos pantallas para el alta de personas, ninguna completa
**Rol:** Administrador · **Tamaño:** S · Se cierra junto con H-3

**Síntoma.** `/aprobar-solicitudes` funciona pero no aparece en ningún menú;
`/panel-administracion` está en el menú y devuelve 404. Hoy el único camino real
es entrar a mano a `/usuarios` y asignar el rol.

**Dónde está.** `frontend/src/pages/AprobarlicitarSolicitudes.tsx` (viva, usa
`GET /usuarios/` + `POST /usuario-rol/asignar`) · `frontend/src/pages/PanelAdministracion.tsx`
(en el navbar vía `AppShell.tsx:107`) · el comentario de `AppShell.tsx:104-106`
explica que una reemplazó a la otra.

**Qué hacer.** Con H-3 resuelto, quedarse con el Panel de Administración y
eliminar `AprobarlicitarSolicitudes.tsx` y su ruta; o al revés si se prefiere la
simple. Lo que no puede quedar es una pantalla huérfana alcanzable por URL.

**Hecho cuando.** Existe **un** camino para dar de alta a alguien, y está en el menú.

---

## Bloque 3 — El sistema no comunica nada

### [x] H-8 · Las notificaciones no le llegan a nadie
**Rol:** todos · **Tamaño:** M · Parte se resuelve sola con H-1

**Síntoma.** La campana está en todas las pantallas y siempre está vacía.

**Dónde está.** El **único** disparador del sistema es
`backend/app/services/horario_service.py:167` (`_notificar_cambio_asignacion`),
que solo se invoca al cambiar ambiente o instructor (`:161`) y solo notifica a
**aprendices vinculados a una ficha** — y hoy no hay ninguno vinculado (H-1).
Un instructor al que le mueven un ambiente nunca se entera.

**Qué hacer.**
1. Notificar también al instructor afectado, no solo a los aprendices.
2. Añadir disparadores para los eventos que importan: horario publicado, solicitud de cambio resuelta (H-4), solicitud de acceso aprobada (H-3).
3. Revisar que `NotificacionesPanel.tsx` marque como leídas de verdad al abrir.

**Hecho cuando.** Cambiarle el ambiente a un bloque le genera notificación al
instructor y a los aprendices de la ficha, visible en la campana de cada uno.

---

### [x] H-9 · Publicar un horario no avisa a nadie
**Rol:** Coordinador → Instructor y Aprendiz · **Tamaño:** M

**Síntoma.** El coordinador publica y el horario queda ahí, esperando a que
alguien entre a mirarlo.

**Dónde está.** `POST /horarios/` (`backend/app/api/v1/horarios.py:193`) no
dispara nada. Hay dos módulos construidos y sin usar para esto:
`/avisos` y `/mensajeria`. El ítem «Notificaciones» del menú está deshabilitado
(`AppShell.tsx:95`).

**Qué hacer.** Decidir el canal (notificación interna, aviso, o ambos) y
engancharlo a la publicación. Si se eligen los avisos, darle pantalla al ítem del menú.

---

## Bloque 4 — Superficie construida que nadie puede alcanzar

### [ ] H-10 · Siete módulos de backend sin ninguna pantalla
**Tamaño:** L si se construyen, S si se retiran · **Requiere decisión del equipo**

Completos —modelo, repositorio, servicio y router registrado— y sin un solo
consumidor: `/avisos`, `/mensajeria`, `/anotaciones-horario`,
`/solicitudes-cambio-horario` (ver H-4), `/guias`, `/actividades-aprendizaje`,
`/especialidades`.

Varios vienen de la reconciliación de la rama `nicol`. Mantener siete
superficies de API que nadie usa es mantenimiento y riesgo a cambio de cero
valor: para cada uno, construir la pantalla o retirar el router de
`backend/app/main.py`.

Sugerencia de reparto: `/solicitudes-cambio-horario` y `/avisos` tienen
demanda real (H-4, H-9). `/anotaciones-horario` es barato y útil para el
instructor. Los otros cuatro, justificar o retirar.

### [ ] H-11 · Cuatro promesas en el menú sin destino
**Tamaño:** S

`AppShell.tsx:80` («Temáticas»), `:94` («Cambios»), `:95` («Notificaciones»),
`:108` («Configuración») se muestran en gris con el tooltip «Módulo aún no
implementado». «Cambios» y «Notificaciones» ya tienen backend (H-4, H-9).
Para los otros dos: ponerles fecha o quitarlos del menú.

### [ ] H-12 · El buscador del navbar está deshabilitado
**Tamaño:** M

`AppShell.tsx:400` — «Buscar ficha, instructor o ambiente» aparece en todas las
pantallas y no hace nada. Con 19 pantallas para el coordinador es el atajo que
más se nota en falta. No hay endpoint de búsqueda: hay que crearlo.

---

## Bloque 5 — Entorno y operación

### [x] H-13 · Las cuentas de prueba perdieron sus roles
**Tamaño:** S · Bloquea probar los demás puntos

Verificado el 2026-09-23 contra la base compartida: `ana@mail.com` (documentada
como Coordinador) y `carlos@mail.com` (Instructor) tienen la lista de roles
**vacía**. Solo `admin@mail.com` conserva el suyo.

Sin una cuenta de Coordinador funcional no se puede probar de verdad el rol
para el que se construyó el sistema. Reasignar los roles y hacer que
`backend/scripts/crear_cuentas_prueba.py` cubra también Coordinador
(hoy solo crea Instructor y Aprendiz).

### [x] H-14 · Los errores técnicos llegan crudos a la pantalla
**Tamaño:** S

El `detail` del backend se muestra tal cual al usuario: un coordinador ve
«GEMINI_API_KEY no está configurada -- la capa de IA está apagada» o
«No autorizado». Traducir en el cliente al menos 401/403/503 a frases que digan
qué pasó y qué hacer.

Relacionado y **ya resuelto** (2026-09-24): la configuración leía `.env`
relativo al directorio de arranque, así que lanzar el servidor desde la raíz del
monorepo levantaba la API sin ninguna variable y apagaba la IA en silencio.
`backend/app/core/config.py` ahora resuelve la ruta desde el propio archivo, y
`main.py` avisa al arrancar si falta la clave.

### [ ] H-15 · La credencial temporal no le llega a nadie
**Tamaño:** S · Es configuración, no código

`CredencialTemporalService` genera la clave, pero el SMTP del panel de Supabase
sigue sin configurar (SCRUM-129), así que el correo no sale. Sin esto, H-3 queda
a medias: la cuenta se crea y la persona no recibe cómo entrar.

---

## Resumen por rol

| Rol | Pantallas | Estado |
|---|---|---|
| **Aprendiz** | 1 | Se vincula solo a su ficha y ve su horario (H-1, H-2); le llega aviso cuando se publica o cambia |
| **Instructor** | 4 | Consulta correcta y ya tiene voz: reporta novedades y recibe la resolución (H-4, H-8) |
| **Coordinador** | 20 | Ciclo cerrado: programa, publica —avisando— y recibe lo que reportan los instructores |
| **Administrador** | todas | Alta de personas cerrada de punta a punta; la credencial se entrega a mano hasta H-15 |

## Orden sugerido

1. ~~**H-13** primero: sin cuentas con rol no se puede verificar nada de lo demás.~~
2. ~~**H-5** y **H-1**: dos tareas pequeñas que arreglan el acceso y resucitan un rol entero.~~
3. ~~**H-3** con **H-7**~~ y **H-15**: cierra el alta de personas de punta a punta.
4. ~~**H-4** con **H-8**: cierra el circuito instructor ↔ coordinador.~~
5. El resto (H-10, H-11, H-12), según prioridad del equipo. ← acá quedó

---

## Cierre del 2026-09-24

Ocho tareas resueltas en una jornada, con el backend y el frontend corriendo
en local y verificando contra la base compartida. Suites: 218 pruebas del
cliente y 209 del backend, todas en verde.

**H-13 · Cuentas de prueba.** `ana@mail.com` (Coordinador) y `carlos@mail.com`
(Instructor) recuperaron su rol. `backend/scripts/crear_cuentas_prueba.py` ahora
crea las tres cuentas demo —Coordinador incluido, que no existía— y de paso
repone el rol documentado a las cuentas de `database/02_datos_prueba.sql` que
estén sin ninguno. Es idempotente. `sergio@mail.com` sigue sin rol: no está
documentado en ningún lado, así que no se le inventó uno.

**H-5 · Roles por ruta.** Las 23 rutas privadas declaran `roles={...}`; solo
`/dashboard` queda abierta, porque reparte por rol adentro. Quien no tiene el
rol va a `/dashboard`, no a un error. ProtectedRoute pide el perfil por
`services/perfil.ts`, un caché por sesión creado para esto: sin él cada
navegación pagaba un `GET /usuarios/me` extra y un "Cargando…" de pantalla
completa. AppShell usa el mismo caché, así que ambos comparten un request.

**H-1 · Vinculación de ficha.** El estado sin ficha de `MiHorarioAprendiz.tsx`
es ahora un formulario de un campo que llama a `POST /ficha-usuario/vincular` y
recarga ficha y horario sin salir de la pantalla. El código inexistente explica
qué hacer en vez de repetir el texto del backend. Verificado de punta a punta
con la cuenta `aprendiz.demo@sihs-pruebas.com` contra la base real: sin ficha →
404, código inventado → 404 con mensaje útil, código bueno → 15 bloques
publicados.

**H-2 · Código de ficha del registro.** `get_current_user` lee `codigo_ficha` de
la metadata de Supabase al crear la fila de perfil y deja el vínculo hecho. Si
el código no existe, el login sigue igual y H-1 queda como rescate. **Ojo:** el
registro sigue sin otorgar rol —eso pasa por el alta del Administrador—, así que
un aprendiz recién registrado necesita que le asignen el rol Aprendiz antes de
ver su horario. Auto-asignarlo era una decisión de seguridad que este plan no
pedía.

**H-3 · `/solicitudes-acceso`.** Router, servicio y repositorio nuevos, con el
contrato que las dos pantallas ya usaban: `POST /` público, `GET /` solo
Administrador, `POST /{id}/aprobar` (idRol) y `POST /{id}/rechazar`
(motivoRechazo). Aprobar se apoya en `CredencialTemporalService` y crea la
cuenta ANTES de marcar la solicitud, para que un fallo de Supabase la deje
pendiente y reintentable. Resolver dos veces da 409 en vez de pisar la decisión
del primero. Como el correo todavía no sale (H-15), la respuesta trae
`passwordTemporal` y `correoEnviado: false`, y el panel muestra la clave en vez
de prometer un correo que no llega. Verificado en vivo: solicitud pública sin
sesión, duplicada → 409, cola visible para Administrador y 403 para
Coordinador, rechazo con motivo. Aprobar quedó cubierto solo por pruebas
(11 casos): hacerlo en vivo crea una cuenta real en la base compartida.

**H-7 · Alta de personas — se decidió lo contrario a lo sugerido.** El plan
proponía eliminar `AprobarlicitarSolicitudes.tsx`; se conservó. Atiende un caso
que el Panel no cubre: gente que YA se registró con el formulario normal
(Instructor/Aprendiz) y quedó sin ningún rol — no hay fila en
`solicitudes_acceso` detrás de esa gente, así que el Panel no la ve. Ahora está
en el menú como «Usuarios sin rol» y deja de ser una pantalla huérfana. Quedan
dos caminos, cada uno con su caso, los dos en el menú.

**H-6 · Usuarios y Roles.** La regla real es que repartir roles es del
Administrador. «Usuarios» y «Roles» pasaron a `soloAdmin` en el navbar y a
`ADMIN` en sus rutas; el backend no se tocó. No se amplió el permiso al
Coordinador porque podría otorgarse a sí mismo cualquier rol, incluido
Administrador.

**H-4 · El instructor ya tiene voz.** El backend estaba entero desde SCRUM-116
y no lo llamaba ninguna pantalla. Ahora «Reportar Novedad» y «Radicar Solicitud
de Cambio» (las dos del detalle de franja) abren el mismo modal con tipo
—novedad / permuta / cambio de ambiente— y motivo obligatorio; debajo queda la
lista de lo ya reportado de esa franja con su estado, para que nadie lo mande
dos veces creyendo que se perdió. Del otro lado, `/cambios` es la bandeja del
coordinador, y el ítem «Cambios» del navbar dejó de estar en gris. Verificado
en vivo: el instructor reporta (201), el coordinador lo ve en su cola, lo
aprueba, y al instructor le entra la notificación; un Aprendiz recibe 403 en esa
cola. **Aprobar registra la decisión, no mueve el horario** —el motivo es texto
libre, no un destino estructurado— y la pantalla lo dice en vez de dejar creer
lo contrario; aplicar el cambio real sigue siendo un ticket aparte.

**H-8 · Las notificaciones llegan.** Tres cosas: (1) el tipo que usaba el único
disparador existente («Cambios de Aula & Horario») no era ninguno de los cuatro
que el panel de la campana sabe pintar, así que ese aviso salía sin icono ni
color — ahora el vocabulario es cerrado y `NotificacionService.crear` rechaza
cualquier otro; (2) mover el ambiente o reasignar un bloque avisa al instructor
actual y, si cambió de manos, también al anterior («ya no tienes este bloque»),
no solo a los aprendices; (3) resolver una solicitud de cambio le avisa a quien
la puso (H-4).

**H-9 · Publicar avisa.** Un horario **nace publicado** (`server_default true`),
así que el aviso cuelga del alta y no solo del PATCH de estado: si colgara solo
de «borrador → publicado», el camino normal —crear y listo— no avisaría nunca.
Los avisos se agrupan por ficha en una ventana de 10 minutos: el asistente
guarda bloque por bloque, y sin eso cada aprendiz recibiría treinta campanazos
idénticos. Despublicar no avisa, y republicar no repite el aviso.

**H-14 · Errores crudos.** `getUserFriendlyApiMessage` ya no devuelve el
`detail` del backend para 401/403/500/502/503/504 — ahí gana un mensaje que
dice qué pasó y qué hacer. Para 400/404/409/422 sí se respeta, porque ahí el
backend escribe para quien lo lee («No existe una ficha con ese código»). El
503 por IA apagada explica que falta configurarla en el servidor y que el resto
de la programación funciona igual, sin nombrar ninguna variable de entorno. Un
fallo de red tiene su propio mensaje: el backend ni se enteró del intento.
