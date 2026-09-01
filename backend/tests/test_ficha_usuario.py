def test_vincular_requiere_aprendiz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 403


def test_vincular_caso_feliz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["idFicha"] == ficha.idFicha
    assert cuerpo["codigoFicha"] == ficha.codigoFicha


def test_vincular_ficha_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": "0000000"}, headers=headers
    )

    assert respuesta.status_code == 404


def test_vincular_usuario_ya_vinculado_da_400(client, autenticar_como, crear_ficha):
    ficha_1 = crear_ficha(codigo="2874521")
    ficha_2 = crear_ficha(codigo="3068356")
    _, headers = autenticar_como("Aprendiz")

    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha_1.codigoFicha}, headers=headers)
    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha_2.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 400


def test_mi_ficha_requiere_aprendiz(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 403


def test_mi_ficha_caso_feliz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["idFicha"] == ficha.idFicha


def test_mi_ficha_sin_vincular_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 404
