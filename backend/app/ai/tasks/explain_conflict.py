"""Fase 2 de PLAN_INTEGRACION_IA.md. `HorarioService.auditar_conflictos`
(backend/app/services/horario_service.py) ya arma un `mensaje`
determinista por cada conflicto individual -- este módulo NO reemplaza
eso. Lo que aporta es un resumen agregado de TODA la auditoría (que puede
traer decenas de conflictos), algo que el código determinista no hace:
ver el patrón conjunto y sugerir por dónde empezar a revisar.

Se cobra una llamada de IA por auditoría, no por conflicto -- por eso
`resumir_auditoria` recibe la lista completa en una sola llamada, no se
itera conflicto por conflicto."""

from app.ai.client import generar_json
from app.ai.prompts import prompt_resumir_auditoria
from app.ai.schemas import ResumenAuditoriaIA


def resumir_auditoria(conflictos: list[dict]) -> ResumenAuditoriaIA:
    prompt = prompt_resumir_auditoria(conflictos)
    respuesta_cruda = generar_json(prompt)
    return ResumenAuditoriaIA.model_validate(respuesta_cruda)
