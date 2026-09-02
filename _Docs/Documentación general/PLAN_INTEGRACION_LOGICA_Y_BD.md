# Plan para integrar lo aprendido en lógica de negocio y base de datos

Este documento es el puente entre `REGLAS_DE_NEGOCIO_CONOCIDAS.md` (qué
sabemos del dominio real) y el código: qué cambiar en el esquema, en qué
orden programarlo, y **qué formato de datos pedirle a la coordinación**
para que, cuando lleguen, se puedan cargar directo sin reinterpretarlos.
Última actualización: 2026-08-26.

> **Estado (2026-08-26, tarde):** las secciones 1-3 ya están aplicadas —
> esquema, backend (8 módulos nuevos: coordinaciones, programas,
> trimestres, fichas, guias, competencias_formacion,
> resultados_aprendizaje, horarios) y un dataset sintético pequeño
> (`database/02_datos_prueba.sql`, sección "AMPLIACIÓN 2026-08-26"), todo
> corrido contra el Supabase real del equipo y probado en vivo: la
> detección de cruces del §3 rechaza correctamente instructor/ambiente/
> ficha duplicados y resultado repetido. De paso se descubrió y corrigió
> que `database/migrations/03_ambientes_requisitos.sql` nunca se había
> aplicado a la base real — ya se aplicó. Lo que sigue pendiente: la
> sección 5 (migrar `NuevoHorario.tsx` de `horarios_guardados` al módulo
> `horarios` real) y reemplazar el dataset sintético cuando lleguen datos
> reales (sección 4).

## 1. Qué ya no requiere información nueva (se puede programar ya)

Estructura definida en `01_creacion.sql`, sin cambios pendientes, sin
depender de ninguna respuesta de la coordinación:

- `coordinaciones` → `programas` → `trimestres` → `fichas` →
  `ficha_usuario` (CRUD completo, capa por capa, mismo patrón que
  `especialidades`/`sedes`/`ambientes`).
- Frontend: conectar `Ambientes.tsx`, `Instructores.tsx`, `Fichas.tsx` a
  esos endpoints en cuanto existan (hoy son datos de ejemplo a propósito).

Esto es el paso 3 del roadmap en `backend/OBJETIVO_Y_SERVICIOS_FALTANTES.md`
y no cambia con nada de lo que sigue.

## 2. Cambios de esquema propuestos (pendientes de aplicar)

### 2.1 Tabla `guias` (nueva)

La entrevista de Logística reveló una capa que el esquema actual no tiene:
un **resultado de aprendizaje** pertenece a una **guía**, y la guía (no el
resultado directamente) es la que se ubica en un trimestre según la
planeación pedagógica. Hoy `resultados_aprendizaje` solo enlaza a
`competencias_formacion` → `programa`, sin guía ni trimestre ni horas.

```sql
CREATE TABLE guias (
    "idGuia"       SERIAL PRIMARY KEY,
    "codigo"       VARCHAR(50),              -- ej. "Guía 10"
    "idPrograma"   INTEGER NOT NULL REFERENCES programas("idPrograma"),
    "idTrimestre"  INTEGER NOT NULL REFERENCES trimestres("idTrimestre")
);

ALTER TABLE resultados_aprendizaje
    ADD COLUMN "idGuia" INTEGER REFERENCES guias("idGuia"),
    ADD COLUMN "horasAsignadas" INTEGER;   -- ej. 40 (horas totales del resultado)
```

`idGuia` queda **nullable** a propósito: no todos los programas tienen
esta capa documentada todavía, y forzar `NOT NULL` bloquearía sembrar
competencias/resultados de programas que aún no tengan sus guías
digitalizadas.

### 2.2 Distinguir instructor de planta vs. contratista (nuevo)

Necesario para la regla "planta se programa primero, debe llegar a 32h/semana":

```sql
ALTER TABLE usuarios
    ADD COLUMN "tipoContrato" VARCHAR(20),      -- 'planta' | 'contratista', nullable
    ADD COLUMN "horasContratadasSemana" INTEGER; -- nullable, solo aplica a instructores
```

Alternativa más limpia si el equipo prefiere no tocar `usuarios`
directamente: una tabla `instructor_perfil` 1:1 con `usuarios` — a decidir
en equipo, no es una diferencia grande de esfuerzo.

### 2.3 Instructor "vacante" (placeholder) — decisión de diseño, no de esquema

Logística usa un placeholder tipo "instructor logística 7" cuando el cupo
todavía no está contratado, y lo renombra después sin perder lo ya
programado. Con el esquema actual (`horarios.idInstructor` es `NOT NULL
UUID REFERENCES usuarios`), esto se resuelve **sin cambiar el esquema**:
crear una fila real en `usuarios` para cada "vacante" (ej. nombre
`"Vacante Logística #7"`, sin cuenta de Supabase Auth asociada — o con una
cuenta placeholder) y reasignar `idInstructor` cuando se contrate a
alguien real. Documentado acá para que quien programe `horarios` no
reinvente esto — no hace falta una tabla nueva.

### 2.4 Cruce por resultado repetido — no es esquema, es validación

No requiere cambio de tabla. Antes de insertar en `horarios`, además de
las validaciones de rango de horas (instructor/ambiente/ficha), agregar:

```sql
SELECT 1 FROM horarios
WHERE "idFicha" = :idFicha AND "idResultado" = :idResultado;
-- si existe, es cruce de tipo "resultado repetido" — bloquear o alertar
```

### 2.5 `EXCLUDE` constraint de Postgres — sigue sin activarse

Ver `REGLAS_DE_NEGOCIO_CONOCIDAS.md`: exige que el día viva en `horarios`
en vez de en `horario_dia` aparte. **Decisión pendiente para el equipo**:
o se cambia el esquema (colapsar `horario_dia` en una columna
`"diasSemana" INTEGER[]` o similar sobre `horarios`, perdiendo la relación
M:N normalizada) o la detección de cruces queda solo a nivel de
`service` (ya cubre los 4 tipos si se implementa el punto 2.4). Mientras
no se decida, **no bloquea nada** — la validación en `service` es
suficiente para lanzar a producción.

## 3. Validación de cruces a implementar en `horarios/service.py`

Los 4 tipos confirmados entre las dos entrevistas, en el orden en que
conviene chequearlos (más barato primero):

1. **Resultado repetido en la misma ficha** (punto 2.4) — comparación de
   existencia, sin rangos de fecha, la más barata.
2. **Cruce de ficha** — misma ficha, rango de horas se solapa, mismo día.
3. **Cruce de instructor** — mismo instructor, rango se solapa, mismo día.
4. **Cruce de ambiente** — mismo ambiente, rango se solapa, mismo día.

Las reglas de restricción por instructor (mañana/tarde, sede única) **NO**
se implementan como regla global — ver la corrección en
`REGLAS_DE_NEGOCIO_CONOCIDAS.md`. Si se llegan a implementar, es como una
restricción configurable por instructor (tabla nueva o columna flexible),
no como parte fija del cruce.

## 4. Formato de datos que se necesita de la coordinación

Para que lo que traigas se pueda sembrar directo (via el patrón ya usado
en `database/02_datos_prueba.sql`), idealmente en CSV o Excel con estas
columnas — no hace falta que vengan perfectos, pero si vienen así se
ahorra una vuelta de "traducir" el archivo:

| Catálogo | Columnas mínimas |
|---|---|
| `coordinaciones` | nombre |
| `programas` | código oficial SENA, nombre, nivel (Técnico/Tecnólogo), coordinación |
| `trimestres` | nombre/número, fecha inicio, fecha fin |
| `fichas` | código (7 dígitos), programa, trimestre, jornada, n° aprendices |
| `sedes` | nombre, dirección, tipo (principal/secundaria/alterna) |
| `ambientes` | código/nombre, sede, ¿especializado? (sí/no + para qué), ¿de qué coordinación es "por tradición"? (informativo, no restrictivo) |
| `especialidades` | nombre, descripción |
| `instructores` (`usuarios` + `usuario_especialidad`) | nombre, correo, sigla/iniciales, especialidad(es), planta o contratista, horas contratadas/semana |
| `competencias_formacion` | código, descripción, programa |
| `guias` | código ("Guía 10"), programa, trimestre |
| `resultados_aprendizaje` | código (ej. `CPL21`), descripción, competencia, guía, horas asignadas |

Si lo único disponible es el "reporte de juicio de evaluación" exportado
de Sofía Plus tal cual, también sirve — se puede escribir un script de
importación que lo parsee, pero conviene primero ver una muestra real del
formato de ese export antes de comprometerse a un parser específico.

## 5. Migrar de `horarios_guardados` (JSONB) al `horarios` real

`horarios_guardados` es un puente deliberadamente temporal (ver su propio
comentario en `01_creacion.sql`). Una vez existan `fichas`, `ambientes`,
`instructores` y `resultados_aprendizaje` como filas reales:

1. El editor (`NuevoHorario.tsx` / `useHorarioState`) cambia sus campos de
   texto libre (`instructor`, `ficha`, `ambiente` como `string`) por
   selects que traen las filas reales vía `apiGet` (mismo patrón que ya
   usa el resto del frontend).
2. `POST /horarios-guardados` se reemplaza por `POST /horarios`
   (`idInstructor`, `idAmbiente`, `idFicha`, `idResultado` reales) con la
   validación de cruces del punto 3.
3. Las filas viejas en `horarios_guardados` se pueden dejar como
   historial de "borradores" — no hace falta migrarlas fila por fila, ya
   cumplieron su función de mostrar algo funcional mientras no existían
   los catálogos.
4. `HistorialHorarios.tsx` puede seguir apuntando a
   `GET /horarios-guardados` en paralelo, o migrarse a `GET /horarios`
   filtrado por usuario — a decidir cuando se llegue a este punto, no es
   una decisión urgente ahora.

## 6. Orden recomendado de ahora en adelante

1. Estructura académica (`coordinaciones` → `programas` → `trimestres` →
   `fichas`) — sección 1, ya desbloqueado.
2. Aplicar los cambios de esquema de la sección 2 (revisados en equipo).
3. Sembrar los catálogos con los datos reales que traigas (formato de la
   sección 4).
4. Módulo `competencias_formacion` → `resultados_aprendizaje` →
   `actividades_aprendizaje` → `guias`, con datos reales ya sembrados.
5. Módulo `horarios` real con la validación de cruces de la sección 3.
6. Migración del editor según la sección 5.

## 7. Nuevo alcance (2026-09-01) — datos reales de la coordinación,
## cruces con advertencia, y vistas de relacionados

Sesión de trabajo a partir de `nuevo_alcance/` (carpeta que la
coordinación de gestión compartió con tres archivos: transcripción de
entrevista al coordinador, `PROGRAMACIÓN CGMLTI I TRM 2026.xlsx` — la
macro Excel real que hoy usan para programar — y `Planeación Oferta
Abierta 2025.xlsx`, formato curricular GFPI-F-134). Análisis completo
en el historial de esa sesión; acá solo las conclusiones y el backlog
resultante, para que cualquier sesión nueva (con o sin ese historial)
pueda seguir desde acá.

### 7.1 Conclusión del análisis del Excel real

El modelo `Horario` que ya existe (`idFicha`+`idInstructor`+
`idAmbiente`+`idResultado`+`idDia`+`idJornada`) cubre conceptualmente
el 100% del dominio de la macro Excel real — no hace falta rediseñar
el esquema de horarios. Hallazgo importante: en la práctica, el
Excel detecta cruces a nivel de **bloque fijo** (día × jornada ×
sub-bloque), no de solapamiento de horas arbitrario — equivale a un
`UNIQUE(instructor, día, jornada)` / `UNIQUE(ambiente, día, jornada)`.
Esto confirma (no contradice) la validación por rango de horas que ya
implementa `HorarioService._detectar_cruces` — es más general y sigue
siendo correcta.

**Gaps reales encontrados** (cosas que el Excel real usa y que el
esquema/docs actuales no cubrían todavía):
- `fichas` necesita `idSede`, fechas de fase lectiva (inicio/fin) y de
  etapa productiva (inicio/fin) — hoy `fichas` solo tiene
  `idFicha`/`codigoFicha`/`idPrograma`/`idTrimestre`.
- `usuarios` necesita un campo `sigla` (ej. "DC", "LM") — confirma un
  ❓ que ya estaba abierto en `REGLAS_DE_NEGOCIO_CONOCIDAS.md`.
- El Excel `Planeación Oferta Abierta 2025` revela una capa curricular
  más profunda (Fase de Proyecto Formativo, Actividad de Proyecto,
  saberes de concepto/proceso, criterios de evaluación, estrategias
  didácticas, materiales) que hoy no está modelada — es un alcance
  aparte, de menor prioridad que el módulo de horarios, no bloquea
  nada de lo de abajo.
- `LISTA_INSTRUCTORES_AMBIENTES` (hoja del Excel) es un antipatrón:
  tres catálogos sin relación real apilados por coincidencia de fila —
  cualquier script de import debe separarlos, no asumir que la fila
  los relaciona.
- `PE-04` (hoja del Excel) es un export institucional crudo de SOFIA
  Plus — mejor fuente para el catálogo de fichas que la hoja mantenida
  a mano; no tiene los horarios asignados (eso solo vive en
  `PLANEACION`).

### 7.2 Decisión de diseño: cruces con advertencia, no bloqueo duro

Hoy `HorarioService.crear`/`actualizar` bloquean duro cualquier cruce
(409, sin opción de continuar). Se decidió cambiar **solo para los 3
cruces físicos** (ficha/instructor/ambiente ya ocupados): pasan a ser
una advertencia con el detalle de contra qué choca, y el coordinador
decide si cancela o programa igual. **Las reglas RF-011 (tope de
horas/semana, jornada Noche vetada para planta) se quedan como
bloqueo duro** — son reglas institucionales/contractuales, no
negociables en campo, no se tocan.

Diseño concreto: nuevo endpoint dry-run (`POST /horarios/validar`) +
flag `forzar` en crear/actualizar; cuando se fuerza un cruce físico,
queda registrado en la tabla `auditoria` (ya existe, RNF-26/27) quién
lo forzó y contra qué — sin esto, un override silencioso pierde el
propósito de detectar el cruce en primer lugar.

### 7.3 Decisión de UI: patrón único de "relacionados"

En vez de construir una vista distinta por cada combinación de
entidades ("todo conectado con todo" sin acotar es una épica sin fin),
se define **un solo componente reutilizable** (`DrawerRelacionados`):
un panel/drawer que se abre desde cualquier fila/tarjeta (instructor,
ficha) y muestra sus horarios + entidades conectadas, alimentado por
endpoints `GET /{entidad}/{id}/horarios`.

Mockup validado y aprobado por el usuario (Claude Design canvas, 3
artboards: vista Instructores con el drawer, vista Fichas con el
drawer, modal de advertencia de cruce con botón "Programar de todas
formas"):
https://claude.ai/code/artifact/4024fc39-63c3-48b3-a80c-0a3f3166823f

Exportado como PNG (referencia visual "a alcanzar" para el equipo,
mismo patrón que `_Docs/Diseño/mockups-institucionales/`):
- `_Docs/Diseño/mockups-nuevo-alcance/01-instructores-relacionados.png`
- `_Docs/Diseño/mockups-nuevo-alcance/02-fichas-relacionados.png`
- `_Docs/Diseño/mockups-nuevo-alcance/03-modal-cruce.png`

### 7.4 Backlog para Jira — sprint "Nuevo alcance" (50 tareas, 7 épicas)

Creadas en Jira (proyecto SCRUM, sitio `gestionhorariossena.atlassian.net`)
el 2026-09-01: 7 épicas (SCRUM-29 a SCRUM-35, una por letra A-G) +
50 tareas (SCRUM-36 a SCRUM-85, cada una colgando de su épica como
`parent`). Pendiente: cerrar directo las tareas 48-49 (G, ya hechas —
SCRUM-83 y SCRUM-84) y ejecutar la 50 (cierre de sprint, SCRUM-85).

**A · Cruces con advertencia y override (backend) — 10**
1. Diseñar contrato del endpoint dry-run de cruces (request/response)
2. `POST /horarios/validar` — valida sin persistir, devuelve conflictos físicos
3. `HorarioService.crear` acepta flag `forzar`
4. `HorarioService.actualizar` acepta flag `forzar`
5. Registrar en `auditoria` cuando se fuerza un cruce (quién, cuándo, contra qué)
6. Test: dry-run sin conflictos
7. Test: dry-run con conflicto ficha/instructor/ambiente
8. Test: `forzar=true` guarda pese al conflicto físico
9. Test: RF-011 sigue bloqueando duro aunque `forzar=true`
10. Actualizar schemas Pydantic/OpenAPI del nuevo contrato

**B · Endpoints de relacionados (backend) — 6**
11. `GET /instructores/{id}/horarios`
12. `GET /fichas/{id}/horarios`
13. `GET /ambientes/{id}/horarios`
14. `GET /instructores/{id}/carga-semanal` (horas asignadas vs. máximo)
15. Tests de los 3 endpoints de relacionados
16. Documentar los endpoints nuevos en OpenAPI

**C · Modal de advertencia de cruce (frontend) — 7**
17. Componente `ModalCruce.tsx` (recibe conflictos por props) — mockup:
    `_Docs/Diseño/mockups-nuevo-alcance/03-modal-cruce.png`
18. Conectar `NuevoHorario`/`ModalBloque` al dry-run antes de guardar
19. Botón "Programar de todas formas" → reintenta con `forzar=true`
20. Distinguir en la UI conflicto overridable (físico) vs. bloqueo duro RF-011
21. Test: el modal muestra los conflictos recibidos
22. Test: clic en "Programar de todas formas" dispara el guardado forzado
23. Accesibilidad del modal (foco, Escape, aria) — mismo patrón que `ModalBloque`

**D · Panel/drawer de relacionados (frontend) — 12**
24. Componente base `DrawerRelacionados.tsx` (header, secciones, cerrar)
    — mockups: `_Docs/Diseño/mockups-nuevo-alcance/01-instructores-relacionados.png`
    y `02-fichas-relacionados.png`
25. Fila clickeable en Instructores abre el drawer
26. Sección "Carga semanal" (barra de progreso) en el drawer de instructor
27. Sección "Fichas asignadas" en el drawer de instructor
28. Sección "Temas que dicta" en el drawer de instructor
29. Sección "Ambientes asignados" en el drawer de instructor
30. Mini-grid semanal en el drawer de instructor
31. Tarjeta clickeable en Fichas abre el drawer
32. Grid semanal completo en el drawer de ficha (reusar `GridHorario` en solo-lectura)
33. Secciones instructores/temas/ambientes en el drawer de ficha
34. Tests de `DrawerRelacionados` con datos mock
35. Tests de integración: abrir/cerrar drawer en `Instructores.tsx` y `Fichas.tsx`

**E · Import de datos reales (Excel CGMLTI) — 6**
36. Script: parsear hoja `FICHAS` → catálogo de fichas
37. Script: parsear `LISTA_INSTRUCTORES_AMBIENTES` (separar los 3 catálogos apilados)
38. Script: parsear `PLANEACION` (despivotear formato ancho → filas de horario)
39. Script: reportar cruces/inconsistencias reales encontradas (no insertar en silencio)
40. Generar SQL/CSV de seed revisable, sin aplicar directo
41. Correr el import contra ambiente de prueba y validar con la coordinación

**F · Cambios de esquema pendientes — 6**
42. Migración `fichas.idSede` (FK a `sedes`)
43. Migración `fichas.fechaInicioLectiva` / `fechaFinLectiva`
44. Migración `fichas.fechaInicioProductiva` / `fechaFinProductiva`
45. Migración `usuarios.sigla` (código corto, ej. "DC")
46. Actualizar modelos SQLAlchemy + schemas Pydantic con los campos nuevos
47. Actualizar `database/02_datos_prueba.sql` con los campos nuevos

**G · Cierre de sprint y documentación — 3**
48. Actualizar `REGLAS_DE_NEGOCIO_CONOCIDAS.md` con hallazgos del Excel (ya hecho — ver §7.1 de este documento y la sección de cruces de ese archivo)
49. Actualizar este documento con el diseño de override+auditoría y el plan de import (ya hecho — esta sección)
50. Cerrar sprint actual en Jira y abrir sprint "Nuevo alcance" con este backlog

**Dependencias reales entre épicas** (para no bloquear tareas de más
en Jira): C depende del contrato de A2, pero puede maquetarse con
mocks mientras tanto; D depende de B, igual mockeable; F42-44 debe
completarse antes de correr E41 (el import necesita las columnas
nuevas ya migradas), pero E36-40 (escribir el script) puede avanzar
en paralelo sin esperar el esquema.

### 7.5 Estado del sprint activo al momento de crear el backlog (2026-09-01)

Registrado antes de ejecutar la tarea 50 (cerrar sprint actual / abrir
"Nuevo alcance"), para no perder de vista qué queda sin terminar.
Sprint activo en Jira: **"SCRUM Sprint 0"** (id interno 2, board id 1,
`2026-08-28` → `2026-09-11`), 22 issues en total.

**Sin terminar — deben pasar al sprint "Nuevo alcance" al cerrar este
sprint** (no se pueden mover todavía porque ese sprint aún no existe
en Jira; task 50 lo crea):
- `SCRUM-11` (Tarea, En curso, David Mendieta) — [Frontend] Manejo de errores más allá de 403 en api.ts y páginas
- `SCRUM-12` (Tarea, En curso, David Mendieta) — [Frontend] Responsive/mobile del sidebar (AppShell)
- `SCRUM-18` (Tarea, En revisión, Dayana Manrique) — [Infra] Confirmar/activar backups automáticos diarios en Supabase (RNF-17)
- `SCRUM-28` (Historia, En revisión, Dayana Manrique) — [Frontend] Rediseñar Ambientes: tabla + filtros + datos reales

**Finalizadas en este sprint** (no necesitan moverse, quedan cerradas
donde están): SCRUM-6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 19, 20, 21,
23, 24, 25, 26, 27.

**Cómo aplicar esto al ejecutar la tarea 50:** al cerrar "SCRUM Sprint
0" en Jira, la UI pregunta qué hacer con los issues no completados —
elegir "mover al sprint nuevo" (no al backlog) y seleccionar los 4
issues de arriba, apuntando al sprint "Nuevo alcance" recién creado.
Este MCP de Atlassian no expone herramientas de sprint (crear/cerrar
sprint, mover issues entre sprints) — esa parte de la tarea 50 es
manual en la UI de Jira, no automatizable desde esta sesión.

### 7.6 `main`/`develop` divergieron — épica A ya está implementada en `develop` (2026-09-02)

Al revisar el PR #14 (`front/responsive-sidebar`, de David) para
integrarlo, salió a la luz que **`develop` no es un superset de
`main`** — tienen historia distinta desde hace varios commits, y
`develop` ya trae trabajo que no está en ningún PR ni en `main`:

- **Épica A (cruces con advertencia y override) ya está implementada
  en `develop`**, en 5 commits sueltos sin PR asociado: `8ee839d`/
  `a86a118` (dry-run — `POST /horarios/validar`, schemas
  `HorarioDryRunRequest/Conflict/Response`), `e111f43`
  (`HorarioService.crear` + `forzar`), `8fdc6f3`
  (`HorarioService.actualizar` + `forzar`), `afbdad7` (auditoría al
  forzar). Tests: `backend/tests/test_horarios_dry_run.py`,
  `test_horarios_update_forzar.py`, `test_horarios_audit_forzar.py`.
  Comentario con el detalle completo dejado en Jira `SCRUM-29`.
- Verificado con grep que **Épica B (endpoints de relacionados,
  `GET /{entidad}/{id}/horarios`)** y **Épica F (columnas
  `fichas.idSede`/fechas, `usuarios.sigla`)** NO están en `develop` —
  esas sí siguen pendientes tal como las describe el backlog.
- `develop` también tiene un pase completo de **modo oscuro** (clases
  `dark:*` en casi todo el frontend) y una ronda de accesibilidad
  (`aria-label`/`aria-expanded`/`aria-haspopup`) que **no están en
  `main`** — cualquier componente nuevo (ej. `DrawerRelacionados` de
  la épica D) debe replicar `dark:*` igual que el resto de
  `AppShell.tsx`/páginas en `develop`, no solo el estilo claro.

**Por qué importa para "Nuevo alcance":** antes de arrancar cualquier
tarea de las épicas A-D, alguien tiene que decidir y ejecutar el merge
`develop → main` (o adoptar `develop` como base real de trabajo) —
si no, hay riesgo real de reimplementar la épica A desde cero sin
saber que ya existe, o de construir la épica D (drawer) sin modo
oscuro y quedar inconsistente con el resto del frontend.

**Estado del PR #14 (cerrado 2026-09-02):** se revisó (CI verde,
compatible con SCRUM-10, cumple `GUIA_DE_MARCA.md`; se encontró un bug
menor no bloqueante en `getUserFriendlyApiMessage` de `api.ts` — el
fallback usa `response.statusText`, que viene vacío en HTTP/2, en vez
del mensaje amigable, para 409/422 sin `detail` string — anotado en
Jira SCRUM-11, sin fix todavía). Se retargeteó el PR de `main` a
`develop` (`gh pr edit 14 --base develop`) porque contra `develop`
tenía un conflicto real (no solo de líneas) en
`frontend/src/components/AppShell.tsx`: el PR agregaba el menú
mobile/overlay + banner de error de perfil sin las clases `dark:*` ni
los `aria-*` que `develop` ya tenía (modo oscuro + accesibilidad,
ver arriba). Se resolvió a mano combinando ambos, se validó con
`npm run lint` + `npm run build` + `npx vitest run` (35/35) en un
worktree aislado, y se subió como merge commit `a923fa4` directo a
`develop` (`git push origin tmp/merge-pr14-develop:develop`, cuenta
`gestionhorariossena-sena`) — GitHub cerró el PR #14 como *Merged*
automáticamente. SCRUM-11 y SCRUM-12 quedaron Finalizado en Jira.
