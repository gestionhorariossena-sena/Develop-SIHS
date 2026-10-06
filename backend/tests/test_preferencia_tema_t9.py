"""T-9 (SCRUM-139): el tema de la interfaz se guarda por usuario en el
backend en vez de solo en el localStorage del navegador."""

import pytest


def test_perfil_sin_preferencia_devuelve_null(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/usuarios/me", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["preferenciaTema"] is None


@pytest.mark.parametrize("tema", ["claro", "oscuro", "sistema"])
def test_guardar_preferencia_de_tema(client, autenticar_como, db_session, tema):
    usuario, headers = autenticar_como("Instructor")

    respuesta = client.patch("/api/v1/usuarios/me/preferencias", json={"tema": tema}, headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["preferenciaTema"] == tema
    db_session.refresh(usuario)
    assert usuario.preferenciaTema == tema
    assert client.get("/api/v1/usuarios/me", headers=headers).json()["preferenciaTema"] == tema


def test_tema_invalido_da_422(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.patch("/api/v1/usuarios/me/preferencias", json={"tema": "azul"}, headers=headers)

    assert respuesta.status_code == 422


def test_preferencias_exige_sesion(client):
    assert client.patch("/api/v1/usuarios/me/preferencias", json={"tema": "oscuro"}).status_code in (401, 403)
