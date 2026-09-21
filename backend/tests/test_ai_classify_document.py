"""Fase 1 de PLAN_INTEGRACION_IA.md. Mockea httpx.post directamente (no
llama a la API real de Gemini, no gasta tokens en CI) -- mismo patrón que
test_credencial_temporal_service.py."""

import json

import httpx
import pytest

from app.ai.client import AIServiceError, generar_json
from app.ai.tasks.classify_document import clasificar_columnas


class _RespuestaFalsa:
    def __init__(self, status_code, cuerpo_json=None, texto=""):
        self.status_code = status_code
        self._cuerpo_json = cuerpo_json
        self.text = texto

    def json(self):
        return self._cuerpo_json

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://generativelanguage.googleapis.com/x")
            response = httpx.Response(self.status_code, request=request, text=self.text)
            raise httpx.HTTPStatusError("error", request=request, response=response)


def _respuesta_gemini(texto_json: dict) -> _RespuestaFalsa:
    return _RespuestaFalsa(
        200,
        {"candidates": [{"content": {"parts": [{"text": json.dumps(texto_json)}]}}]},
    )


def test_clasifica_columnas_conocidas_con_alta_confianza(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    fake_json = {
        "JORNADA": {"campo": "jornada", "confianza": 1.0},
        "ITEMS": {"campo": None, "confianza": 0.0},
    }

    def fake_post(url, headers=None, json=None, timeout=None):
        assert headers["x-goog-api-key"] == "key-de-prueba"
        return _respuesta_gemini(fake_json)

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    resultado = clasificar_columnas(["JORNADA", "ITEMS"])

    assert resultado.root["JORNADA"].campo == "jornada"
    assert resultado.root["JORNADA"].confianza == 1.0
    assert resultado.root["ITEMS"].campo is None


def test_sin_api_key_no_llama_a_gemini_y_lanza_error(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "")

    def fake_post(*args, **kwargs):
        raise AssertionError("No debería llamar a Gemini sin key configurada")

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    with pytest.raises(AIServiceError, match="no está configurada"):
        generar_json("cualquier prompt")


def test_respuesta_no_json_lanza_ai_service_error(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")

    def fake_post(url, headers=None, json=None, timeout=None):
        return _RespuestaFalsa(
            200,
            {"candidates": [{"content": {"parts": [{"text": "esto no es JSON"}]}}]},
        )

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    with pytest.raises(AIServiceError, match="no devolvió JSON válido"):
        generar_json("cualquier prompt")


def test_error_http_no_expone_la_api_key(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-secreta-no-debe-verse")

    def fake_post(url, headers=None, json=None, timeout=None):
        return _RespuestaFalsa(429, texto="cuota excedida")

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    with pytest.raises(AIServiceError) as excinfo:
        generar_json("cualquier prompt")

    assert "key-secreta-no-debe-verse" not in str(excinfo.value)
    assert "429" in str(excinfo.value)


def test_clasificacion_invalida_falla_la_validacion_de_pydantic(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")

    def fake_post(url, headers=None, json=None, timeout=None):
        # confianza fuera de rango [0, 1] -- Pydantic debe rechazarlo.
        return _respuesta_gemini({"FICHA": {"campo": "ficha", "confianza": 5.0}})

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    with pytest.raises(Exception):
        clasificar_columnas(["FICHA"])
