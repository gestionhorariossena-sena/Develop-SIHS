"""Prompts de las tareas de IA, centralizados aquí para poder ajustarlos
sin tocar la lógica de cada tarea en `app/ai/tasks/`."""

# Campos internos de SIHS a los que puede mapear una columna de Excel.
# Ampliar esta lista según aparezcan más formatos reales (ver Fase 3 de
# PLAN_INTEGRACION_IA.md: el importador tolerante).
CAMPOS_CONOCIDOS_SIHS = [
    "ficha",
    "programa",
    "jornada",
    "trimestre",
    "instructor",
    "nivel_formacion",
    "area_tematica",
    "cantidad_aprendices",
]


def prompt_clasificar_columnas(columnas: list[str]) -> str:
    return f"""Eres un clasificador de columnas de Excel para un sistema de
horarios académico llamado SIHS (SENA, Colombia).

Campos internos conocidos por SIHS: {CAMPOS_CONOCIDOS_SIHS}

Dada esta lista de encabezados de columna extraídos de un Excel real:
{columnas}

Para cada encabezado, indica a qué campo interno de SIHS corresponde (o
null si no corresponde a ninguno de la lista) y tu nivel de confianza
(0 a 1). No inventes una correspondencia si no estás seguro -- en ese
caso usa null y confianza baja.

Responde ÚNICAMENTE JSON válido con esta forma exacta, sin markdown ni
texto adicional:
{{"columna_original": {{"campo": "ficha", "confianza": 0.97}}, ...}}
"""


def prompt_resumir_auditoria(conflictos: list[dict]) -> str:
    mensajes = [c.get("mensaje", c.get("tipo", "")) for c in conflictos]
    tipos = sorted({c["tipo"] for c in conflictos})

    return f"""Eres un asistente para el coordinador académico de SIHS
(SENA, Colombia), que revisa una auditoría de cruces de horario.

Python ya detectó estos {len(conflictos)} conflictos reales (no los
inventes, no los reinterpretes, no decidas cuál es correcto -- eso ya
está resuelto). Tipos presentes: {tipos}.

Mensajes detallados de cada conflicto:
{mensajes}

Escribe un resumen breve en español, en tono profesional y directo, que
le ayude al coordinador a priorizar: qué patrón ves (ej. "la mayoría son
choques de instructor concentrados el mismo día"), y una lista corta de
prioridades concretas de qué revisar primero.

Responde ÚNICAMENTE JSON válido con esta forma exacta, sin markdown ni
texto adicional:
{{"resumen": "...", "prioridades": ["...", "..."]}}
"""


def prompt_responder_pregunta(pregunta: str, contexto: str) -> str:
    return f"""Eres un asistente para el coordinador académico de SIHS
(SENA, Colombia), que está revisando un horario puntual.

Contexto del bloque/conflicto que el coordinador está viendo (ya
calculado por el sistema, no lo reinterpretes ni inventes datos nuevos):
{contexto}

Pregunta del coordinador: "{pregunta}"

Responde en español, en una o dos frases, tono claro y directo, sin
tecnicismos ni nombres de herramientas o librerías.

Responde ÚNICAMENTE JSON válido con esta forma exacta, sin markdown ni
texto adicional:
{{"respuesta": "..."}}
"""
