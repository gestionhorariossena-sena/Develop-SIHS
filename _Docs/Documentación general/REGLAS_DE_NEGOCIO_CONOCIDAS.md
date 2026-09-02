# Reglas de negocio conocidas — y lo que todavía falta confirmar

Este documento junta lo que ya sabemos del dominio real (sacado de las
entrevistas con los coordinadores de Teleinformática y de Logística, y del
resto de `_Docs/`) para no tener que releer las transcripciones cada vez, y
deja aparte, sin inventar nada, lo que sigue pendiente de confirmar con la
coordinación antes de programarlo. Última actualización: 2026-09-01.

**2026-09-01:** análisis de `nuevo_alcance/PROGRAMACIÓN CGMLTI I TRM
2026.xlsx` (macro Excel real de la coordinación) confirmó cómo detecta
cruces hoy: formato condicional de Excel (`duplicateValues`) por
columna, donde cada columna es un bloque fijo (día × jornada ×
sub-bloque) — equivale a `UNIQUE(instructor, día, jornada)` /
`UNIQUE(ambiente, día, jornada)`, no a un solapamiento de horas
arbitrario. Esto **confirma**, no contradice, la consulta de
solapamiento de abajo (es más general y sigue siendo correcta). Detalle
completo, gaps de esquema encontrados (sede/fechas en `fichas`, sigla
en `usuarios`) y el backlog resultante: ver
`PLAN_INTEGRACION_LOGICA_Y_BD.md` §7.

Fuentes:
- `_Docs/Elicitacion/Entrevistas/Entrevista 1 transcrita - Coordinador de
  teleinformática.md`
- `_Docs/Elicitacion/Entrevistas/Entrevista 1 transcrita - Coordinador de
  logística.md` (transcripción por Whisper sin diarización real — la
  separación entrevistador/coordinador es una reconstrucción por contexto)

Todo lo marcado "❓" es una pregunta abierta real, no una suposición — no
programar esas reglas hasta confirmarlas. **Importante:** las dos
coordinaciones trabajan distinto en varios puntos (ver "Diferencias entre
coordinaciones" al final) — cualquier regla que se codifique como válida
para *todo el centro* debe primero confirmarse que aplica a ambas, no solo
a la que la mencionó.

## Cómo se resuelven los cruces hoy (manual)

Ambos coordinadores arman cada trimestre una planeación en Excel
controlando a la vez **ficha, instructor, jornada y ambiente**. La
entrevista de Logística deja explícitos los **tres tipos de cruce a
detectar** — el de ficha ya estaba anotado como pendiente, ahora queda
confirmado con sus propias palabras ("uno de los grandes problemas... que
te programé dos fichas el mismo día a la misma hora, o dos instructores
para la misma ficha a la misma hora, o un ambiente para dos fichas
diferentes"):

1. Misma **ficha**, mismo día/hora, dos programaciones distintas.
2. Mismo **instructor**, dos fichas distintas, mismo día/hora.
3. Mismo **ambiente**, dos fichas distintas, mismo día/hora.

Hay un **cuarto tipo de "cruce"** que no es de horario sino de contenido,
mencionado solo por Logística pero aplicable a cualquier coordinación:
**un mismo resultado de aprendizaje no puede programarse dos veces para
la misma ficha** (en su matriz Excel lo marca con un punto rojo). Es una
validación distinta a las tres de arriba — no compara horas, compara que
`(idFicha, idResultado)` no se repita en `horarios`.

- Entre bloques que cruzan de ambiente/sede hay un margen de traslado que
  hoy se negocia a mano con los instructores (ej. salir 11:30, recibir a
  la 1 o 2 pm en el otro sitio) — no es una regla dura del sistema, es
  coordinación humana.
- ⚠️ **Corrección importante:** antes se anotó acá que "un instructor
  programado en la mañana no se programa en la tarde" como si fuera regla
  general (Teleinformática). La entrevista de Logística la contradice
  directamente: describe un instructor programado *el martes en la
  mañana en Zona Franca y el martes en la tarde en Fontibón* — mismo día,
  dos sedes, mañana y tarde. **Esto confirma que la restricción NO es una
  regla global del sistema** — es una condición particular de algunos
  instructores/situaciones (probablemente por distancia real entre sedes,
  no por jornada en sí). No codificar "mañana no se programa con tarde"
  como regla dura.
- ❓ **¿Cuál es el criterio real detrás de esa restricción?** Probablemente
  algo como "tiempo mínimo de traslado entre sede A y sede B", configurable
  por par de sedes, no una regla de jornada. Falta confirmarlo.

**Lógica ya definida para automatizar la detección** (ver
`database/02_datos_prueba.sql` líneas 215-225, y el `EXCLUDE` constraint
comentado en `database/01_creacion.sql`):

```sql
SELECT * FROM horarios
WHERE ("idInstructor" = :idInstructor OR "idAmbiente" = :idAmbiente)
  AND "horaInicio" < :horaFinNueva
  AND "horaFin"    > :horaInicioNueva
  AND "idHorario" IN (
      SELECT "idHorario" FROM horario_dia
      WHERE "idDia" = ANY(:diasNuevos)
  );
```

**Pendiente antes de dar esto por completo:** esa consulta de ejemplo solo
cubre cruce de instructor y de ambiente — falta sumar el cruce por
**ficha** (confirmado arriba por Logística, tipo 1) y la validación
separada de **resultado repetido por ficha** (tipo 4, no es un rango de
horas, es una comparación de existencia). El `EXCLUDE USING gist` de
Postgres sigue sin poder activarse tal como está el esquema hoy: exige que
el día viva en la misma tabla `horarios` en vez de en `horario_dia`
aparte (una tabla puente M:N) — hay que decidir si vale la pena ese
cambio de esquema, o si la validación a nivel de `service` basta. Ver
`PLAN_INTEGRACION_LOGICA_Y_BD.md` para la propuesta concreta.

## Instructores y especialidades

- Cada instructor de Teleinformática maneja entre **1 y 3 temáticas
  máximo**. En Logística es distinto (ver diferencias al final): ahí
  **70-80% de los resultados los puede dictar cualquier instructor** del
  perfil general, y solo ~15-20% (comercio exterior) requiere
  especialización — y esa especialización es asimétrica: un instructor de
  comercio exterior sí puede dictar logística general, pero no al revés.
  Ya modelado con `usuario_especialidad` (N:N), pero el modelo no
  distingue "especialidad obligatoria" de "especialidad preferente" —
  hoy todas pesan igual.
- Instructores de **planta** (fijos, no contratistas) deben cumplir **32
  horas/semana** por resolución institucional, y por eso se programan
  **primero** — suelen quedar en fichas de trimestres avanzados (6°-7°).
  No hay ninguna tabla/columna hoy que distinga instructor de planta vs.
  contratista, ni sus horas contratadas.
- Cuando un instructor todavía no está contratado, se usa un
  **placeholder** en la planeación (ej. "instructor logística 7" = cupo
  vacante N° 7 de esa coordinación) que luego se renombra al instructor
  real una vez contratado, y el cambio se refleja automáticamente en todo
  lo ya programado con ese placeholder. Es un patrón a replicar si se
  automatiza la asignación (mejor un `idInstructor` nullable con
  "vacante" que texto libre).
- Ambas coordinaciones referencian instructores por **sigla/iniciales**
  en sus matrices (ej. "UA", "LM", "DC" = David Camelo) — no es un campo
  formal en ningún sistema, es una convención interna de cada
  coordinador.
- Los "resultados de aprendizaje" van codificados con un prefijo de
  programa + número (ej. `CPL21` = Coordinación de Procesos Logísticos,
  resultado 21). El código se asigna **manualmente** en una matriz maestra
  aparte que junta los resultados de *todos* los programas del centro —
  no hay generación automática, y cada programa nuevo hay que
  "alimentarla a mano". Ya modelado en `competencias_formacion` /
  `resultados_aprendizaje`, pero falta el campo de código con ese formato
  y la relación con **guías** (ver sección siguiente).
- ❓ **Listado real de instructores** (nombre, especialidad(es), sigla,
  planta/contratista, horas contratadas) — no está en ningún documento
  del repo todavía. Ninguna coordinación integra Sofía Plus en vivo, pero
  ambas pueden exportar reportes/archivos planos — hay que pedirlos
  formalmente.

## Jerarquía curricular: de dónde sale un "resultado" (nuevo, de Logística)

Esta jerarquía no estaba documentada antes y **no calza del todo con el
esquema actual** — ver `PLAN_INTEGRACION_LOGICA_Y_BD.md` para la propuesta
de ajuste:

```
Diseño curricular (documento base, ~85 páginas, cambia cada 5-10 años,
  requiere trámite hasta Ministerio de Educación para modificarse)
  └─ Competencias
       └─ Resultados de aprendizaje  (código único, ej. CPL21)
Proyecto formativo (traduce el diseño curricular en cómo se enseña)
  └─ Planeación pedagógica (línea de tiempo: qué guía se ve en qué trimestre;
       es pública para los aprendices, no cambia salvo actualización)
       └─ Guías  (ej. "guía 1", "guía 10" — un programa puede tener ~18)
            └─ uno o más Resultados de aprendizaje, cada uno con una
               cantidad de HORAS asignada (ej. "40 horas")
```

Puntos clave:
- Un **resultado** pertenece a una **competencia** (ya modelado) pero
  también a una **guía** (no modelado) — hoy `resultados_aprendizaje` no
  tiene ni `idGuia` ni `horas`.
- Una **guía** se ubica en un **trimestre** específico dentro de la
  planeación pedagógica de un programa (no modelado — no existe tabla
  `guias`).
- El **reporte de juicio de evaluación** (se descarga de Sofía Plus, por
  ficha) dice qué aprendices ya tienen cada resultado evaluado/aprobado.
  Cruzar esto contra lo programado es lo que hoy hacen a mano
  ("Excel sobre Excel sobre Excel") y es la pieza central de lo que el
  coordinador de Logística describió como el sistema ideal (ver más
  abajo).
- Regla de negocio real para decidir si "falta programar" un resultado:
  **no se aprueba en bloque por 1-2 casos excepcionales** (aplazados,
  en excepción) — si el 80-90%+ de la ficha ya vio el resultado, se
  considera visto para todos; si son pocos los pendientes, se resuelven
  caso por caso, no se reprograma la ficha completa.
- Orden de programación real que usan los coordinadores (estrategia, no
  regla dura): programan **del último trimestre hacia el primero**
  (para garantizar que los que se gradúan no queden con resultados
  pendientes), y dentro de cada trimestre, **noche antes que día** (la
  noche tiene menos margen de maniobra: 5 noches + sábado, sin tardes
  libres para compensar).

## Ambientes

- Unos **~100 ambientes en todo el centro**: sede principal (Cl 52, ~50
  ambientes, de los cuales ~23 son de Teleinformática y ~10 de
  Logística), sede Fontibón (~10 ambientes, 2 de Teleinformática), y un
  edificio adicional para el centro de servicios financieros.
- Cada coordinación tiene ambientes **preasignados por tradición** (ej.
  Logística tiene "todo el tercer piso" desde hace ~15 años) pero esto es
  **convención informal, no una restricción del sistema** — las
  coordinaciones se prestan ambientes entre sí constantemente
  ("tengo el ambiente desocupado, utilícenlo") negociando directo entre
  coordinadores. **El sistema no debe modelar "dueño" de un ambiente como
  restricción dura** — cualquier ambiente puede terminar usado por
  cualquier coordinación; lo único que importa para la detección de
  cruces es que `idAmbiente` es una FK global en `horarios` (ya es así,
  no requiere cambio).
- Cuando la capacidad del centro no alcanza (más fichas que ambientes
  disponibles), recurren a **sedes externas por convenio** (ej. "Zona
  Franca") o alquiladas (sede en la "64") — esto ya encaja con el ENUM
  `tipo_sede` existente (`'alterna'` es literalmente el término que usó
  el coordinador: "sedes alternas").
- Algunos ambientes son **especializados** (talleres de mantenimiento con
  herramientas fijas, salas con equipos específicos como animación 3D) —
  no cualquier ficha puede usarlos aunque estén libres. No hay hoy ningún
  campo en `ambientes` para marcar esto (ver `database/migrations/
  03_ambientes_requisitos.sql`, pensada justo para esto pero sin datos
  todavía).
- En Teleinformática los ambientes especializados se programan "como
  taller" — los aprendices no están el 100% del tiempo en el ambiente
  asignado. En Logística, en cambio, "en cualquier ambiente se puede
  hacer la formación" — otra diferencia real entre coordinaciones.
- Se identifican por número (ej. "509", "303", "402", "304", "307").
- ❓ **Listado real de ambientes** por sede/coordinación, con código y
  requisitos especiales — sigue sin conseguirse.
- ❓ **Cuántos ambientes hay en la sede alquilada de la 64** — ni el
  coordinador de Logística lo tenía a la mano en la entrevista.

## Fichas y programas

- Una ficha SENA es nominalmente de **30 personas**, pero se abren fichas
  adicionales cuando la demanda/meta institucional lo exige.
- Un coordinador de Teleinformática maneja ~75 fichas; el de Logística
  programa además las fichas de **Mercadeo** (varias coordinaciones
  comparten quién programa qué).
- Formato de código de ficha visto en ambas entrevistas/documentación:
  7 dígitos (`3228973`, `3068356`).
- 14 programas en Teleinformática: 8 tecnólogos (Análisis y Desarrollo de
  Software, Gestión de Redes de Datos, Implementación de Infraestructura,
  Desarrollo de Videojuegos, Animación 3D, Producción de Multimedia,
  Provisión de Medios Audiovisuales, Provisión de Sonido) + 6 técnicos
  (Programación de Software, Mantenimiento de Equipos, Sistemas
  Teleinformáticos, Multimedia en Producción de Audiovisuales, Seguridad
  Digital, y uno más sin confirmar en la transcripción).
- Logística: programa "Tecnología en Coordinación de Procesos Logísticos"
  con **18 guías** definidas y **91 resultados de aprendizaje** en total,
  distribuidos en 7 trimestres.
- Existen "fichas cadena de formación" (Teleinformática): arrancan con
  conocimientos previos, van hasta el sábado (jornada especial, solo
  mañana).
- Etapa productiva: los aprendices salen a práctica ~20 de diciembre; la
  fase lectiva vuelve en febrero (coincide con el reintegro de
  instructores contratados).
- El documento **"indicativo"** (distinto de la planeación pedagógica)
  dice qué programa dicta cada coordinación y cuántos aprendices entran
  por trimestre — se usa para **contratación**, no para programar
  horarios directamente, pero podría alimentar proyecciones futuras.
- ❓ **Listado real de fichas activas** por trimestre (código, programa,
  jornada) — no está en el repo todavía.

## Horarios (estructura de bloques)

- Jornada mañana y tarde: **bloques de 6 horas** cada una (divididos en 2
  sub-bloques de 3h).
- Jornada noche: **bloques de 4 horas** (2 sub-bloques de 2h) — el
  coordinador de Teleinformática explicó que la jornada nocturna necesita
  más autonomía, por eso son más cortos que en el papel (6h nominales
  bajadas a 4h reales).
- Esto **ya coincide exactamente** con el `BLOQUES` definido en
  `frontend/src/pages/horario/tipos.ts`.
- Semana ≈ **36 horas** — también ya es el valor por defecto en el
  formulario de `NuevoHorario.tsx`.
- Sábado: jornada especial, solo mañana, para fichas "cadena de
  formación" (Teleinformática) — Logística también programa sábado para
  fichas nocturnas ("son cinco noches y el sábado").

## La visión "ideal" del coordinador de Logística (aspiracional, NO es el MVP)

Vale la pena dejarla escrita porque es la mejor descripción que tenemos de
hacia dónde apunta el proyecto a largo plazo, pero es explícitamente **más
allá del alcance actual** (editor manual + detección de cruces):

> "Que yo no necesite ni saber el programa, solo la ficha; que a partir de
> la ficha me identifique qué resultados le faltan, de qué guías son, que
> yo pueda editar eso, y que me genere una propuesta de horario [...] y
> que me avise, por ejemplo, 'le faltan instructores aquí'."

Es decir: cruzar automáticamente **planeación pedagógica + reporte de
juicio de evaluación (Sofía Plus) + perfil de instructor**, sugerir qué
resultados le faltan a una ficha, proponer instructor y horario, y dejar
que el coordinador solo ajuste. **No construir esto todavía** — depende
de tener primero el módulo `horarios` real funcionando con detección de
cruces manual/asistida, y de resolver cómo se importa el reporte de
Sofía Plus (no hay integración en vivo, sería import de archivo).

## Diferencias confirmadas entre coordinaciones (ojo al generalizar)

| Punto | Teleinformática | Logística |
|---|---|---|
| Especialización de instructores | Alta — 1 a 3 temáticas fijas por instructor | Baja — 70-80% de resultados los dicta cualquier instructor; solo comercio exterior (~15-20%) es especializado, y de forma asimétrica |
| Ambientes | Especializados (talleres, equipos específicos), no 100% de tiempo ocupados | Cualquier ambiente sirve para cualquier ficha |
| Restricción instructor mañana/tarde | Mencionada como regla | Contraejemplo real (mismo día, dos sedes, mañana y tarde) — **no es regla global**, ver corrección arriba |
| Orden de programación | No detallado | Último trimestre → primero; noche antes que día |

**Conclusión práctica:** cualquier regla "dura" que se valide en el
backend debe poder configurarse por coordinación/instructor, no asumir
que todas las coordinaciones funcionan igual — el `EXCLUDE`/validación de
cruces (instructor, ambiente, ficha, resultado repetido) sí es universal;
las reglas de restricción de horario por instructor (mañana/tarde,
sede única) no lo son.

## Otras preguntas abiertas (no bloquean código, pero sí decisiones)

Ver `_Docs/Documentación general/SECCION_ESTUDIANTES.md` para el detalle
completo de estas — se repiten acá solo como índice:

- ❓ ¿El aprendiz inicia sesión con Supabase Auth o es consulta pública por
  código de ficha?
- ❓ "Ingresar su ficha" ¿crea la ficha o solo la vincula a una que ya
  existe?
- ❓ ¿Un aprendiz pertenece a una sola ficha activa a la vez, o puede tener
  varias?
- ❓ Existencia real de `Requisitos Funcionales V4` — el roadmap del
  backend lo referencia como la versión vigente, pero en el repo solo
  están V1-V3 (`_Docs/Informes de requisitos/`). Confirmar si existe y
  conseguirlo.

## Qué no depende de estas respuestas (se puede avanzar ya)

- El CRUD de `coordinaciones` → `programas` → `trimestres` → `fichas`: la
  estructura de esas tablas ya está definida en `01_creacion.sql` y no
  cambia según ninguna de las preguntas de arriba.
- Las vistas de catálogo (Ambientes, Instructores, Fichas) del frontend
  pueden construirse ya con datos de ejemplo — ver
  `frontend/OBJETIVO_Y_SERVICIOS_FALTANTES.md` para el estado de cada una.
- Ver `PLAN_INTEGRACION_LOGICA_Y_BD.md` para el plan concreto de qué
  cambiar en el esquema, en qué orden, y qué formato de datos pedir a la
  coordinación para poblar todo esto de verdad.
