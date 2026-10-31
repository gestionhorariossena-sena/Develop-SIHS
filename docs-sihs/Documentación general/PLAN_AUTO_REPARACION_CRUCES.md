# Plan preliminar — auto-reparación de cruces de horario

Documento de traspaso: quien retome esto debería poder empezar sin releer
todo el código de cero. Analiza si/cómo se podrían auto-reparar los 5 tipos
de conflicto que ya detecta `HorarioService`, y deja un borrador (no
producción) de cómo se vería el mecanismo.

## Contexto técnico ya construido (no reinventar)

- `HorarioService._detectar_cruces` / `validar_dry_run` (`backend/app/services/horario_service.py`):
  validan UN candidato nuevo contra lo existente. Devuelven conflictos
  tipados: `cruce_ficha`, `cruce_instructor`, `cruce_ambiente`,
  `resultado_repetido`, `regla_instructor`.
- `HorarioService.auditar_conflictos` (agregado 2026-09-06): barrido de
  conflictos entre horarios **ya guardados**, reutilizando `validar_dry_run`
  por cada uno contra los demás. Dedupea por par (conflictos simétricos) y
  por instructor (`regla_instructor`, que es un estado, no un cruce entre
  dos horarios). Expuesto en `GET /horarios/auditoria-cruces`
  (`idTrimestre`/`idSede` opcionales).
- `HorarioRepository.buscar_solape`: mismo campo (ficha/instructor/ambiente)
  + rango de horas que se solapa (`horaInicio < finNueva AND horaFin >
  inicioNueva`) + al menos un día en común + `activo=true`. Este es el
  cálculo real de "se cruza o no" — cualquier auto-reparación que busque un
  candidato alternativo debe reutilizar esta misma consulta, no reinventar
  la lógica de solape.
- `HorarioService._validar_reglas_instructor`: tope de horas RF-011 (32h
  planta / 40h contrato), jornada Noche vedada para planta, y "jornada
  continua en sedes distintas el mismo día" (mañana en sede A + tarde en
  sede B) — esta última regla está codificada como restricción dura, pero
  `REGLAS_DE_NEGOCIO_CONOCIDAS.md` documenta un **contraejemplo real**
  (Logística: instructor programado así a propósito) — no es una regla
  universal confirmada, es RF-011 formal contra la entrevista. Cualquier
  auto-reparación que mueva un instructor debe re-correr esta validación
  completa sobre el candidato antes de aplicar el cambio, nunca asumir que
  "mover a otra franja libre" es automáticamente válido.
- Modelo `Ambiente`: `numero_ambiente`, `nombre`, `tipo_ambiente`
  (`regular`/`especial`), `estado_ambiente` (`disponible`/`mantenimiento`/
  `inactivo`), `sede_id`. **No existe** campo de "requisitos especiales" con
  datos reales todavía (la migración `03_ambientes_requisitos.sql` se pensó
  para esto pero está vacía) — ver más abajo, esto limita qué tan seguro es
  auto-reasignar ambiente.
- `REGLAS_DE_NEGOCIO_CONOCIDAS.md` confirma: "el sistema no debe modelar
  dueño de un ambiente como restricción dura" — cualquier ambiente libre de
  cualquier coordinación es un candidato válido para reasignación, **excepto**
  los especializados (talleres con equipo fijo), que hoy no se pueden
  distinguir por dato real.

## Por tipo de conflicto: ¿auto-reparable?

### `cruce_ambiente` — parcialmente auto-reparable, con caveat real
Buscar otro ambiente con `estado_ambiente = 'disponible'`, mismo
`tipo_ambiente`, sin solape (misma consulta de `buscar_solape` pero variando
`idAmbiente` sobre el universo de ambientes candidatos), preferiblemente en
la misma sede. **Riesgo real**: si el ambiente original era `especial`
(taller con equipo específico, ej. animación 3D), reasignar a "otro
`especial` cualquiera" no garantiza que tenga el equipo correcto — el campo
que distinguiría esto no tiene datos todavía. Conclusión: auto-reparable de
forma segura solo para `tipo_ambiente = 'regular'`; para `'especial'`,
generar la sugerencia pero marcarla como "requiere confirmación manual del
coordinador" explícitamente, no aplicarla sola.

### `cruce_instructor` — auto-sugerible, NO auto-aplicable sin revisión
Candidatos: instructores con la especialidad del resultado
(`usuario_especialidad`) y sin solape en esa franja. Problema real
documentado: en Logística la especialización es **asimétrica** (un
instructor de comercio exterior sí puede dictar logística general, no al
revés) y el modelo `usuario_especialidad` no distingue esto — un match por
tabla N:N no basta para saber si el instructor sugerido es realmente apto.
Además, cambiar quién dicta una clase es una decisión pedagógica/laboral, no
solo logística. Conclusión: nunca auto-aplicar; como mucho, listar
candidatos posibles (mismo cálculo que "libre + especialidad") para que el
coordinador elija.

### `cruce_ficha` — no auto-reparable, solo detectable/sugerible
El conflicto es que la ficha ya tiene otra clase en esa franja — la
"reparación" implica mover una de las dos clases completas (no solo un
recurso), lo que requiere encontrar una franja libre distinta para
instructor+ambiente+ficha simultáneamente. Es una búsqueda combinatoria, no
una sustitución simple. Conclusión: fuera de alcance para una v1 de
auto-reparación; en el mejor caso, señalar cuál de las dos franjas en
conflicto tiene "menos dependencias" (ej. la más reciente) como candidata a
mover, sin proponer destino.

### `resultado_repetido` — auto-reparable en un caso acotado
Si es un error de captura real (se seleccionó el resultado equivocado al
crear el horario), la reparación sería cambiar `idResultado` a otro
resultado de la misma `competencia_formacion`/`guía` que la ficha SÍ
necesite y no tenga programado todavía. Esto requeriría cruzar contra el
"reporte de juicio de evaluación" (qué resultados ya vio la ficha) que
`REGLAS_DE_NEGOCIO_CONOCIDAS.md` dice que **no existe integrado hoy** (es
manual, vía Sofía Plus, sin importación en el sistema). Conclusión: no
auto-reparable hasta que exista esa integración; por ahora, solo reportar.

### `regla_instructor` (tope de horas RF-011, jornada Noche, sede continua)
No es un cruce entre dos horarios sino un estado del instructor — "reparar"
significa quitarle horas o reasignar el bloque a otro instructor, que es
exactamente el caso de `cruce_instructor` de arriba (con el mismo problema
de especialidad asimétrica). Conclusión: nunca auto-reparable
automáticamente; es una alerta para que el coordinador redistribuya carga a
mano. Además, dado que la regla de "sede continua" tiene un contraejemplo
real documentado, ni siquiera está claro que TODO lo que este tipo reporta
sea realmente un error a corregir — revisar con la coordinación antes de
construir cualquier automatismo sobre esta regla específica.

## Resumen: qué es seguro construir primero

Solo **`cruce_ambiente` con `tipo_ambiente = 'regular'`** tiene una ruta de
auto-reparación razonablemente segura hoy. Todo lo demás, en el mejor caso,
es "auto-sugerencia para que el coordinador confirme", nunca aplicación
automática silenciosa — mover un horario real siempre tiene impacto en
personas (instructor, ~30 aprendices), así que el diseño correcto es
**human-in-the-loop obligatorio**, no un cron que reescribe la matriz solo.

## Borrador de mecanismo (preliminar, no probado)

Flujo propuesto, todo dentro de una transacción que se puede descartar:

1. `HorarioService.sugerir_reparaciones(db, id_trimestre=None, id_sede=None) -> list[dict]`
   — corre `auditar_conflictos` y, por cada conflicto `cruce_ambiente` cuyo
   ambiente original sea `tipo_ambiente='regular'`, busca candidatos:
   ambientes con mismo `tipo_ambiente`, `estado_ambiente='disponible'`,
   misma `sede_id` (preferente) o cualquier sede, sin solape (reusar
   `HorarioRepository.buscar_solape` pasando cada ambiente candidato).
   Devuelve `{idHorario, tipo, sugerenciaAmbiente: idAmbiente | None, motivo}`.
   Para los demás tipos, devuelve el conflicto tal cual con
   `sugerenciaAmbiente: None` y una nota de "requiere intervención manual".
2. `HorarioService.aplicar_reparacion(db, id_horario, id_ambiente_nuevo, usuario) -> Horario`
   — SIEMPRE requiere que un humano haya elegido `id_ambiente_nuevo`
   (aunque venga de la sugerencia del paso 1, el coordinador confirma antes
   de llamar esto). Internamente: vuelve a correr `validar_dry_run` con el
   candidato modificado (ambiente nuevo, todo lo demás igual) para
   confirmar que de verdad no introduce un cruce nuevo (otro instructor/
   ficha podría haber tomado ese ambiente mientras tanto); si limpio,
   actualiza `horario.idAmbiente` y llama
   `AuditoriaService.registrar(db, usuario=usuario, accion="AUTO_REPARAR_CRUCE_AMBIENTE", entidad="horarios", id_entidad=id_horario, detalle=f"Reasignado de ambiente X a {id_ambiente_nuevo}")`
   — así queda tan trazado como cualquier otro cambio manual.
3. Endpoint nuevo `GET /horarios/sugerencias-reparacion` (solo lectura, mismo
   rol `require_puede_programar`) que expone (1), y
   `POST /horarios/{id}/reparar` que expone (2) — nunca automático en
   background/cron sin que exista antes una UI donde el coordinador vea y
   confirme la sugerencia.

Ver `backend/scripts/auto_reparar_cruces_borrador.py` (mismo commit) para un
esqueleto de (1) en código real pero sin probar contra la base — no
conectarlo a ninguna ruta todavía, es solo para acelerar la implementación
real de quien continúe esto.

## Cómo se probaría (approach, no tests escritos)

Seguir el patrón ya usado en `backend/tests/test_horarios_auditoria_cruces.py`
(crear catálogo mínimo + 2 horarios en conflicto de ambiente vía `forzar`,
un tercer ambiente libre del mismo `tipo_ambiente` disponible) y verificar
que `sugerir_reparaciones` propone exactamente ese tercer ambiente, y que
`aplicar_reparacion` deja un registro en `Auditoria` con la acción correcta.
Caso borde a cubrir: el ambiente "libre" sugerido se ocupa por otro cambio
justo antes de confirmar — `aplicar_reparacion` debe volver a fallar con el
cruce real en ese momento, no aplicar ciegamente la sugerencia vieja.

## Siguiente paso concreto

1. Confirmar con la coordinación si el alcance de v1 (solo `cruce_ambiente`
   regular, siempre con confirmación humana) es útil o si esperan más.
2. Implementar `sugerir_reparaciones`/`aplicar_reparacion` en
   `HorarioService` siguiendo el esqueleto del borrador, con tests siguiendo
   el patrón de `test_horarios_auditoria_cruces.py`.
3. Endpoints + wiring a `AuditoriaCruces.tsx` (ya existe la pantalla real,
   solo faltaría el botón "Ver sugerencia"/"Aplicar" por conflicto).
4. NO tocar `cruce_instructor`/`cruce_ficha`/`resultado_repetido`/
   `regla_instructor` con automatismo real hasta resolver las preguntas
   abiertas de `REGLAS_DE_NEGOCIO_CONOCIDAS.md` (especialidad asimétrica,
   integración con reporte de Sofía Plus) — construir eso antes sería
   automatizar sobre datos que hoy sabemos que están incompletos.
