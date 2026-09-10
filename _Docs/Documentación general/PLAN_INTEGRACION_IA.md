# Plan de integración de IA — paso a paso

Documento de traspaso y aprendizaje: registra qué se hizo, por qué, y qué
sigue, para que cualquiera (incluido quien lo escribió) pueda retomarlo
sin releer toda la conversación. Complementa
[Arquitectura IA del motor de horarios](../Arquitectura/Arquitectura_IA_Motor_Horarios.md)
y la [Cotización](COTIZACION_INTEGRACION_IA.md).

Fecha de inicio: 2026-09-09. Se avanza por fases porque cada una es
verificable por separado y ninguna rompe el sistema si se queda a medias
— principio 18 de la arquitectura: "no implementar IA todavía si no es
necesaria para el MVP, pero dejar la arquitectura preparada".

## Fase 0 — Diseño (hecha)

- `_Docs/Arquitectura/Arquitectura_IA_Motor_Horarios.md`: qué NO debe
  hacer un LLM (restricciones duras, generar el horario) y qué SÍ
  (clasificar, interpretar, explicar, sugerir).
- `_Docs/Documentación general/COTIZACION_INTEGRACION_IA.md`: cuánto
  cuesta en la práctica (spoiler: centavos de peso al mes al volumen de
  SIHS).
- Spike manual validado contra un Excel real (`LIDERES DE FICHA
  2026_pruebas.xlsx`): Gemini clasificó 7/12 columnas conocidas con
  confianza ≥0.95 y no inventó nada para las 5 que no le pertenecían a
  ningún campo de SIHS. Esa prueba vivía en un worktree desechable
  (`back/spike-clasificador-ia`), fuera del código real — la Fase 1 la
  convierte en código de verdad.

## Fase 1 — Fundaciones de `AIService` (HOY)

Objetivo: que exista una interfaz real, desacoplada del proveedor,
probada, sin que nada del sistema dependa todavía de ella. Nadie la
llama en un flujo real todavía — es intencional (requisito 13: la IA es
asistente, no fuente de verdad; requisito 14: se puede cambiar de
proveedor sin tocar el resto del backend).

Piezas, en el orden en que se construyen (y se commitean):

1. **Config** (`backend/app/core/config.py`, `.env.example`):
   `gemini_api_key` como cualquier otra credencial (mismo patrón que
   `supabase_service_role_key`). Vacía por defecto — el sistema arranca
   igual sin ella.
2. **`backend/app/ai/schemas.py`**: los modelos Pydantic que validan lo
   que devuelve el LLM antes de que toque cualquier dato real
   (requisito 12). Si Gemini devuelve algo que no calza con el schema,
   truena aquí, no silenciosamente más adelante.
3. **`backend/app/ai/client.py`**: el cliente HTTP a Gemini (mismo
   patrón que `credencial_temporal_service.py` — `httpx.post` directo,
   sin SDK adicional, mockeable con `monkeypatch` en los tests). Expone
   un solo método genérico (`generar_json`) — las tareas específicas
   viven aparte.
4. **`backend/app/ai/prompts.py`** + **`backend/app/ai/tasks/classify_document.py`**:
   la primera tarea real, la misma que se probó en el spike:
   clasificar encabezados de columna contra los campos conocidos de
   SIHS, con confianza por campo.
5. **Tests** (`backend/tests/test_ai_classify_document.py`): mockean
   `httpx.post` (no llaman a la API real, no gastan tokens en CI) y
   verifican que una respuesta válida se parsea bien y una inválida
   truena con un error claro.

Explícitamente fuera de la Fase 1: no hay endpoint HTTP, no hay
importador que la use, no hay UI. Es una pieza de librería interna,
probada y lista para conectarse.

## Fase 2 — Primer punto de contacto real: explicar conflictos (hecha)

`HorarioService.auditar_conflictos` ya arma un `mensaje` determinista por
cada conflicto individual — eso no cambió. Lo que faltaba y ahora existe
es un **resumen agregado** de toda la auditoría (que puede traer decenas
de conflictos): ver el patrón conjunto y priorizar, algo que el código
determinista no hacía.

- `app/ai/schemas.py`: `ResumenAuditoriaIA` (resumen + prioridades).
- `app/ai/prompts.py`: `prompt_resumir_auditoria`.
- `app/ai/tasks/explain_conflict.py`: `resumir_auditoria(conflictos)` —
  una sola llamada de IA por auditoría completa, no por conflicto.
- `POST /api/v1/horarios/auditoria-cruces/resumen-ia`: opt-in (POST, no
  GET — no se dispara solo al cargar la pantalla). Sin conflictos no
  llama a la IA. Sin `GEMINI_API_KEY` o si Gemini falla, responde 503 sin
  exponer la key.
- Tests: `test_ai_explain_conflict.py` (unitarios, mock de `httpx.post`)
  y `test_horarios_resumen_ia.py` (endpoint, mock de
  `HorarioService.auditar_conflictos` + `httpx.post`). Suite completa:
  140 passed.

No necesitó migración de base de datos — es una lectura sobre datos que
`auditar_conflictos` ya calcula, sin persistir nada nuevo. Pendiente para
el frontend (fuera de esta sesión): el botón "Resumir con IA" en
`AuditoriaCruces.tsx` que llame a este endpoint.

## Fase 3 — Importador tolerante a estructura

`backend/app/services/asistente_horario_service.py::previsualizar_excel`
(la Fase del Asistente de programación, más abajo) ya cubre el caso
**tabla plana**: una fila por ficha, columnas limpias, `classify_document`
mapea encabezados con confianza. Probado con `LIDERES DE FICHA
2026_pruebas.xlsx` — funciona de punta a punta.

**Hallazgo real de esta sesión, probando con
`PROGRAMACIÓN CGMLTI I TRM 2026 (4).xlsx`, hoja `PLANEACION`**: ese
archivo (la programación real más autoritativa que existe, no un caso de
borde) usa un formato **de matriz/pivote** completamente distinto:

```
Fila 2: [..., 'ficha ', 'M', 'M', 'T', 'T', 'N', 'N', ...]   -- encabezado de 2 filas
Fila 3: ['TEMAS_', 1, 'TEMAS_7_TRM_2996161_(DM)_...', 'TDPM16', ...]
Fila 4: ['INSTRUCTOR_', None, '7_TRM_2996161_(DM)_...', 'LA', ...]
Fila 5: ['AMBIENTE_.', None, 'AMBIENTE_.7_TRM_2996161_(DM)_...', 505, ...]
```

Cada ficha ocupa 3 filas (temas/instructor/ambiente), el número de ficha
viene mezclado dentro de un texto compuesto (no en su propia celda), y el
grid día×jornada se reparte horizontalmente en ~40 columnas. No es un
problema de clasificación de columnas — es una forma de tabla distinta,
necesita su propio decodificador (detectar el patrón de 3 filas por
grupo, extraer el número de ficha con un patrón del texto compuesto,
reacomodar el grid horizontal en registros). Fuera de alcance de esta
sesión a propósito: es una pieza de trabajo separada, no un ajuste del
importador de tabla plana.

**Mitigación ya aplicada mientras tanto**: cuando ninguna fila trae una
ficha reconocible, `previsualizar_excel` devuelve `advertenciaGeneral`
explicando la causa probable (formato de matriz vs. columna rota) en vez
de repetir la misma advertencia sin contexto en cada fila — evita que el
coordinador tenga que adivinar por qué falló.

### Cruce de dos archivos + auto-creación de Programa/Coordinación (hecho)

`LIDERES DE FICHA` no trae nivel de formación, coordinación ni el código
real de programa de SENA. Investigando el archivo
`PROGRAMACIÓN CGMLTI I TRM 2026 (4).xlsx` más a fondo apareció la hoja
**`PE-04`** — un export oficial de SOFIA Plus, con 53 columnas, que sí
trae `CODIGO_PROGRAMA` (el código real, ej. `228118`), `NIVEL_FORMACION`,
`NOMBRE_PROGRAMA_FORMACION` y fechas de ficha. 20 de las fichas de
`LIDERES DE FICHA` coinciden con `PE-04` por número de ficha — probado
con los dos archivos reales, no solo hipotético.

- `POST /horarios/asistente/importar` ahora acepta un segundo archivo
  opcional (`archivo_complementario`). Se cruza con el principal por
  `codigoFicha`.
- `_elegir_hoja`: si el archivo tiene varias hojas, ya no asume que la
  útil es la primera — mide, sin IA, cuántos valores puramente numéricos
  tiene cada columna candidata (cualquier encabezado que contenga
  "ficha") y elige la de mayor densidad. Necesario: `PROGRAMACIÓN CGMLTI`
  tiene 15 hojas, la útil (`PE-04`) es la #6.
- **Bug real encontrado y corregido en el camino**: `PE-04` trae a la vez
  `IDENTIFICADOR_FICHA` e `IDENTIFICADOR_UNICO_FICHA` (con un prefijo
  extra) — la IA, guiándose por el nombre, mapeaba "ficha" a la columna
  equivocada. La densidad numérica medida por `_elegir_hoja` ahora se usa
  como ancla para el campo "ficha" específicamente, en vez de confiar en
  la semántica de la IA para ese campo — y compara TODAS las columnas
  candidatas de una misma hoja entre sí, no solo la primera que aparece
  (esa fue la segunda vuelta del mismo bug).
- Frontend: cuando el Programa no coincide con el catálogo y el archivo
  complementario trajo código + nivel para esa ficha, el botón "Crear
  ficha" del paso 2 se convierte en un formulario prellenado (nombre,
  nivel, código, coordinación) — el coordinador solo confirma o ajusta.
  Si la Coordinación tampoco existe, se puede crear ahí mismo (solo pide
  un nombre). Sin ese cruce, se sigue pidiendo elegir un Programa
  existente — no se inventa nada sin datos de respaldo.
- 4 tests nuevos que cubren el cruce y ambas vueltas del bug de la
  columna "ficha".

**Ajuste posterior**: el select de Programa (cuando no hay cruce, o el
cruce no encontró coincidencia) no tenía salida hacia "crear nuevo" — se
quedaba mostrando solo los programas que YA existen en el catálogo (que
al probar en vivo eran apenas 2, sin relación con los ~8 programas
reales del Excel). Se agregó la opción "+ No está en la lista --
agregarlo" al select, que abre el mismo panel de creación manual
(prellenado con lo que se sepa, vacío si no hay nada) con un botón para
volver a la lista si fue por error. La causa real no era un bug de
búsqueda -- el catálogo de Programas de la BD compartida está casi vacío
todavía, hay que ir creándolo a mano o con más archivos complementarios
como PE-04.

**Segundo ajuste, encontrado probando en vivo**: crear una ficha con un
Programa nuevo (por el flujo de arriba) crea el Programa, pero NO crea
ningún `CompetenciaFormacion`/`ResultadoAprendizaje` -- ese contenido
curricular no viene en ninguno de los Excel que se han probado
(`LIDERES DE FICHA`, `PE-04`) y no se inventa. El resultado real: al
generar la propuesta para esas fichas, `generar_propuesta` no encontraba
nada pendiente y devolvía bloques vacíos con el mensaje "ya tienen todos
sus resultados programados" -- **engañoso**, la causa real era "este
programa no tiene resultados de aprendizaje definidos todavía", no que
ya estuviera todo hecho. El paso 3 del frontend, además, solo mostraba
ese mensaje cuando la propuesta era infactible, no cuando venía vacía
por esta razón -- el coordinador se quedaba con una tabla vacía y un
botón "Confirmar" deshabilitado sin ninguna explicación, y sin ningún
botón para reintentar. Corregido: `generar_propuesta` distingue las dos
causas, el frontend muestra el mensaje en ambos casos, y se agregó un
botón "Generar propuesta de nuevo" en el paso 3 (antes solo se generaba
una vez, al entrar desde el paso 2, sin forma de reintentar).

Pendiente real para que esto funcione de punta a punta con fichas
nuevas: alguna forma de cargar competencias/resultados de aprendizaje
por programa -- hoy solo existe para los 2 programas de prueba
originales, cargados a mano en la BD antes de esta sesión.

### Importador de currículo (competencias + resultados) por programa (hecho)

El pendiente de arriba tenía solución real: `Planeación Cadena de
Formación.xlsx` y `Planeación Oferta Abierta 2025.xlsx` -- que ya
estaban en la raíz del repo, sin revisar a fondo hasta ahora -- resultaron
ser el **Formato de Planeación Pedagógica** real de SENA: una hoja
"Planeacion ..." con columnas fijas `COMPETENCIA` / `RESULTADOS DE
APRENDIZAJE` (competencia en celdas combinadas, un resultado por fila).
Probado contra los dos archivos reales: **27 resultados en 7
competencias**, en ambos -- confirmado con el usuario que ambos son
Análisis y Desarrollo de Software (el campo "Denominación del Programa"
del formato queda vacío en la plantilla, no hay forma de leerlo del
archivo).

- **Sin IA a propósito**: el formato tiene encabezados fijos y
  consistentes en los dos archivos reales -- clasificación semántica
  hubiera sido gasto innecesario para algo que un `if` ya resuelve bien.
- `POST /competencias-formacion/importar-vista-previa`: nuevo endpoint,
  solo lee y arma la vista previa, no persiste nada. Confirmar reusa
  `POST /competencias-formacion/` y `POST /resultados-aprendizaje/` (ya
  existentes) -- no hizo falta un endpoint de "crear todo junto".
  **Requiere rol Administrador** (igual que esos dos endpoints ya
  exigían -- distinto de `require_puede_programar` que usa el resto del
  asistente).
- Frontend: nueva sección "Competencias y resultados de aprendizaje" en
  el drawer de detalle de `Programas.tsx` -- subir archivo, vista previa,
  confirmar. Con esto cargado, `generar_propuesta` (Fase 4) ya tiene qué
  programar para las fichas de ese programa.
- 5 tests nuevos (parseo con Excel sintético, error si el archivo no
  tiene el formato esperado, permisos del endpoint).

Con este importador + el de fichas (`asistente_horario_service.py`) +
el optimizador (Fase 4), el flujo completo que pidió el usuario queda
cerrado: **cargar currículo real de un programa → crear/reconocer sus
fichas → generar propuesta de horario → coordinador revisa y confirma →
queda publicado para instructores/aprendices** (esto último ya lo hacía
`HorarioService.crear`, con `publicado=true` por defecto).

### Control manual: casilla "Usar" por ficha (paso 2 del asistente)

El paso 2 reconocía automáticamente todas las fichas que existían en el
catálogo y las mandaba todas a `generar-propuesta` sin que el
coordinador pudiera excluir alguna puntual (por ejemplo una ficha que
ya tiene horario en otro trimestre, o que el coordinador simplemente no
quiere programar todavía). Se agregó una casilla "Usar" en la primera
columna de la tabla de filas reconocidas (`AsistenteHorarios.tsx`),
visible solo para filas con `fichaExiste`, más un enlace
"marcar todas / desmarcar todas" junto al resumen del paso. El estado
vive en `filasExcluidas: Set<number>` (número de fila del Excel), se
reinicia en cada nueva importación, y `idsFichaListas` (el arreglo que
se envía a `generar-propuesta`) ahora filtra por
`!filasExcluidas.has(f.fila)` además de `fichaExiste` e `idFicha`.
Sigue el mismo principio de todo el asistente: nada se ejecuta ni se
guarda automáticamente sobre una ficha que el coordinador no confirmó
explícitamente.

## Fase 4 — Motor optimizador con OR-Tools (MVP hecho)

El hueco más grande del sistema: `HorarioService` **valida** horarios
armados a mano, no los **generaba**. No es tarea de IA — es CP-SAT puro
(`ortools`, agregado a `requirements.txt`), requisito 7 de la
arquitectura: las restricciones duras nunca se delegan a un LLM.

- `app/scheduling/generator.py`: `generar_horario(necesidades)` resuelve
  con CP-SAT la asignación de franja horaria + patrón de días +
  instructor + ambiente para una lista de `NecesidadHorario` (ficha +
  resultado + jornada + candidatos), sin choques de instructor, ficha ni
  ambiente. Devuelve `None` si el modelo es infactible.
- **Simplificación deliberada del MVP**: un bloque semanal por
  necesidad, de un catálogo fijo de franjas (3 por jornada) y patrones de
  día (9: sueltos + pares no consecutivos típicos de SENA). No reparte
  horas en varios bloques todavía ni deja que el solver elija cuántos
  bloques necesita una ficha — cubre el caso real más común, generalizar
  es la siguiente iteración, no un cambio de arquitectura.
- 6 tests (`test_scheduling_generator.py`): asignación sin choques
  compartiendo instructor/ambiente, misma ficha con recursos distintos,
  infactibilidad real, validación de entradas.
- `backend/scripts/demo_flujo_completo_ia_optimizador.py`: demo manual
  (no pytest) que corre el flujo pedido de punta a punta con datos
  reales — **corrido en vivo esta sesión**: leyó
  `LIDERES DE FICHA 2026_pruebas.xlsx` (8 fichas reales, 2 filas con
  ficha en formato sucio saltadas con aviso), clasificó sus columnas con
  Gemini (Fase 1), generó 8 bloques con OR-Tools, los persistió con
  `HorarioService.crear` sobre SQLite en memoria (nunca toca Supabase), y
  `HorarioService.auditar_conflictos` confirmó **0 conflictos**.

Pendiente para más adelante: permitir varios bloques por necesidad, y
filtrar candidatos por especialidad real (hoy usa todos los instructores
activos, no cruza por especialidad/competencia).

### Bug real: el paso 3 se colgaba y terminaba en timeout

Con datos reales el paso 3 ("armando tu horario") se quedaba colgado y
el frontend terminaba mostrando el timeout genérico de 45s sin nunca
llegar a habilitar el botón del paso 4. La causa no era el solver: era
que `generar_horario` comparaba **cada opción de cada necesidad contra
cada opción de cada otra necesidad** para detectar choques —
`O(necesidades² × opciones²)`. Con varias fichas del mismo programa
compitiendo por las mismas decenas de resultados de aprendizaje (caso
real: 4 fichas de ADSO, 20-29 resultados pendientes cada una, 648
opciones por necesidad con solo 4 instructores × 6 ambientes reales),
eso son miles de millones de comparaciones en Python puro *antes* de
llamarle al solver. Se arregló indexando cada opción por el recurso que
ocupa en cada `(franja, día)` (`ocupacion_instructor`,
`ocupacion_ambiente`, `ocupacion_ficha`) y usando
`AddAtMostOne` por slot en vez de la comparación par a par — misma
restricción, pero construir el modelo pasa a ser lineal en
`necesidades × opciones`. Se agregó
`test_volumen_realista_no_se_cuelga_construyendo_el_modelo` que
reproduce ese volumen real (80 necesidades, 4 instructores, 6
ambientes) y falla si tarda más de 15s.

## Asistente de programación — el wizard conectado de punta a punta (hecho)

`POST /horarios/generar-propuesta` ya existe y está conectado a un
frontend real, no solo al script de demo. Mismo día, misma sesión:

- `POST /horarios/asistente/importar`: sube un Excel real, la IA
  clasifica columnas (Fase 1), arma vista previa. Fichas que el Excel
  trae pero no existen en el catálogo se marcan pendientes — no se crean
  solas (requiere pasar primero por Fichas).
- `POST /horarios/asistente/generar-propuesta`: para fichas existentes,
  arma las necesidades desde sus resultados de aprendizaje sin horario en
  el trimestre (relaciones reales Ficha → Programa → Competencia →
  Resultado) y llama al optimizador. No persiste nada.
- `POST /horarios/asistente/preguntar`: la barra "¿En qué te ayudo?" del
  mockup — una pregunta puntual, `responder_pregunta`, sin tocar la BD.
- `frontend/src/pages/AsistenteHorarios.tsx` (`/horarios/asistente-ia`,
  nav "Asistente IA" — separado de `/horarios/nuevo`, que sigue siendo el
  Constructor manual de un horario a la vez): los 4 pasos reales del
  mockup. Antes de dejar confirmar, cada bloque propuesto pasa por
  `POST /horarios/validar` (el dry-run real que ya existía) como prueba
  completa. Confirmar llama a `POST /horarios/` (ya existente) bloque por
  bloque, mostrando qué se guardó y qué falló.

Verificado: `pytest` completo (159 passed), `npm test` completo (205
passed), `tsc -b` limpio, `eslint` sin errores, `npm run build` exitoso.
**No probado en navegador real** — necesita el backend corriendo con
Supabase configurado localmente.

## Fase 5 — Aprendizaje sin gastar IA

Guardar el ciclo `dato detectado → usuario corrigió → dato correcto` como
alias reusables (`"TRM" → trimestre`, etc.), para que la Fase 3 cada vez
llame menos a la IA. Depende de que exista la pantalla de revisión de
importación (Fase 3).

## Fase 6 — `parse_instruction` y sugerencia de preferencias

Interpretar instrucciones sueltas en lenguaje natural ("la ficha X no
puede tener clases el viernes") y detectar patrones de uso para sugerir
preferencias. Depende de que exista el optimizador (Fase 4) para que la
preferencia tenga a dónde aplicarse.

## Estado al cierre de esta sesión

Ver el historial de commits de la rama `gestion` del 2026-09-09 para el
detalle exacto de qué quedó implementado de la Fase 1.
