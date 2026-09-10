"""Cableado de los 3 endpoints del asistente -- la lógica ya se prueba a
fondo en test_asistente_horario_service.py, acá solo auth + forma de la
respuesta HTTP."""

import json
from io import BytesIO

import openpyxl

from tests.test_asistente_horario_service import _RespuestaFalsa, _crear_tablas_extra


def _xlsx_simple() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["FICHA", "PROGRAMA"])
    ws.append([100, "ADSO"])
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def test_importar_requiere_autenticacion(client, db_session):
    respuesta = client.post(
        "/api/v1/horarios/asistente/importar",
        files={"archivo": ("f.xlsx", _xlsx_simple(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert respuesta.status_code in (401, 403)


def test_importar_devuelve_vista_previa(client, db_session, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    payload = {"FICHA": {"campo": "ficha", "confianza": 1.0}, "PROGRAMA": {"campo": "programa", "confianza": 1.0}}
    texto_llm = json.dumps(payload)

    def fake_post(url, headers=None, json=None, timeout=None):
        return _RespuestaFalsa({"candidates": [{"content": {"parts": [{"text": texto_llm}]}}]})

    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    respuesta = client.post(
        "/api/v1/horarios/asistente/importar",
        files={"archivo": ("f.xlsx", _xlsx_simple(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["totalFilas"] == 1
    assert cuerpo["filas"][0]["idFicha"] == 100


def test_generar_propuesta_sin_fichas_no_revienta(client, db_session, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/horarios/asistente/generar-propuesta",
        json={"idTrimestre": 1, "idsFicha": [], "jornada": "MAÑANA"},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["bloques"] == []


def test_generar_propuesta_jornada_invalida_devuelve_422(client, db_session, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/horarios/asistente/generar-propuesta",
        json={"idTrimestre": 1, "idsFicha": [1], "jornada": "MADRUGADA"},
        headers=headers,
    )

    assert respuesta.status_code == 422


def test_preguntar_devuelve_respuesta(client, db_session, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    texto_llm = json.dumps({"respuesta": "El Lab 308 está libre a esa hora."})

    def fake_post(url, headers=None, json=None, timeout=None):
        return _RespuestaFalsa({"candidates": [{"content": {"parts": [{"text": texto_llm}]}}]})

    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    monkeypatch.setattr("app.ai.client.httpx.post", fake_post)

    respuesta = client.post(
        "/api/v1/horarios/asistente/preguntar",
        json={"pregunta": "¿Por qué hay un choque?", "contexto": "Ficha 100, Lab 304, martes 12-18."},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert "Lab 308" in respuesta.json()["respuesta"]


def test_preguntar_sin_key_devuelve_503(client, db_session, autenticar_como, monkeypatch):
    _, headers = autenticar_como("Coordinador")
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "")

    respuesta = client.post(
        "/api/v1/horarios/asistente/preguntar",
        json={"pregunta": "¿Por qué?", "contexto": "..."},
        headers=headers,
    )

    assert respuesta.status_code == 503
