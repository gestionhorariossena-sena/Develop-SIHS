from app.models.ficha_usuario import FichaUsuario


def test_vocero_ficha_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/fichas/99999/vocero", headers=headers)

    assert respuesta.status_code == 404


def test_vocero_ficha_sin_vocero_devuelve_lista_vacia(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/fichas/{ficha.idFicha}/vocero", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_vocero_ficha_devuelve_vocero_y_subvocero(client, autenticar_como, crear_ficha, crear_usuario, db_session):
    ficha = crear_ficha(codigo="2874521")
    vocero = crear_usuario(nombre="Laura Gómez", email="laura@example.com")
    subvocero = crear_usuario(nombre="Carlos Ruiz", email="carlos@example.com")
    aprendiz_normal = crear_usuario(nombre="Ana Normal", email="ana@example.com")

    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=vocero.idUsuario, rolEnFicha="vocero"))
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=subvocero.idUsuario, rolEnFicha="subvocero"))
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz_normal.idUsuario, rolEnFicha=None))
    db_session.commit()

    # Un instructor autenticado, sin rol de gestión, también puede verlo.
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/fichas/{ficha.idFicha}/vocero", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 2

    roles = {fila["rolEnFicha"] for fila in cuerpo}
    assert roles == {"vocero", "subvocero"}

    nombres = {fila["nombre"] for fila in cuerpo}
    assert nombres == {"Laura Gómez", "Carlos Ruiz"}
