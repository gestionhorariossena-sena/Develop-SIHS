"""Primera tarea real de IA: clasificar encabezados de columna de un
Excel contra los campos internos conocidos de SIHS. El mismo caso se
validó a mano contra un Excel real de SIHS antes de escribir este
código (ver Fase 0 de PLAN_INTEGRACION_IA.md) -- clasificó 7/12 columnas
conocidas con confianza >=0.95 y no inventó nada para las 5 que no le
pertenecían a ningún campo.

Nadie llama todavía a `clasificar_columnas` desde un flujo real -- queda
lista para el importador tolerante (Fase 3), que todavía no existe."""

from app.ai.client import generar_json
from app.ai.prompts import prompt_clasificar_columnas
from app.ai.schemas import ClasificacionColumnas


def clasificar_columnas(columnas: list[str]) -> ClasificacionColumnas:
    prompt = prompt_clasificar_columnas(columnas)
    respuesta_cruda = generar_json(prompt)
    return ClasificacionColumnas.model_validate(respuesta_cruda)
