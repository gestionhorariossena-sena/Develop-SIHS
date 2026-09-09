"""Cliente genérico de IA (Gemini). Fase 1 de PLAN_INTEGRACION_IA.md.

Decisión de arquitectura: `httpx.post` directo, mismo patrón que
`credencial_temporal_service.py` -- sin SDK de Google adicional que
mantener, y mockeable con `monkeypatch.setattr("app.ai.client.httpx.post",
...)` en los tests sin llamar a la API real. Este módulo solo sabe hablar
con Gemini; las tareas específicas (`app/ai/tasks/`) arman el prompt y
validan la respuesta con `app/ai/schemas.py`.

La API key va en el header `x-goog-api-key`, no en la query string:
Gemini soporta ambos, pero una key en la URL termina apareciendo en logs
de acceso y en el mensaje de cualquier excepción HTTP que incluya la URL
del request -- el header evita ese riesgo de fuga por completo.
"""

from __future__ import annotations

import json

import httpx

from app.core.config import settings

_MODELO = "gemini-3.5-flash-lite"
_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODELO}:generateContent"


class AIServiceError(Exception):
    """La IA no está configurada, no respondió, o respondió algo que
    `app/ai/schemas.py` no pudo validar. Quien llama decide qué hacer --
    la capa de IA nunca debe tumbar un flujo que puede seguir sin ella."""


def generar_json(prompt: str) -> dict:
    if not settings.gemini_api_key:
        raise AIServiceError(
            "GEMINI_API_KEY no está configurada -- la capa de IA está apagada."
        )

    try:
        respuesta = httpx.post(
            _URL,
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0,
                },
            },
            timeout=30,
        )
        respuesta.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Mensaje propio (no el de httpx) para no arrastrar la URL con la key.
        raise AIServiceError(
            f"Gemini respondió {exc.response.status_code}: {exc.response.text[:300]}"
        ) from exc
    except httpx.HTTPError as exc:
        raise AIServiceError(f"No se pudo contactar a Gemini: {exc}") from exc

    cuerpo = respuesta.json()
    try:
        texto = cuerpo["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise AIServiceError(f"Respuesta inesperada de Gemini: {cuerpo}") from exc

    try:
        return json.loads(texto)
    except json.JSONDecodeError as exc:
        raise AIServiceError(f"Gemini no devolvió JSON válido: {texto!r}") from exc
