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
