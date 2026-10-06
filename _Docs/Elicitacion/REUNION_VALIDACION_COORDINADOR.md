# Reunión de validación con el coordinador y levantamiento de información pendiente

Origen: `Tareas_proyecto_horarios.pdf`, sección 5 (T-17 a T-21), prioridad 1.
Fecha de preparación: 2026-10-06.

Este documento es la guía para la próxima reunión con la coordinación. Junta
en un solo lugar qué hay que validar, qué hay que pedir y qué tenemos que
entender del asistente de carga de horarios. Parte de lo que ya está en
`_Docs/Documentación general/REGLAS_DE_NEGOCIO_CONOCIDAS.md` (resumen de las
entrevistas 1 con Teleinformática y Logística): acá no se repite lo que ya
está confirmado, solo lo que sigue abierto.

| Tarea | Qué se hace | Sección |
|---|---|---|
| T-17 | Reunión para validar requerimientos, procesos y prioridades | §1 |
| T-18 | Pedir toda la información faltante | §2 |
| T-19 | Entender el proceso completo de creación de fichas | §3 |
| T-20 | Aclarar datos, reglas, roles, estados y procesos | §4 |
| T-21 | Conocer el asistente de carga de horarios y cómo se integra | §5 |

Al terminar la reunión se llena §6 (acta) y se actualiza
`REGLAS_DE_NEGOCIO_CONOCIDAS.md` con lo que quede confirmado.

---

## 1. T-17 — Agenda de la reunión de validación

**Asistentes sugeridos:** coordinador(a) de Teleinformática y, si es posible,
el de Logística (trabajan distinto en varios puntos, ver la tabla
"Diferencias confirmadas entre coordinaciones"). Por el equipo: una persona
de front, una de back y quien tome el acta.

**Duración estimada:** 90 minutos.

| # | Tema | Tiempo | Objetivo |
|---|---|---|---|
| 1 | Demo corta del estado actual de SIHS | 15 min | Que el coordinador vea lo que ya existe: catálogos, constructor manual, detección de cruces, publicación, vistas del aprendiz e instructor |
| 2 | Validación de requerimientos | 20 min | Recorrer la lista de §1.1 y marcar cada punto como confirmado, a corregir o descartado |
| 3 | Procesos reales | 20 min | Creación de fichas (§3) y flujo de programación de un trimestre |
| 4 | Asistente de carga (§5) | 15 min | Probarlo con un Excel real del coordinador |
| 5 | Prioridades | 10 min | Ordenar lo pendiente (§1.2) |
| 6 | Compromisos de entrega de información | 10 min | Quién envía qué archivo y para cuándo (§2) |

### 1.1 Requerimientos a validar

Para cada uno: ✅ confirmado / ✏️ ajustar / ❌ descartar.

- [ ] Los cuatro tipos de cruce que el sistema bloquea: ficha, instructor y
      ambiente en el mismo día y hora, y el mismo resultado de aprendizaje
      repetido por el mismo instructor para la misma ficha en otro día.
- [ ] Se permite **forzar** un cruce con justificación, y queda registrado
      en auditoría (`FORZAR_CRUCE`). ¿Quién puede forzar? ¿Siempre debe ser
      posible?
- [ ] El margen de traslado entre sedes **no** es una regla dura (se
      coordina con el instructor). ¿Se quiere solo una advertencia?
- [ ] Bloques por jornada: mañana y tarde de 6 h (2 × 3 h), noche de 4 h
      (2 × 2 h), sábado solo mañana. Semana de unas 36 h.
- [ ] Horarios en **borrador** y **publicados** (con publicación
      programada). El aprendiz y el instructor solo ven lo publicado.
- [ ] Solicitudes de cambio de horario hechas por el instructor, que aprueba
      el coordinador.
- [ ] Registro de coordinadores con aprobación del Administrador.
- [ ] Instructores de planta con 32 h/semana que se programan primero.

### 1.2 Prioridades a ordenar con el coordinador

1. Carga de datos reales (fichas, instructores, ambientes, currículo).
2. Asistente de carga desde Excel y generación de propuesta.
3. Reporte de juicio de evaluación (Sofía Plus): qué resultados le faltan a
   cada ficha.
4. Notificaciones y solicitudes de cambio.
5. Reportes para la coordinación (carga por instructor, ocupación de
   ambientes).

---

## 2. T-18 — Información faltante que hay que pedir

Formato preferido: el Excel o el plano que ya exportan, **sin limpiar**. El
asistente está pensado para leer archivos reales, y los casos raros sirven
para probarlo.

| # | Información | Para qué la usamos | Fuente probable | Responsable / fecha |
|---|---|---|---|---|
| 1 | Listado de **fichas activas** por trimestre: código, programa, jornada, sede, fechas lectiva y productiva, trimestre actual | Catálogo `fichas` y asistente | Sofía Plus / hoja FICHAS de la programación | |
| 2 | Listado de **instructores**: nombre, documento, sigla, especialidades, planta o contratista, horas contratadas, correo | `usuarios`, `usuario_especialidad`, carga semanal | Coordinación / talento humano | |
| 3 | Listado de **ambientes** por sede: número, capacidad, tipo, si es especializado y qué requiere | `ambientes` y requisitos (`03_ambientes_requisitos.sql`) | Coordinación / bienestar | |
| 4 | Cantidad de ambientes en la sede alquilada de la 64 y en las sedes de convenio | `sedes`, `ambientes` | Coordinación | |
| 5 | **Diseño curricular** y **planeación pedagógica** de cada programa: competencias, resultados con su código (ej. `CPL21`), guías y horas por resultado | `competencias_formacion`, `resultados_aprendizaje`, futura tabla de guías | Coordinación académica | |
| 6 | **Reporte de juicio de evaluación** de Sofía Plus, al menos para 2–3 fichas | Saber qué resultados faltan por ficha | Sofía Plus (descarga por ficha) | |
| 7 | Excel de **programación del trimestre** actual completo (macro de la coordinación) | Comparar con lo que genera el sistema | Coordinador | |
| 8 | Documento **indicativo** (programas por coordinación, aprendices por trimestre) | Proyecciones a futuro | Coordinación | |
| 9 | **Calendario académico**: inicio y fin de trimestres, festivos, semanas sin formación | `trimestres`, publicación programada | Centro de formación | |
| 10 | Confirmar si existe **Requisitos Funcionales V4** (en el repo solo están V1–V3) | Línea base de requisitos | Equipo / instructor del proyecto | |

---

## 3. T-19 — Proceso de creación de fichas

### 3.1 Lo que el sistema hace hoy

- Una ficha tiene: `codigoFicha` (7 dígitos, único), programa, trimestre,
  jornada, sede, fechas de inicio y fin de la etapa lectiva y productiva, y
  `faseActual` (trimestre del pénsum en que va, 1 = TRIM I).
- Se crea desde el módulo **Fichas**, o desde el paso 2 del asistente con el
  botón "Crear ficha" cuando el Excel trae una ficha que el sistema no
  conoce. El asistente **nunca** crea fichas por su cuenta.
- La fase actual de una ficha que ya existe solo cambia con el botón
  "Actualizar fase" del asistente: volver a importar el Excel no la
  sincroniza sola.

### 3.2 Preguntas para el coordinador

1. ¿Quién crea la ficha y en qué sistema nace (Sofía Plus, otra
   dependencia)? ¿En qué momento del año?
2. ¿Qué pasos hay desde que se aprueba la oferta hasta que la ficha tiene
   aprendices? (convocatoria, inscripción, selección, matrícula)
3. ¿Qué datos tiene la ficha al crearla y cuáles se completan después? ¿El
   instructor líder se asigna al crearla?
4. ¿La jornada y la sede pueden cambiar durante la formación? ¿Qué pasa con
   los horarios ya programados?
5. ¿Cómo y cuándo avanza la ficha de trimestre? ¿Es automático por
   calendario o lo hace alguien?
6. ¿Qué pasa con una ficha que termina la etapa lectiva? ¿Se sigue
   programando algo durante la etapa productiva?
7. ¿Se fusionan, dividen o cancelan fichas? ¿Qué pasa con sus aprendices y
   horarios?
8. Fichas "cadena de formación": ¿qué las hace distintas además del sábado?
9. ¿Cómo se identifica a qué coordinación pertenece una ficha cuando varias
   coordinaciones comparten programas (ej. Logística programa Mercadeo)?
10. ¿Cómo se asocia un aprendiz a su ficha? ¿Puede estar en más de una
    ficha activa a la vez?

---

## 4. T-20 — Datos, reglas, roles, estados y procesos por aclarar

### 4.1 Roles

Roles en el sistema hoy: **Administrador**, **Coordinador**, **Instructor** y
**Aprendiz**.

- ¿Hay otros actores que deban entrar al sistema (instructor líder de
  ficha, subdirección, bienestar, apoyo administrativo)?
- ¿Un coordinador puede ver y editar fichas de otra coordinación? ¿Puede
  usar ambientes de otra coordinación sin pedir permiso?
- ¿Quién aprueba a un coordinador nuevo? ¿El Administrador es una persona
  del centro o del equipo técnico?
- ¿El instructor solo consulta, o también propone cambios a su horario?

### 4.2 Estados

| Entidad | Estados actuales en SIHS | Pregunta |
|---|---|---|
| Usuario | `activo`, `inactivo` | ¿Hace falta "vacante" para instructores aún no contratados (el placeholder "instructor logística 7")? ¿Y "en vacaciones" o "con licencia"? |
| Trimestre | `planeado`, `activo`, `finalizado` | ¿Se puede editar la programación de un trimestre activo? ¿Y la de uno finalizado? |
| Horario | borrador / publicado (con publicación programada) | ¿Hace falta un paso de revisión o aprobación antes de publicar? ¿Se avisa a los aprendices de cada cambio? |
| Ficha | sin estado propio (solo fechas y fase) | ¿Hacen falta estados como "en formación", "productiva", "terminada" o "cancelada"? |
| Solicitud de cambio | pendiente / aprobada / rechazada | ¿Quién más puede aprobar? ¿Hay plazo de respuesta? |

### 4.3 Reglas de negocio abiertas

- Criterio real detrás de "mañana no se programa con tarde" para algunos
  instructores: ¿es tiempo de traslado entre sedes? ¿Se configura por
  instructor o por par de sedes?
- Especialidad **obligatoria** frente a **preferente**: ¿un instructor puede
  dictar un resultado que no es de su especialidad si no hay nadie más?
- Máximo de horas por día o por semana para un instructor contratista.
- ¿Desde qué porcentaje de la ficha se considera "visto" un resultado? (Se
  habló de 80–90 %).
- ¿Qué ambientes especializados existen y qué fichas o resultados los
  necesitan?
- ¿Hay descansos fijos dentro de cada jornada?
- ¿Cómo se manejan los festivos y las semanas de receso?

### 4.4 Procesos

- Flujo completo de un trimestre: cuándo empieza la planeación, cuándo
  debe quedar publicada y cuántas veces se ajusta después.
- ¿Cómo se comunica hoy un cambio de horario a instructores y aprendices?
- ¿Qué reportes pide la subdirección o el centro sobre la programación?

---

## 5. T-21 — El asistente de carga de horarios

### 5.1 Qué es

Pantalla **Asistente de programación** (`frontend/src/pages/AsistenteHorarios.tsx`).
Es distinta del constructor manual (`NuevoHorario.tsx`), que arma un horario
a la vez. El asistente parte del Excel de planeación del trimestre y arma
una propuesta completa. **Nada se guarda hasta que el coordinador confirma en
el paso 4.** Solo lo pueden usar Coordinador y Administrador
(`require_puede_programar`).

### 5.2 Los 4 pasos

| Paso | Pantalla | Endpoint | Qué hace |
|---|---|---|---|
| 1 | Subir archivo | `POST /horarios/asistente/importar` | Recibe el Excel principal y, si se quiere, uno complementario. Elige la hoja útil (no siempre la primera), detecta la fila de encabezado y usa IA para clasificar las columnas (ficha, programa, jornada, instructor, fechas, fase). Las columnas con confianza menor a 0,7 no se usan. |
| 2 | Así lo entendimos | (solo revisión) | Muestra cada fila: si la ficha existe en SIHS, programa, jornada, instructor y advertencias. Si la ficha no existe, ofrece "Crear ficha". Si la fase del Excel no coincide con la de la BD, ofrece "Actualizar fase". El archivo complementario se cruza por número de ficha para traer nivel, coordinación y fechas. |
| 3 | Así quedaría el horario | `POST /horarios/asistente/generar-propuesta` + `POST /horarios/validar` por bloque | El generador (OR-Tools, sin IA) arma bloques semanales con los resultados de aprendizaje pendientes de cada ficha, los instructores activos y los ambientes disponibles. Dice qué fichas quedaron fuera y por qué: sin currículo cargado, ya programada o sin ambiente. Cada bloque se valida contra cruces reales. |
| 4 | Confirmar y guardar | `POST /horarios/` por bloque | Guarda cada bloque con la misma validación de cruces del constructor manual y deja registro en auditoría. |

La barra "¿En qué te ayudo?" (`POST /horarios/asistente/preguntar`) responde
preguntas sobre un bloque o un conflicto. No lee ni escribe en la base de
datos.

### 5.3 Cómo se integra con el resto

- Usa los catálogos que ya existen: `fichas`, `programas`, `trimestres`,
  `usuarios` (instructores activos con tipo de contrato), `ambientes`,
  `competencias_formacion` y `resultados_aprendizaje`. Si el currículo de un
  programa no está cargado, sus fichas no se pueden programar con el
  asistente.
- Las reglas duras (cruces) nunca las decide la IA: la IA solo clasifica
  columnas y responde preguntas. Las reglas las aplican el generador y
  `HorarioService`.
- Lo que guarda el paso 4 aparece en el constructor manual, en Horarios y,
  cuando se publica, en las vistas de aprendiz e instructor.
- Código principal:
  `backend/app/services/asistente_horario_service.py`,
  `backend/app/scheduling/generator.py`,
  `backend/app/schemas/asistente_horario.py`,
  `backend/app/api/v1/horarios.py`,
  `frontend/src/components/horario/GridAsistente.tsx`.
  Pruebas: `backend/tests/test_asistente_horario_service.py` y
  `backend/tests/test_asistente_horario_endpoints.py`.
- Para preparar una demo con datos limpios:
  `backend/scripts/reset_demo_asistente.py`.

### 5.4 Limitaciones conocidas que hay que validar con el coordinador

- Cada resultado pendiente se programa como **un solo bloque semanal** con un
  patrón de días fijo. Todavía no reparte un resultado en varios bloques
  sueltos de la semana.
- Las franjas del generador son un catálogo simplificado (3 por jornada) y
  no calcan la plantilla institucional de 2 franjas por jornada. Con 2
  franjas, cualquier fase con más de 10 resultados pendientes queda sin
  solución.
- Solo programa de lunes a viernes; el sábado no entra al generador.
- No usa todavía el reporte de juicio de evaluación: considera "pendiente"
  todo resultado de la fase sin horario, no lo que de verdad le falta a la
  ficha.

**Preguntas para la reunión:** ¿el asistente cubre el flujo real? ¿Qué
columnas trae siempre su Excel? ¿Prefiere que la propuesta respete la
plantilla de 2 franjas aunque queden resultados sin programar? ¿Necesita
programar sábados desde el asistente?

### 5.5 Ejercicio para el equipo antes de la reunión

1. Correr `backend/scripts/reset_demo_asistente.py` en un entorno local.
2. Subir `LIDERES DE FICHA 2026_pruebas.xlsx` como principal y la
   programación CGMLTI como complementario. Estos archivos no están en el
   repo: pedirlos a quien los tenga en el equipo o usar los del punto 7
   de §2.
3. Recorrer los 4 pasos y anotar cualquier mensaje confuso para el
   coordinador.
4. Llevar la demo lista para el punto 4 de la agenda.

---

## 6. Acta de la reunión (llenar el día de la reunión)

- **Fecha:**
- **Asistentes:**
- **Requerimientos confirmados:**
- **Requerimientos a ajustar:**
- **Requerimientos descartados:**
- **Prioridades acordadas (en orden):**
- **Compromisos de entrega de información** (qué, quién, para cuándo):
- **Respuestas sobre creación de fichas (§3.2):**
- **Respuestas sobre roles, estados y reglas (§4):**
- **Observaciones sobre el asistente (§5):**
- **Próxima reunión:**
