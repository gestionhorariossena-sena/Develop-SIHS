"""Los dobles de Gemini y Supabase deben mantener las pruebas fuera de la red."""

import pytest
from fastapi import HTTPException

from app.ai.client import generar_json
from app.core.supabase_auth import _verificar_token_supabase


def test_gemini_responde_json_estructurado_sin_red(fake_gemini):
    llamadas = fake_gemini({"columnas": {"FICHA": {"campo": "ficha", "confianza": 1.0}}})

    resultado = generar_json("Clasifica el encabezado FICHA")

    assert resultado == {"columnas": {"FICHA": {"campo": "ficha", "confianza": 1.0}}}
    assert len(llamadas) == 1
    assert llamadas[0]["headers"]["x-goog-api-key"] == "gemini-test-key"
    assert llamadas[0]["json"]["contents"][0]["parts"][0]["text"] == "Clasifica el encabezado FICHA"


def test_verificacion_supabase_acepta_solo_tokens_registrados(fake_supabase):
    fake_supabase("token-prueba", id="d297ebbc-5b80-42ce-9c20-c332e6cc59ea", email="prueba@example.com")

    assert _verificar_token_supabase("token-prueba")["email"] == "prueba@example.com"

    with pytest.raises(HTTPException) as error:
        _verificar_token_supabase("token-desconocido")

    assert error.value.status_code == 401


def test_login_por_documento_simula_el_intercambio_con_supabase(
    client,
    db_session,
    crear_usuario,
    monkeypatch,
):
    usuario = crear_usuario(nombre="Coordinador", email="coordinador@example.com")
    usuario.numeroDocumento = "12345678"
    db_session.commit()
    llamadas = []

    class RespuestaAuthFalsa:
        status_code = 200

        @staticmethod
        def json():
            return {
                "access_token": "access-token-falso",
                "refresh_token": "refresh-token-falso",
                "token_type": "bearer",
                "expires_in": 3600,
            }

    def fake_post(url, **kwargs):
        llamadas.append((url, kwargs))
        return RespuestaAuthFalsa()

    monkeypatch.setattr("app.api.v1.usuarios.httpx.post", fake_post)

    respuesta = client.post(
        "/api/v1/usuarios/login-documento",
        json={"numeroDocumento": "12345678", "password": "clave-de-prueba"},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["access_token"] == "access-token-falso"
    assert llamadas[0][1]["json"] == {
        "email": "coordinador@example.com",
        "password": "clave-de-prueba",
    }


def test_login_por_documento_rechazado_no_retorna_tokens(
    client,
    db_session,
    crear_usuario,
    monkeypatch,
):
    usuario = crear_usuario(nombre="Instructor", email="instructor@example.com")
    usuario.numeroDocumento = "87654321"
    db_session.commit()

    class RespuestaAuthRechazada:
        status_code = 400

    monkeypatch.setattr(
        "app.api.v1.usuarios.httpx.post",
        lambda *args, **kwargs: RespuestaAuthRechazada(),
    )

    respuesta = client.post(
        "/api/v1/usuarios/login-documento",
        json={"numeroDocumento": "87654321", "password": "incorrecta"},
    )

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "Credenciales incorrectas."
