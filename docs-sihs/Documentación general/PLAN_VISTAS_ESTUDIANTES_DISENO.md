# Plan de diseño — Vistas de Estudiantes (Mi Horario + Mis Proyectos)

**Para quien retome esto**: este documento es de **diseño/UX** (pantallas +
prompts de Stitch). El plan de **lógica/backend** está en un documento
hermano: `PLAN_VISTAS_ESTUDIANTES_LOGICA.md`. Lee primero
[`SECCION_ESTUDIANTES.md`](./SECCION_ESTUDIANTES.md) — pero con una
corrección importante:

> **`SECCION_ESTUDIANTES.md` está desactualizado.** Dice que los módulos
> `fichas` y `horarios` "no existen en código todavía" — eso era cierto el
> 2026-08-25, pero **ya no**: ambos están completos y en producción
> (`Fichas.tsx`, `HorarioService` con detección de cruces, etc. — ver
> `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`). El bloqueador real hoy es
> mucho más chico de lo que ese documento describe — ver siguiente sección.

## Qué ya existe de verdad (verificado en código, no supuesto)

- `POST /ficha-usuario/vincular` (`backend/app/api/v1/ficha_usuario.py`,
  protegido con `require_aprendiz`) — el estudiante manda un `codigoFicha`,
  el backend lo vincula vía `FichaUsuarioService.vincular`. Ya devuelve 404
  si el código no existe y 400 si ya tiene una ficha vinculada. **Esto es
  exactamente la pantalla "Ingresar mi ficha" — el backend ya está.**
- `GET /ficha-usuario/mi-ficha` (mismo archivo, mismo rol) — devuelve la
  ficha ya vinculada del usuario autenticado, 404 si no tiene ninguna.
- El rol `Aprendiz` ya existe, sembrado, con `require_aprendiz` listo en
  `backend/app/core/supabase_auth.py`.

## El único gap real de backend para "Mi Horario (Estudiante)"

`GET /fichas/{id}/horarios` (que trae el horario completo de una ficha) está
protegido con `require_lectura_catalogo` = solo `Coordinador`/`Administrador`
(`backend/app/core/supabase_auth.py:111`) — **un Aprendiz no puede llamarlo**.
No existe hoy ningún endpoint de horarios que un Aprendiz pueda usar. Falta
uno nuevo tipo `GET /horarios/mi-horario` (protegido `require_aprendiz`) que
resuelva la ficha del usuario vía `ficha_usuario` y devuelva sus horarios —
ver el plan de lógica para el detalle exacto. **Diseña la pantalla asumiendo
que este endpoint existirá con esa forma de respuesta** (misma forma que ya
devuelve `HorarioResponse`: fichaCodigo/instructorNombre/ambienteNombre ya
enriquecidos, igual que en `MiHorario.tsx` de instructor).

## "Mis Proyectos" — no hay NADA de backend todavía

Verificado: no existe ningún modelo, tabla, ni endpoint relacionado a
"proyecto", "entrega" o similar en todo `backend/app/`. Ni siquiera
`actividades_aprendizaje` (el desglose fino de un resultado de aprendizaje,
que sería lo más cercano) está programado — ver fila "❌ Falta" en
`OBJETIVO_Y_SERVICIOS_FALTANTES.md`. Esta pantalla se puede **diseñar** ya
(explorar el concepto), pero cualquier prompt de Stitch para ella debe
pedir datos de ejemplo explícitamente marcados como tal — no hay forma de
conectarla a nada real hasta que exista ese módulo.

## Pantallas a diseñar

| Pantalla | Bloqueada por | Se puede diseñar ya? |
|---|---|---|
| **Vincular mi ficha** (`MiFicha.tsx`) | Nada — el backend ya existe | Sí, y se puede construir de una vez (ver plan de lógica) |
| **Mi Horario (Estudiante)** | Falta 1 endpoint nuevo (`GET /horarios/mi-horario`) | Sí — diseñar ahora, conectar cuando el endpoint exista. Reusar layout de `MiHorario.tsx` (instructor), quitando todo lo que sea de gestión (no hay "solicitar cambio" para un estudiante, es puramente informativo) |
| **Mis Proyectos** | Todo el backend (no existe ningún modelo) | Solo como exploración visual con datos de ejemplo — no construir la conexión real todavía |

## Fases sugeridas

1. **Fase 1 (ya desbloqueada)**: construir `MiFicha.tsx` (vincular ficha) —
   no necesita diseño nuevo de Stitch, es un formulario simple de 1 campo,
   sigue el patrón de `AuthLayout.tsx`/formularios ya existentes.
2. **Fase 2 (falta 1 endpoint chico)**: pedir a alguien de backend el
   endpoint `GET /horarios/mi-horario` (ver plan de lógica), y en paralelo
   diseñar "Mi Horario (Estudiante)" con el prompt de abajo.
3. **Fase 3 (bloqueada por completo)**: no empezar "Mis Proyectos" en serio
   hasta que el equipo decida el modelo de datos (¿qué es un "proyecto"?
   ¿quién lo crea, el instructor? ¿tiene entregas con fecha? ¿nota?) — son
   preguntas de producto, no de diseño ni de código.

## Prompt de Stitch — "Mi Horario (Estudiante)"

Listo para pegar. Usa el mismo sistema visual que el resto del proyecto
(tokens Material Design 3 de `_Docs/Diseño/GUIA_DE_MARCA.md` v2: `primary`
verde institucional, Hanken Grotesk/Geist, Material Symbols Outlined,
`rounded-xl`) — mira `_Docs/Diseño/mockups-stitch/mi_horario_sihs_sena/` como
referencia de tono, pero esta versión es de un ESTUDIANTE, no de un
instructor: es puramente de consulta, sin ninguna acción de gestión.

---

Diseña "Mi Horario" para el rol Aprendiz/Estudiante del sistema SIHS-SENA,
mismo sistema visual que el resto del proyecto (navbar superior simplificado
— un estudiante no ve los desplegables de Programación/Formación/Recursos/
Operación/Administración, esos son solo de Coordinación). Contenido real que
debes respetar:

- Encabezado: "Mi Horario" + subtítulo con el código y nombre de la ficha
  vinculada (ej. "Ficha 2670142 · Análisis y Desarrollo de Software").
- Grid semanal de solo lectura (Lunes a Sábado, franjas Mañana/Tarde/Noche)
  mostrando cada bloque: nombre del resultado/competencia, instructor,
  ambiente, hora — igual formato visual que ya usa el grid de horarios del
  resto de la app (celdas verdes/azules por jornada, texto siempre oscuro).
- NO incluyas ninguna acción de edición, solicitud de cambio, exportar a PDF
  con firma, ni nada que implique que el estudiante gestiona el horario —
  es 100% informativo.
- Si no tiene ficha vinculada todavía: un estado vacío con botón "Vincular mi
  ficha" que lleva al formulario de vinculación.

---

## Prompt de Stitch — "Mis Proyectos" (exploración visual, datos de ejemplo)

**Antes de usar este prompt, deja explícito en la respuesta de Stitch (o en
el `code.html` resultante) que TODOS los datos son de ejemplo** — no hay
ningún modelo de "proyecto" en el backend todavía, así que esta pantalla no
se puede conectar a nada real sin que el equipo defina primero qué es un
proyecto para SIHS (ver "Fase 3" arriba).

---

Diseña una pantalla exploratoria "Mis Proyectos" para el rol Estudiante del
sistema SIHS-SENA, mismo sistema visual del proyecto (tokens de
`_Docs/Diseño/GUIA_DE_MARCA.md` v2). Es una vista de datos de ejemplo para
explorar el concepto, no una pantalla que se vaya a construir de inmediato.
Contenido sugerido (todo de ejemplo, márcalo así en el diseño):

- Lista de tarjetas de proyecto: nombre del proyecto, ficha/programa al que
  pertenece, instructor responsable, estado (ej. "En curso", "Entregado",
  "Pendiente de revisión" — badges con los tokens semánticos ya definidos:
  `primary-container` para al día, `tertiary-container` para próximo a
  vencer, `error-container` para atrasado), fecha de entrega.
- Detalle de un proyecto: descripción, criterios de evaluación, entregables.

No inventes una acción de "subir entrega" funcional — es solo exploración de
layout.

## Siguiente paso real

1. Confirmar con el equipo que se reutiliza el rol `Aprendiz` (pregunta
   abierta #1 en `SECCION_ESTUDIANTES.md`, sigue sin responder).
2. Construir `MiFicha.tsx` ya (fase 1, sin bloqueo).
3. Pedir el endpoint `GET /horarios/mi-horario` (ver
   `PLAN_VISTAS_ESTUDIANTES_LOGICA.md`) y diseñar "Mi Horario (Estudiante)"
   en paralelo con el prompt de arriba.
4. No tocar "Mis Proyectos" en serio hasta resolver qué es un proyecto para
   el negocio — es decisión de producto, no de diseño.
