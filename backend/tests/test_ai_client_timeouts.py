"""El asistente con IA fallaba en vivo por timeout y la pantalla lo
reportaba como "falta configurarlo en el servidor" (2026-09-24): clasificar
las 52 columnas de un Excel real le toma a Gemini ~29s contra un timeout
que estaba en 30s. Estos tests fijan las dos partes del arreglo -- el
margen de espera, y que cada causa viaje con su propio `motivo` para que
el frontend no mande a nadie a reportar un problema que no existe.

Mockea httpx.post: no llama a la API real ni gasta tokens en CI."""

import json

import httpx
import pytest

from app.ai.client import _TIMEOUT_LECTURA, AIServiceError, generar_json


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


def test_sin_key_el_motivo_es_no_configurada(monkeypatch):
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "")

    with pytest.raises(AIServiceError) as exc:
        generar_json("cualquier prompt")

    assert exc.value.motivo == "no_configurada"


def test_timeout_no_se_confunde_con_falta_de_configuracion(monkeypatch):
    """El caso exacto del 2026-09-24: la key está puesta y Gemini tarda."""
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")

    def _tarda_demasiado(*args, **kwargs):
        raise httpx.ReadTimeout("The read operation timed out")

    monkeypatch.setattr("app.ai.client.httpx.post", _tarda_demasiado)

    with pytest.raises(AIServiceError) as exc:
        generar_json("cualquier prompt")

    assert exc.value.motivo == "timeout"
    assert exc.value.motivo != "no_configurada"


def test_espera_a_gemini_con_margen_sobre_el_peor_caso_medido():
    """29s medidos con la hoja PE-04 real (52 encabezados). El timeout
    tiene que dejar margen sobre eso, no empatarlo: con 30s el mismo
    archivo pasaba una vez y fallaba a la siguiente."""
    assert _TIMEOUT_LECTURA >= 60


def test_no_reintenta_tras_un_timeout(monkeypatch):
    """Reintentar algo que ya esperó su presupuesto completo solo hace
    esperar el doble a quien está mirando la pantalla."""
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    llamadas = []

    def _tarda_demasiado(*args, **kwargs):
        llamadas.append(1)
        raise httpx.ReadTimeout("The read operation timed out")

    monkeypatch.setattr("app.ai.client.httpx.post", _tarda_demasiado)

    with pytest.raises(AIServiceError):
        generar_json("cualquier prompt")

    assert len(llamadas) == 1


def test_reintenta_una_vez_si_gemini_responde_429(monkeypatch):
    """Cuota por minuto agotada: es transitorio y el reintento lo salva."""
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-de-prueba")
    monkeypatch.setattr("app.ai.client.time.sleep", lambda _: None)
    respuestas = [
        _RespuestaFalsa(429, texto="rate limit"),
        _RespuestaFalsa(200, {"candidates": [{"content": {"parts": [{"text": json.dumps({"ok": True})}]}}]}),
    ]

    def _post(*args, **kwargs):
        return respuestas.pop(0)

    monkeypatch.setattr("app.ai.client.httpx.post", _post)

    assert generar_json("cualquier prompt") == {"ok": True}
    assert respuestas == []


def test_credenciales_rechazadas_tienen_su_propio_motivo(monkeypatch):
    """403 es "la key está mal", no "la key no está" -- son avisos
    distintos para el administrador."""
    monkeypatch.setattr("app.ai.client.settings.gemini_api_key", "key-invalida")
    monkeypatch.setattr("app.ai.client.httpx.post", lambda *a, **k: _RespuestaFalsa(403, texto="forbidden"))

    with pytest.raises(AIServiceError) as exc:
        generar_json("cualquier prompt")

    assert exc.value.motivo == "credenciales"
