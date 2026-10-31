# Sección de Estudiantes — planeación (aún no implementado)

**Estado: documentado, sin construir.** Se decidió el 2026-08-25 que hace
falta una sección para que los estudiantes usen el sistema, pero todavía no
hay suficiente información para programarla completa — este documento deja
por escrito lo que ya se sabe, lo que hay que decidir antes de tocar código,
y por qué el módulo `horarios` (ver
[`backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`](../../backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md))
sigue siendo el bloqueador real.

## Alcance pedido (y solo esto, por ahora)

> "solo quiero que puedan ingresar su ficha y ver su horario de la semana"

Dos pantallas, nada más:

1. **Ingresar/registrar su ficha.**
2. **Ver su horario de la semana** (solo lectura — el estudiante no edita
   horarios, eso es de Coordinador/Administrador vía `NuevoHorario.tsx`).

Todo lo demás (notas, asistencia, notificaciones, etc.) queda explícitamente
fuera de alcance hasta que se pida.

## Hallazgo importante: el rol ya existe

Antes de crear un rol nuevo, ojo con esto — **ya existe un rol `Aprendiz`**,
sembrado y funcionando de punta a punta:

- `database/02_datos_prueba.sql` lo inserta en `roles` junto con
  Administrador/Coordinador/Instructor, y le asigna el rol a dos usuarios de
  prueba (`juan@mail.com`, `maria@mail.com`, contraseña `Prueba123!`).
- `backend/app/core/supabase_auth.py` ya tiene
  `require_aprendiz = require_role("Aprendiz")` listo para proteger
  endpoints, igual que `require_admin`/`require_coordinador`/`require_instructor`.
- El CRUD de `roles` (`backend/app/api/v1/roles.py`) ya es genérico — un rol
  es solo una fila `{idRol, nombre}` en la tabla `roles`, sin lógica especial
  por rol en el modelo. Crear un rol nuevo (si hiciera falta uno distinto)
  no requiere cambiar código, solo un `POST /roles` como Administrador.

**Decisión pendiente para el equipo:** ¿la "sección de estudiantes" es el
rol `Aprendiz` que ya existe (recomendado — evita un rol duplicado con el
mismo significado), o es deliberadamente un concepto distinto (p. ej.
`Estudiante` = acceso mínimo ficha+horario, mientras que `Aprendiz` a futuro
tenga más funciones académicas)? Este documento asume que se reutiliza
`Aprendiz` salvo que se decida lo contrario — si se decide crear un rol
nuevo, es un `POST /roles` y ya, el resto del documento no cambia.

## Por qué no se puede programar todavía

Las dos pantallas dependen de módulos de backend que **no existen en código
todavía** (las tablas sí existen en Supabase, ver `database/01_creacion.sql`,
pero no hay modelo/esquema/repositorio/servicio/ruta — ver la tabla de
estado en `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`):

| Pantalla del estudiante | Necesita del backend | Estado |
|---|---|---|
| Ingresar su ficha | módulo `fichas` (CRUD) + tabla `ficha_usuario` (matrícula) | ❌ No existe en código |
| Ver su horario de la semana | módulo `horarios` + `horario_dia` | ❌ No existe en código — **es el objetivo central del proyecto**, ver `OBJETIVO_Y_SERVICIOS_FALTANTES.md` |

En corto: **no tiene sentido construir la vista del estudiante antes que el
módulo `horarios` real**, porque no habría datos que mostrarle. El orden
recomendado del backend ya lo dice (sección "Orden recomendado para
programar lo que falta" en ese archivo) — `fichas` es el paso 3 y `horarios`
el paso 6, el último.

## Preguntas abiertas (bloquean el diseño, no solo el código)

1. **¿Cómo entra un estudiante?** ¿Necesita cuenta de Supabase Auth (login
   con email/contraseña, como los demás roles) o es una consulta pública sin
   sesión (cualquiera con el código de ficha ve ese horario)? El resto de la
   app usa Supabase Auth para todo — lo consistente es que el estudiante
   también inicie sesión como `Aprendiz`, pero hay que confirmarlo porque
   cambia el diseño del endpoint (protegido vs. público).
2. **¿"Ingresar su ficha" crea la ficha o solo la vincula?** La tabla
   `fichas` la deberían poblar Coordinación/Administrador (código, programa,
   trimestre) — lo más probable es que el estudiante solo **escriba un
   código de ficha que ya existe** y el sistema lo vincule vía
   `ficha_usuario`, no que cree una ficha nueva. Si escribe un código que no
   existe, ¿qué mensaje ve?
3. **¿Uno o varios estudiantes por ficha, y una o varias fichas por
   estudiante?** El esquema (`ficha_usuario` es N:N) permite ambas cosas,
   pero el flujo de UI típico de SENA es un aprendiz perteneciendo a una
   sola ficha activa a la vez. Confirmar antes de programar la pantalla.
4. **¿Qué pasa si el estudiante cambia de ficha?** ¿Puede editar su ficha
   después de ingresarla la primera vez, o es un dato que solo pone una vez?
5. **¿El horario se ve por ficha completa o filtrado a algo más?** Con el
   esquema actual, `horarios.idFicha` ya identifica todos los bloques de esa
   ficha en la semana — ver el horario completo de su ficha (todas las
   materias/instructores) parece lo esperado, pero confirmarlo evita
   rehacer la consulta después.

## Qué hace falta cuando se resuelva lo anterior (referencia técnica)

Documentado para no tener que releer todo el proyecto cuando se retome —
sigue el mismo patrón de capas de `ESTRUCTURA.md` en backend y frontend.

**Backend** (además de programar los módulos `fichas` y `horarios` que ya
estaban planeados de todas formas):

- `POST /fichas/mi-ficha` (protegido con `require_role("Aprendiz")` o el rol
  que se decida): recibe un `codigoFicha`, busca la fila en `fichas`, y crea
  el vínculo en `ficha_usuario` con `get_current_user`. 404 si el código no
  existe.
- `GET /horarios/mi-horario` (mismo rol): resuelve la ficha del usuario
  autenticado vía `ficha_usuario`, y devuelve sus `horarios` + `horario_dia`
  de la semana. Es de **solo lectura** para este rol — no exponerle
  `POST`/`PUT`/`DELETE` de `horarios`, esos siguen siendo de
  Coordinador/Administrador.

**Frontend:**

- `src/pages/MiFicha.tsx` — formulario simple (un input + botón), llama a
  `POST /fichas/mi-ficha`.
- `src/pages/MiHorario.tsx` — vista de solo lectura de la semana. Puede
  reutilizar los componentes presentacionales que ya existen en
  `components/horario/` (`GridHorario.tsx`, `CeldaHorario.tsx`) en modo
  lectura (sin pasar `onClicCelda`/`onQuitarCelda` activos) en vez de
  duplicar el grid — son presentacionales puros, no dependen de
  `useHorarioState` para renderizar.
- **Falta enrutamiento por rol.** Hoy `ProtectedRoute.tsx`
  (`frontend/src/routes/ProtectedRoute.tsx`) solo verifica que haya sesión
  iniciada, no el rol del usuario — cualquier usuario logueado puede entrar
  a `/horarios/nuevo` (el editor). Antes de exponer pantallas de estudiante
  hay que extender `ProtectedRoute` para aceptar algo como
  `roles={['Aprendiz']}` y redirigir si no coincide, igual para las
  pantallas que NO son de estudiante (que un `Aprendiz` no pueda entrar al
  editor de horarios).
- **El menú lateral es el mismo para todos los roles.** El arreglo `NAV` en
  `AppShell.tsx` (`frontend/src/components/AppShell.tsx`) está hardcodeado
  igual para cualquier usuario — hay que hacerlo depender de
  `miPerfil`/el rol activo para que un estudiante solo vea "Mi ficha" y "Mi
  horario", no Ambientes/Instructores/Reportes.

## Siguiente paso real

No programar nada de esto todavía. Cuando se resuelvan las preguntas
abiertas de arriba (probablemente en la próxima reunión de equipo o con el
coordinador), actualizar este documento con las respuestas y recién ahí
convertir la tabla de "qué hace falta" en tareas concretas — siguiendo el
mismo orden que ya tiene `fichas` (paso 3) y `horarios` (paso 6) en
`backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`.
