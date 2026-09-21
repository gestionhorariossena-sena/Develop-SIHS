# Plan de lógica/backend — Vistas de Estudiante (2026-09-06)

Complemento de implementación real de
[`SECCION_ESTUDIANTES.md`](./SECCION_ESTUDIANTES.md) y del lado visual en
[`PLAN_VISTAS_ESTUDIANTES_DISENO.md`](./PLAN_VISTAS_ESTUDIANTES_DISENO.md)
(mismo momento, otro documento). Este archivo es solo backend + wiring de
frontend — no repite el lado de diseño/Stitch.

## Aviso: el bloqueador de `SECCION_ESTUDIANTES.md` ya no existe

Ese documento (2026-08-25) decía que las pantallas de estudiante no se
podían programar porque los módulos `fichas` y `horarios` "no existen en
código todavía". **Eso cambió** — ver
[`backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`](../../backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md):
`fichas`, `ficha_usuario` y `horarios` están ✅ Hecho, con detección de
cruces probada en vivo. Verifiqué el código real (no asumí nada del
documento viejo) y el estado es mejor de lo que ese documento asume:

- **`POST /ficha-usuario/vincular`** y **`GET /ficha-usuario/mi-ficha`** ya
  existen y funcionan (`backend/app/api/v1/ficha_usuario.py`), protegidos
  con `require_aprendiz` (rol `Aprendiz`, ya sembrado en
  `database/02_datos_prueba.sql` con usuarios de prueba
  `juan@mail.com`/`maria@mail.com`, clave `Prueba123!`). `vincular` ya
  responde 404 si el código no existe y 400 si el usuario ya tiene ficha
  vinculada (`FichaUsuarioService.vincular`, un aprendiz solo puede tener
  una ficha activa — coincide con lo que `SECCION_ESTUDIANTES.md` asumía).
  **La pantalla "Mi Ficha" no necesita nada nuevo de backend, solo el
  frontend.**
- **`GET /fichas/{id}/horarios`** también existe
  (`backend/app/api/v1/fichas.py:48`) y devuelve exactamente lo que se
  necesita para pintar el horario semanal. Pero está protegido con
  `require_lectura_catalogo` = `require_roles("Coordinador",
  "Administrador")` (`backend/app/core/supabase_auth.py:111`) — un
  `Aprendiz` recibiría 403. **No hay que quitarle esa protección** (eso
  dejaría a cualquier aprendiz consultar el horario de CUALQUIER ficha por
  id) — hace falta un endpoint nuevo, angosto, que resuelva la ficha del
  usuario autenticado en vez de recibir un id por parámetro (ver Épica J).

## Prerrequisito real: `ProtectedRoute.tsx` no filtra por rol

Confirmado hoy, sigue exactamente como `SECCION_ESTUDIANTES.md` lo describía
(no se arregló en el rediseño visual de esta sesión, que no tocó lógica):
`frontend/src/routes/ProtectedRoute.tsx` solo verifica que haya sesión, cero
lógica de rol. Hoy cualquier usuario autenticado puede navegar a mano a
`/horarios/nuevo` aunque el menú lateral no se lo muestre — el `AppShell`
solo oculta la *vitrina*, no protege la ruta. Antes de exponer cualquier
pantalla de estudiante real (que si necesita quedar exclusiva del rol
`Aprendiz`), esto hay que resolverlo — ver Épica H.

## No existe ninguna tabla de "proyectos"

Busqué en `database/01_creacion.sql` completo y en `backend/app/models/`:
no hay ninguna tabla ni modelo de proyecto/actividad de estudiante — ni
siquiera un borrador. `actividades_aprendizaje` (que suena parecido) es otra
cosa: desglose fino de un resultado de aprendizaje del *contenido*
curricular, no un proyecto asignado a una ficha con entrega. **"Proyectos
para estudiantes" es una feature nueva de cero**, no una que ya tenga
esquema esperando código (a diferencia de fichas/horarios). Ver Épica K.

## Backlog (estilo del backlog "Nuevo alcance" ya usado en este proyecto, ver
`PLAN_INTEGRACION_LOGICA_Y_BD.md` §7.4)

**H · Prerrequisito: enrutamiento por rol (frontend) — 3**
1. Extender `ProtectedRoute.tsx` para aceptar una prop `roles?: string[]` y
   redirigir a `/dashboard` (o a una página "no autorizado") si el rol del
   usuario autenticado no está en la lista — necesita traer el perfil
   (`GET /usuarios/me`, mismo patrón que ya usa `AppShell.tsx`) dentro del
   propio `ProtectedRoute` o recibirlo de un contexto de auth compartido.
2. Test: un usuario sin el rol requerido es redirigido, uno con el rol
   correcto ve el contenido.
3. Documentar el patrón en `frontend/ESTRUCTURA.md` para que las rutas
   nuevas de esta lista (y las que vengan después) lo usen desde el día 1.

**I · Mi Ficha (backend ya existe — 100% frontend) — 4**
4. Página `frontend/src/pages/EstudianteMiFicha.tsx`: formulario de un solo
   input (código de ficha) + botón, llama a `POST /ficha-usuario/vincular`.
5. Al montar, llamar primero a `GET /ficha-usuario/mi-ficha`: si ya hay
   ficha vinculada, mostrarla en vez del formulario (no dejar que un
   aprendiz con ficha ya vinculada vea el form de nuevo, ya que
   `vincular` le respondería 400).
6. Manejo de errores reales con los mensajes que ya devuelve el backend:
   404 → "No existe una ficha con ese código", 400 → "Ya tienes una ficha
   vinculada" (usar `getUserFriendlyApiMessage`/`ApiError.detail` como el
   resto de la app, no inventar textos nuevos).
7. Ruta `/mi-ficha` con `<ProtectedRoute roles={['Aprendiz']}>` (depende de H1).
8. Test de la página: vincular exitoso, ficha inexistente, ya vinculado, y
   el caso "ya tenía ficha, no muestra el formulario".

**J · Mi Horario de estudiante (falta 1 endpoint angosto, no reinventar
validación) — 6**
9. Nuevo endpoint `GET /ficha-usuario/mi-horario` en
   `backend/app/api/v1/ficha_usuario.py`, protegido con `require_aprendiz`:
   resuelve la ficha vía `FichaUsuarioService.obtener_mi_ficha` (ya existe)
   y si hay ficha, reusa `HorarioRepository.obtener_por_ficha(db,
   ficha.idFicha)` (ya existe, es lo mismo que usa
   `GET /fichas/{id}/horarios`) — **no reimplementar la consulta ni la
   detección de cruces**, esto es de solo lectura. 404 si no tiene ficha
   vinculada todavía (mismo criterio que `mi-ficha`).
10. Reusar el mismo enriquecimiento (`instructorNombre`/`ambienteNombre`/
    etc.) que ya arma `HorarioService._a_response` para la respuesta, para
    no duplicar ese mapeo en otro lado.
11. Schema de respuesta: puede ser directamente `list[HorarioResponse]`
    (el mismo que ya usa `GET /fichas/{id}/horarios`), no hace falta uno
    nuevo.
12. Página `frontend/src/pages/EstudianteMiHorario.tsx`: llama a
    `GET /ficha-usuario/mi-horario`, reusa `GridHorario.tsx`/
    `CeldaHorario.tsx` en modo `soloLectura` (son presentacionales puros,
    igual que ya hace `frontend/src/pages/MiHorario.tsx` del instructor —
    copiar ese patrón, no el de `NuevoHorario.tsx`/`HorarioEditor.tsx` que
    sí depende de `useHorarioState`).
13. Ruta `/mi-horario-estudiante` con `<ProtectedRoute roles={['Aprendiz']}>`
    (decisión de nombre de ruta pendiente: podría compartir `/mi-horario`
    con el instructor si `MiHorario.tsx` se vuelve un componente que
    decide qué endpoint llamar según el rol — evaluarlo antes de programar,
    puede ahorrar una página duplicada).
14. Test backend (200 con datos reales enriquecidos, 404 sin ficha
    vinculada, 403 si el rol no es Aprendiz) + test frontend de la página
    en sus 2 estados (con horario, sin ficha vinculada todavía).

**K · Proyectos de estudiante (esquema nuevo desde cero) — 6**
15. **Decisión de producto pendiente antes de programar** (preguntar al
    usuario/coordinador, no asumir): ¿quién crea un proyecto — instructor
    o coordinador? ¿el estudiante solo lo lee (como el horario) o puede
    marcarlo como entregado? ¿lleva archivo adjunto o solo texto/fecha?
16. Diseño de tabla `proyectos` (mínimo razonable, sin de más): `idProyecto`
    PK, `idFicha` FK a `fichas`, `titulo`, `descripcion`, `fechaEntrega`,
    `estado` (`'activo'`/`'cerrado'`, o los valores que defina 15),
    `fechaCreacion`. Migración SQL siguiendo el estilo de
    `database/migrations/`.
17. Modelo SQLAlchemy + schema Pydantic + repositorio + servicio + rutas,
    siguiendo exactamente el patrón de capas de `ESTRUCTURA.md` (mismo que
    se usó para `guias`, el ejemplo más reciente de tabla nueva).
18. Endpoint `GET /ficha-usuario/mis-proyectos` (mismo patrón de resolución
    de ficha del usuario autenticado que J9), solo lectura para `Aprendiz`.
    Endpoint(s) de creación/edición para quien decida el punto 15
    (Coordinador/Administrador probablemente, mismo criterio de roles que
    ya usa `require_lectura_catalogo` u otro específico si hace falta).
19. Página `frontend/src/pages/EstudianteMisProyectos.tsx` — mientras 15-18
    no estén resueltos, puede arrancar como contenido de vitrina (mismo
    patrón ya establecido en el rediseño 2026-09-06: comentario `//
    Contenido de mockup (Stitch) — pendiente de conectar a un dato real del
    backend`, ver `frontend/src/pages/MiHorario.tsx` como ejemplo real) para
    no bloquear el trabajo de diseño mientras se resuelve el esquema.
20. Tests del endpoint y la página una vez el esquema y las decisiones de
    15 estén cerradas.

## Dependencias entre épicas

H bloquea la exposición real de I7/J13/K19 (las rutas protegidas por rol),
pero no bloquea programar I4-6, J9-12 ni K16-18 — se puede avanzar todo en
paralelo y conectar las rutas al final. J depende de que I ya exista en
código (reusa `FichaUsuarioService.obtener_mi_ficha`), no de que el
usuario ya haya vinculado una ficha en producción. K15 (decisión de
producto) bloquea K16 en adelante — es lo primero que hay que resolver de
esa épica, todo lo demás de K puede esperar sin tocar código.

## Preguntas abiertas heredadas de `SECCION_ESTUDIANTES.md` (siguen sin
responder, no las asumí)

- ¿El estudiante puede cambiar de ficha después de vincularse la primera
  vez? Hoy el backend lo bloquea duro (400 "Ya tienes una ficha
  vinculada") sin ningún endpoint de desvincular — si se quiere permitir
  cambio, hace falta agregar uno nuevo, no está en este backlog porque no
  se pidió explícitamente.
- Ver también las preguntas 1 y 3 originales de `SECCION_ESTUDIANTES.md`
  (login vía Supabase Auth — ya confirmado que sí, el rol `Aprendiz`
  funciona de punta a punta; y una ficha activa a la vez — ya confirmado
  por el código real de `FichaUsuarioService.vincular`).
