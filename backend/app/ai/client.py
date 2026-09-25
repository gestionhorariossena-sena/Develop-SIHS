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
import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_MODELO = "gemini-3.5-flash-lite"
_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODELO}:generateContent"

# Medido en vivo el 2026-09-24 con la hoja PE-04 real de PROGRAMACIÓN
# CGMLTI (52 encabezados): Gemini tardó 28.9s en responder. Con el
# timeout anterior de 30s el asistente era una carrera a milisegundos --
# el mismo archivo pasaba una vez y a la siguiente fallaba. La latencia
# crece con la cantidad de columnas porque el modelo emite una entrada
# JSON por encabezado, así que el margen se calcula sobre ese peor caso
# real, no sobre el promedio.
_TIMEOUT_CONEXION = 10.0
_TIMEOUT_LECTURA = 90.0

# Reintento solo para fallos transitorios del lado de Google (cuota por
# minuto, capacidad). NO se reintenta un timeout: ya consumió su
# presupuesto y repetirlo solo haría esperar el doble a quien está
# mirando la pantalla.
_ESTADOS_REINTENTABLES = {429, 500, 502, 503, 504}
_ESPERA_REINTENTO = 2.0


class AIServiceError(Exception):
    """La IA no está configurada, no respondió, o respondió algo que
    `app/ai/schemas.py` no pudo validar. Quien llama decide qué hacer --
    la capa de IA nunca debe tumbar un flujo que puede seguir sin ella.

    `motivo` distingue causas que para quien usa la app son problemas
    distintos y con salidas distintas: "no_configurada" la arregla el
    administrador poniendo la key, "timeout" se arregla reintentando.
    Hasta el 2026-09-24 todo llegaba al frontend como el mismo 503 y la
    pantalla decía "falta configurarlo en el servidor" incluso cuando la
    key estaba perfectamente puesta y lo que pasó fue que Gemini tardó.
    """

    def __init__(self, mensaje: str, motivo: str = "desconocido") -> None:
        super().__init__(mensaje)
        self.motivo = motivo


def generar_json(prompt: str) -> dict:
    if not settings.gemini_api_key:
        raise AIServiceError(
            "GEMINI_API_KEY no está configurada -- la capa de IA está apagada.",
            motivo="no_configurada",
        )

    intentos = 2
    for intento in range(1, intentos + 1):
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
                timeout=httpx.Timeout(_TIMEOUT_LECTURA, connect=_TIMEOUT_CONEXION),
            )
            respuesta.raise_for_status()
            break
        except httpx.TimeoutException as exc:
            raise AIServiceError(
                f"Gemini no respondió en {_TIMEOUT_LECTURA:.0f} segundos.",
                motivo="timeout",
            ) from exc
        except httpx.HTTPStatusError as exc:
            estado = exc.response.status_code
            if estado in _ESTADOS_REINTENTABLES and intento < intentos:
                logger.warning("Gemini respondió %s, reintentando una vez.", estado)
                time.sleep(_ESPERA_REINTENTO)
                continue
            # Mensaje propio (no el de httpx) para no arrastrar la URL con la key.
            motivo = "credenciales" if estado in (401, 403) else "respuesta_http"
            raise AIServiceError(
                f"Gemini respondió {estado}: {exc.response.text[:300]}",
                motivo=motivo,
            ) from exc
        except httpx.HTTPError as exc:
            if intento < intentos:
                logger.warning("No se pudo contactar a Gemini (%s), reintentando una vez.", exc)
                time.sleep(_ESPERA_REINTENTO)
                continue
            raise AIServiceError(
                f"No se pudo contactar a Gemini: {exc}", motivo="conexion"
            ) from exc

    cuerpo = respuesta.json()
    try:
        texto = cuerpo["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise AIServiceError(
            f"Respuesta inesperada de Gemini: {cuerpo}", motivo="respuesta_invalida"
        ) from exc

    try:
        return json.loads(texto)
    except json.JSONDecodeError as exc:
        raise AIServiceError(
            f"Gemini no devolvió JSON válido: {texto!r}", motivo="respuesta_invalida"
        ) from exc
