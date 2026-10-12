"""E2E semana 1: un paso real del asistente de horarios contra Gemini.

Recorre la ruta completa (HTTP -> auth -> responder_pregunta -> app.ai.client
-> API de Gemini) con la IA de verdad. Es lenta y depende de red y de cuota,
así que NO corre por defecto ni en CI: se pide a propósito.

    RUN_GEMINI_E2E=1 pytest tests/test_e2e_asistente_gemini.py -v

La clave sale de backend/.env (GEMINI_API_KEY). En la semana 2 este paso se
simula; esta corrida es la única que habla con la IA real.
"""

import os

import pytest

from app.core.config import settings

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_GEMINI_E2E") != "1" or not settings.gemini_api_key,
    reason="E2E con Gemini real: exportar RUN_GEMINI_E2E=1 y tener GEMINI_API_KEY",
)


def test_preguntar_al_asistente_devuelve_una_respuesta_real_de_gemini(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/horarios/asistente/preguntar",
        json={
            "pregunta": "¿Por qué una ficha podría no quedar programada?",
            "contexto": "Propuesta con 0 bloques para el período académico 1, jornada MAÑANA.",
        },
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert set(cuerpo) == {"respuesta"}
    # Lo que la interfaz pinta tal cual: texto no vacío, en lenguaje natural.
    assert isinstance(cuerpo["respuesta"], str)
    assert len(cuerpo["respuesta"].strip()) > 20
