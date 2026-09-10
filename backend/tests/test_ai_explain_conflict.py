"""Fase 2 de PLAN_INTEGRACION_IA.md. Mismo patrón de mockeo de httpx.post
que test_ai_classify_document.py -- no llama a la API real de Gemini."""

import json

import pytest

from app.ai.client import AIServiceError
from app.ai.tasks.explain_conflict import resumir_auditoria


class _RespuestaFalsa:
    def __init__(self, status_code, cuerpo_json):
        self.status_code = status_code
        self._cuerpo_json = cuerpo_json

    def json(self):
        return self._cuerpo_json

    def raise_for_status(self):
        pass


def _respuesta_gemini(payload: dict) -> _RespuestaFalsa:
    return _RespuestaFalsa(
        200,
        {"candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}]},
    )


_CONFLICTOS_DE_PRUEBA = [
    {"tipo": "cruce_instructor", "mensaje": "El instructor ya tiene otra clase el martes 8-10."},
    {"tipo": "cruce_instructor", "mensaje": "El instructor ya tiene otra clase el martes 10-12."},
    {"tipo": "cruce_ambiente", "mensaje": "El ambiente ya está ocupado el lunes 8-10."},
]


def test_resumir_auditoria_devuelve_resumen_y_prioridades(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")

    def fake_post(url, headers=None, json=None, timeout=None):
        # El prompt debe llevar los mensajes reales, no solo el conteo.
        assert "martes" in json["contents"][0]["parts"][0]["text"]
        return _respuesta_gemini(
            {
                "resumen": "La mayoría de cruces son de instructor, concentrados el martes.",
                "prioridades": ["Revisar la agenda del instructor del martes"],
            }
        )

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    resultado = resumir_auditoria(_CONFLICTOS_DE_PRUEBA)

    assert "martes" in resultado.resumen
    assert resultado.prioridades == ["Revisar la agenda del instructor del martes"]


def test_resumir_auditoria_sin_api_key_lanza_error(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "")

    def fake_post(*args, **kwargs):
        raise AssertionError("No debería llamar a Gemini sin key configurada")

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    with pytest.raises(AIServiceError, match="no está configurada"):
        resumir_auditoria(_CONFLICTOS_DE_PRUEBA)
