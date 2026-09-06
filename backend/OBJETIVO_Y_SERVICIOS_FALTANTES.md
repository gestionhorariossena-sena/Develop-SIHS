# Qué falta para cumplir el objetivo del proyecto

Este documento es distinto de `PENDIENTE_MVP.md` (que es solo "qué falta
para mostrar algo en 24h"). Aquí está **todo lo que falta** para que el
sistema cumpla lo que dice la documentación del proyecto — pensado para que
cualquiera del equipo pueda tomar un módulo y programarlo sin tener que
releer todos los PDFs de requisitos primero.

## El objetivo real (no lo pierdan de vista)

> Detectar y evitar que un instructor, un ambiente o una ficha queden
> **cruzados** en el mismo horario. Todo lo demás (usuarios, roles,
> catálogos) existe para que este único problema se pueda resolver.

Si en algún momento hay que elegir en qué trabajar primero, el módulo
`horarios` siempre gana — es literalmente la razón por la que existe SIHS
(ver `_Docs/Documentación general/Propuesta de proyecto V1.md` y la
entrevista con el coordinador en `_Docs/Elicitación/`).

## Cómo leer la tabla

Las 19 tablas del dominio **ya existen** en Supabase (`database/01_creacion.sql`).
Lo que falta es la capa de código de cada una: modelo (SQLAlchemy), esquema
(Pydantic), repositorio, servicio y rutas — siguiendo exactamente el mismo
patrón que ya está armado para `roles`/`usuarios`/`usuario_rol` (ver
`ESTRUCTURA.md` para el patrón paso a paso).

| Módulo | Tablas (ya existen) | Estado del código | Para qué sirve |
|---|---|---|---|
| Autenticación | `auth.users` (Supabase) | ✅ Hecho | Login, registro, recuperación de contraseña — vía Supabase Auth |
| Usuarios / Roles | `usuarios`, `roles`, `usuario_rol` | ✅ Hecho | Perfil, control de acceso por rol |
| Especialidades | `especialidades`, `usuario_especialidad` | ✅ Hecho | Catálogo de especialidades de instructores (un instructor puede tener varias) |
| Estructura académica | `coordinaciones`, `programas`, `trimestres`, `fichas` | ✅ Hecho | Base para poder crear fichas |
| Sedes y ambientes | `sedes`, `ambientes` | ✅ Hecho | Dónde puede dictarse una clase — necesario antes de `horarios` |
| Jornadas y días | `jornadas`, `diasDeLaSemana` | ✅ Hecho | Catálogos simples, casi sin lógica — buen punto de entrada para alguien nuevo en el backend |
| Guías | `guias` (tabla nueva, 2026-08-26) | ✅ Hecho | Agrupa resultados de aprendizaje y los ubica en un trimestre — ver `PLAN_INTEGRACION_LOGICA_Y_BD.md` §2.1 |
| **Horarios** | `horarios`, `horario_dia` | ✅ **Hecho — detección de cruces probada en vivo contra Supabase** | Crear/editar horarios **detectando cruces** de instructor, ambiente, ficha y resultado repetido |
| Competencias / resultados | `competencias_formacion`, `resultados_aprendizaje` | ✅ Hecho | Lo que se enseña en cada bloque de horario |
| Actividades de aprendizaje | `actividades_aprendizaje` | ❌ Falta | Desglose fino de un resultado — no bloquea `horarios`, se puede hacer después |
| Matrícula de fichas | `ficha_usuario` | ✅ Hecho | Vincula un aprendiz a una ficha existente — endpoints `POST /ficha-usuario/vincular` y `GET /ficha-usuario/mi-ficha`, ambos `require_aprendiz` |
| Auditoría / trazabilidad | `auditoria` (tabla nueva, 2026-08-31) | ✅ Hecho en código — ⚠️ **falta aplicar el `CREATE TABLE` a Supabase**, no se corrió todavía contra el proyecto compartido | RNF-26/RNF-27: registra usuarios/horarios/ambientes/fichas modificados e intentos fallidos de login (`POST /auditoria/intento-fallido-login`, pública) — base que necesita SCRUM-17 para bloquear tras 3 intentos |

## Orden recomendado para programar lo que falta

Actualizado 2026-08-26 — **el núcleo del sistema (catálogos + `horarios`
con detección de cruces) ya está hecho**, con datos sintéticos para poder
probarlo (ver `database/02_datos_prueba.sql`, sección "AMPLIACIÓN
2026-08-26"). La detección de cruces se probó en vivo contra Supabase:
rechaza instructor duplicado, ambiente duplicado, ficha duplicada y
resultado repetido en la misma ficha con `409` y el mensaje correspondiente
(ver `_Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md` §3).

1. ~~Jornadas y días~~ — ✅ hecho.
2. ~~Sedes → Ambientes~~ — ✅ hecho (ojo: la migración
   `database/migrations/03_ambientes_requisitos.sql` no estaba aplicada en
   Supabase hasta ahora — ya se aplicó).
3. ~~Coordinaciones → Programas → Trimestres → Fichas~~ — ✅ hecho.
4. ~~Especialidades~~ — ✅ hecho.
5. ~~Guías → Competencias → Resultados~~ — ✅ hecho (`actividades_aprendizaje`
   queda pendiente, no bloquea nada).
6. ~~Horarios~~ — ✅ hecho, con las 4 validaciones de cruce en
   `HorarioService._detectar_cruces`.

**Lo que sigue, con datos sintéticos ya no es excusa para no avanzar:**

- Reemplazar el dataset sintético por datos reales cuando lleguen (ver
  `PLAN_INTEGRACION_LOGICA_Y_BD.md` §4 para el formato esperado por
  catálogo).
- Migrar `NuevoHorario.tsx` de `horarios_guardados` (JSONB, texto libre) al
  módulo `horarios` real (selects contra los catálogos reales) — ver
  `PLAN_INTEGRACION_LOGICA_Y_BD.md` §5. Es el trabajo de frontend más
  importante que queda.
- `actividades_aprendizaje` — no bloquea nada, se puede hacer cuando haga
  falta.
- El `EXCLUDE` constraint de Postgres sigue comentado en `01_creacion.sql`
  (segunda barrera a nivel de base de datos) — sigue bloqueado por lo mismo:
  exige que el día viva en `horarios` en vez de en `horario_dia` aparte. La
  validación en `HorarioService` ya cubre los 4 tipos de cruce sin necesitar
  esto, así que no es urgente.

## Contenido de vitrina del frontend (rediseño 2026-09-06)

El rediseño visual completo (navbar + tokens Material Design 3 + 8 pantallas
reconstruidas contra mockups reales de Stitch, ver `_Docs/Diseño/
GUIA_DE_MARCA.md` v2 y `_Docs/Diseño/mockups-stitch/`) priorizó fidelidad
visual total, por pedido explícito del usuario, incluso donde el dato de
fondo no existe todavía. Esos 16 casos quedaron como contenido estático
hardcodeado en el frontend, cada uno marcado con el comentario `// Contenido
de mockup (Stitch) — pendiente de conectar a un dato real del backend` (o
similar) justo antes del bloque JSX correspondiente — búsquenlo literal para
ubicarlos todos. Esta tabla es el resumen de qué necesitaría cada uno para
dejar de ser vitrina:

| Pantalla | Elemento estático | Qué faltaría en el backend |
|---|---|---|
| `Ambientes.tsx` / `VistaAmbientes.tsx` | Pestañas de piso (P1-P4), capacidad y equipamiento técnico por ambiente | `Ambiente` no tiene columna `piso`, `capacidad` ni `equipamiento` — habría que agregarlas a `ambientes` (migración) y al modelo/schema |
| `AprobarlicitarSolicitudes.tsx` | Chips "tiempo de resolución promedio" / "eficiencia de matriz" | No hay ninguna métrica agregada de este tipo — requeriría calcularla sobre `usuario_rol`/`auditoria` o una tabla de métricas nueva |
| `Dashboard.tsx` | "Ambiente alterno sugerido" en el panel de conflicto | No existe un motor de sugerencia de ambientes libres equivalentes — requeriría lógica nueva en `HorarioService` (buscar ambiente libre en la misma franja con características similares) |
| `Fichas.tsx` | Capacidad de ambiente, "vocero aprendiz", historial de cambios de la ficha | `ficha_usuario` no tiene campo de vocero; no hay endpoint que traiga el historial de `auditoria` filtrado por ficha (la tabla sí registra cambios de horario, falta el endpoint de consulta) |
| `Instructores.tsx` | Segmentación de carga Lectiva/Proyectos/Preparación, "ambiente fijo asignado", alerta de "solicitud de cambio" | `CargaSemanal` solo trae total/máximo, no desglose por tipo; no existe "ambiente fijo" (un instructor puede dictar en varios); no existe tabla de solicitudes de cambio de horario |
| `MiHorario.tsx` | "Ambiente actual/en sesión ahora", navegación entre semanas, sincronización SOFIA Plus/SINERGIA, leyenda "en sesión"/"programado", desglose de horas aula vs. asesoría | Sin endpoint de "qué está pasando ahora mismo"; `GET /usuarios/me/horarios` no pagina por semana; no hay integración externa con SOFIA Plus/SINERGIA; `GridHorario` no modela ese estado; no hay categoría de actividad por bloque |
| `NuevoHorario.tsx` (Constructor) | Panel "Sugerencias del Sistema", indicador de ocupación de sede | No hay motor de sugerencias algorítmicas ni endpoint de ocupación agregada por sede (sí existe el barrido de conflictos real, `GET /horarios/auditoria-cruces`, que es distinto) |

Al resolver cualquiera de estos, buscar el comentario correspondiente en el
`.tsx` y reemplazar el bloque estático por el fetch real — quitar también el
comentario para que no quede documentación desactualizada.

## Sección de estudiantes (planeada, no programada todavía)

Se decidió agregar una sección para que los estudiantes ingresen su ficha y
vean su horario de la semana (solo lectura). Depende de que `fichas` y
`horarios` (pasos 3 y 6 de arriba) ya existan en código, y todavía faltan
decisiones de diseño por resolver — ver
[`_Docs/Documentación general/SECCION_ESTUDIANTES.md`](../_Docs/Documentación%20general/SECCION_ESTUDIANTES.md)
antes de empezar a programarla.

## Al terminar cada módulo

Para los requisitos exactos (qué debe validar cada endpoint, qué campos son
obligatorios, etc.) revisen `_Docs/Informes de requisitos/Requisitos
Funcionales V4.pdf` — es la versión más reciente y la que coincide con los
wireframes en `_Docs/Diseño/wireframes.pdf`. Las versiones V1-V3 quedaron
como historial, tienen numeración de requisitos distinta a V4, no las usen
como referencia para programar.

Cada módulo nuevo necesita también su fila en este archivo pasando de ❌ a
✅ — así el equipo ve el avance real de un vistazo sin tener que preguntar.
