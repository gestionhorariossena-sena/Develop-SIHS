"""Mismo patrón de mockeo de httpx.post que el resto de tests de app/ai/."""

import json

import pytest

from app.ai.client import AIServiceError
from app.ai.tasks.responder_pregunta import responder_pregunta


class _RespuestaFalsa:
    def __init__(self, cuerpo_json):
        self._cuerpo_json = cuerpo_json

    def json(self):
        return self._cuerpo_json

    def raise_for_status(self):
        pass


def test_responder_pregunta_devuelve_respuesta_corta(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    texto_llm = json.dumps({"respuesta": "El Lab 308 está libre a esa hora."})

    def fake_post(url, headers=None, json=None, timeout=None):
        assert "por qué" in json["contents"][0]["parts"][0]["text"].lower()
        return _RespuestaFalsa({"candidates": [{"content": {"parts": [{"text": texto_llm}]}}]})

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    resultado = responder_pregunta("¿Por qué hay un choque?", "Ficha 100, Lab 304, martes 12-18.")

    assert "Lab 308" in resultado.respuesta


def test_responder_pregunta_sin_api_key_lanza_error(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "")

    def fake_post(*args, **kwargs):
        raise AssertionError("No debería llamar a Gemini sin key configurada")

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    with pytest.raises(AIServiceError, match="no está configurada"):
        responder_pregunta("¿Por qué?", "contexto")
