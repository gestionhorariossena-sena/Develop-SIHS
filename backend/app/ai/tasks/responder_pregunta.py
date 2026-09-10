"""Pregunta puntual del coordinador sobre un bloque/conflicto que está
revisando (la barra "¿En qué te ayudo?" del asistente de programación).
Una llamada por pregunta -- no se dispara sola, el coordinador la escribe
a propósito."""

from app.ai.client import generar_json
from app.ai.prompts import prompt_responder_pregunta
from app.ai.schemas import RespuestaPreguntaHorario


def responder_pregunta(pregunta: str, contexto: str) -> RespuestaPreguntaHorario:
    prompt = prompt_responder_pregunta(pregunta, contexto)
    respuesta_cruda = generar_json(prompt)
    return RespuestaPreguntaHorario.model_validate(respuesta_cruda)
