"""Fase 2 de PLAN_INTEGRACION_IA.md. Mockea HorarioService.auditar_conflictos
(ya probado a fondo en test_horarios_auditoria_cruces.py -- no hace falta
repetir esa lógica acá) y httpx.post, para probar solo el cableado del
endpoint: auth, caso sin conflictos, y error de IA propagado como 503."""

import json


class _RespuestaFalsa:
    def __init__(self, cuerpo_json):
        self._cuerpo_json = cuerpo_json

    def json(self):
        return self._cuerpo_json

    def raise_for_status(self):
        pass


def test_resumen_ia_sin_conflictos_no_llama_a_gemini(client, db_session, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    monkeypatch.setattr(
        "app.api.v1.horarios.HorarioService.auditar_conflictos", lambda *a, **kw: []
    )

    def fake_post(*args, **kwargs):
        raise AssertionError("No debería llamar a Gemini si no hay conflictos")

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    respuesta = client.post("/api/v1/horarios/auditoria-cruces/resumen-ia", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["prioridades"] == []


def test_resumen_ia_con_conflictos_devuelve_resumen_de_gemini(
    client, db_session, autenticar_como, monkeypatch
):
    _, headers = autenticar_como("Coordinador")
    monkeypatch.setattr(
        "app.api.v1.horarios.HorarioService.auditar_conflictos",
        lambda *a, **kw: [{"tipo": "cruce_instructor", "mensaje": "choque martes"}],
    )
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    texto_llm = json.dumps({"resumen": "hay 1 cruce", "prioridades": []})

    def fake_post(url, headers=None, json=None, timeout=None):
        return _RespuestaFalsa(
            {"candidates": [{"content": {"parts": [{"text": texto_llm}]}}]}
        )

    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    respuesta = client.post("/api/v1/horarios/auditoria-cruces/resumen-ia", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["resumen"] == "hay 1 cruce"


def test_resumen_ia_sin_key_configurada_devuelve_503(client, db_session, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    monkeypatch.setattr(
        "app.api.v1.horarios.HorarioService.auditar_conflictos",
        lambda *a, **kw: [{"tipo": "cruce_instructor", "mensaje": "choque"}],
    )
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "")

    respuesta = client.post("/api/v1/horarios/auditoria-cruces/resumen-ia", headers=headers)

    assert respuesta.status_code == 503
    assert "GEMINI_API_KEY" not in respuesta.text or "no está configurada" in respuesta.text


def test_resumen_ia_requiere_autenticacion(client, db_session):
    respuesta = client.post("/api/v1/horarios/auditoria-cruces/resumen-ia")

    assert respuesta.status_code in (401, 403)
