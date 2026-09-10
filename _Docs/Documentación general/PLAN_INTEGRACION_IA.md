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

Depende de que exista la épica de importadores (`backend/importers/` no
existe todavía — hoy la carga de Excel real es
`backend/scripts/importar_datos_reales.py`, un script puntual, no un
módulo reusable). Cuando se aborde: usar `ai.tasks.classify_document`
(ya construido en la Fase 1) para mapear columnas desconocidas, y el
patrón de confianza documentado en la arquitectura para decidir qué se
importa solo y qué va a revisión humana.

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

Pendiente para la siguiente iteración: exponerlo como endpoint real
(`POST /horarios/generar-propuesta`, sujeto a revisión humana antes de
guardar — nunca autopublicar), permitir varios bloques por necesidad, y
usar el catálogo real de instructores/especialidades/ambientes en vez de
las listas de "candidatos" que hoy arma quien llama al generador.

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
