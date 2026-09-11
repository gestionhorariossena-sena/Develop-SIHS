from app.core.database import Base
from app.models.aviso import Aviso
from app.models.sede import Sede


def _crear_tablas_extra(db_session):
    Base.metadata.create_all(bind=db_session.bind, tables=[Sede.__table__, Aviso.__table__])


def test_crear_requiere_coordinador_o_administrador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={"titulo": "Cambio de aula", "cuerpo": "La clase se traslada", "categoria": "reprog"},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_crear_caso_feliz_coordinador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={"titulo": "Cambio de aula", "cuerpo": "La clase se traslada al ambiente 302", "categoria": "reprog"},
        headers=headers,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["titulo"] == "Cambio de aula"
    assert cuerpo["categoria"] == "reprog"
    assert cuerpo["idFicha"] is None
    assert cuerpo["idSede"] is None
    assert cuerpo["publicadorNombre"]


def test_crear_caso_feliz_administrador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={"titulo": "Comunicado", "cuerpo": "Aviso institucional", "categoria": "extraordinario"},
        headers=headers,
    )

    assert respuesta.status_code == 201


def test_crear_categoria_invalida_da_422(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={"titulo": "x", "cuerpo": "y", "categoria": "no-existe"},
        headers=headers,
    )

    assert respuesta.status_code == 422


def test_crear_con_ficha_y_sede(client, db_session, autenticar_como, crear_ficha):
    _crear_tablas_extra(db_session)
    ficha = crear_ficha(codigo="2874521")
    sede = Sede(nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    db_session.add(sede)
    db_session.commit()
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/avisos/",
        json={
            "titulo": "Clase cancelada",
            "cuerpo": "No hay clase hoy",
            "categoria": "eventos",
            "idFicha": ficha.idFicha,
            "idSede": sede.id,
        },
        headers=headers,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["idFicha"] == ficha.idFicha
    assert cuerpo["idSede"] == sede.id


def test_leer_avisos_cualquier_usuario_autenticado(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers_coord = autenticar_como("Coordinador")
    client.post(
        "/api/v1/avisos/",
        json={"titulo": "Evento", "cuerpo": "Feria de servicio", "categoria": "eventos"},
        headers=headers_coord,
    )

    _, headers_aprendiz = autenticar_como("Aprendiz")
    respuesta = client.get("/api/v1/avisos/", headers=headers_aprendiz)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1


def test_filtro_por_categoria(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    client.post(
        "/api/v1/avisos/", json={"titulo": "A", "cuerpo": "a", "categoria": "eventos"}, headers=headers
    )
    client.post(
        "/api/v1/avisos/", json={"titulo": "B", "cuerpo": "b", "categoria": "sede"}, headers=headers
    )

    respuesta = client.get("/api/v1/avisos/?categoria=sede", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["titulo"] == "B"


def test_filtro_por_id_ficha(client, db_session, autenticar_como, crear_ficha):
    _crear_tablas_extra(db_session)
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Coordinador")
    client.post(
        "/api/v1/avisos/",
        json={"titulo": "General", "cuerpo": "a", "categoria": "eventos"},
        headers=headers,
    )
    client.post(
        "/api/v1/avisos/",
        json={"titulo": "De la ficha", "cuerpo": "b", "categoria": "reprog", "idFicha": ficha.idFicha},
        headers=headers,
    )

    respuesta = client.get(f"/api/v1/avisos/?idFicha={ficha.idFicha}", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["titulo"] == "De la ficha"


def test_actualizar_requiere_coordinador_o_administrador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers_coord = autenticar_como("Coordinador")
    creado = client.post(
        "/api/v1/avisos/", json={"titulo": "Original", "cuerpo": "x", "categoria": "eventos"}, headers=headers_coord
    ).json()

    _, headers_aprendiz = autenticar_como("Aprendiz")
    respuesta = client.put(
        f"/api/v1/avisos/{creado['idAviso']}",
        json={"titulo": "Editado", "cuerpo": "y", "categoria": "sede"},
        headers=headers_aprendiz,
    )

    assert respuesta.status_code == 403


def test_actualizar_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    creado = client.post(
        "/api/v1/avisos/", json={"titulo": "Original", "cuerpo": "x", "categoria": "eventos"}, headers=headers
    ).json()

    respuesta = client.put(
        f"/api/v1/avisos/{creado['idAviso']}",
        json={"titulo": "Editado", "cuerpo": "y", "categoria": "sede"},
        headers=headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["titulo"] == "Editado"
    assert cuerpo["categoria"] == "sede"


def test_actualizar_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.put(
        "/api/v1/avisos/9999", json={"titulo": "x", "cuerpo": "y", "categoria": "eventos"}, headers=headers
    )

    assert respuesta.status_code == 404


def test_eliminar_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Administrador")
    creado = client.post(
        "/api/v1/avisos/", json={"titulo": "Para borrar", "cuerpo": "x", "categoria": "eventos"}, headers=headers
    ).json()

    respuesta = client.delete(f"/api/v1/avisos/{creado['idAviso']}", headers=headers)

    assert respuesta.status_code == 200
    assert client.get("/api/v1/avisos/", headers=headers).json() == []


def test_eliminar_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Administrador")

    respuesta = client.delete("/api/v1/avisos/9999", headers=headers)

    assert respuesta.status_code == 404
