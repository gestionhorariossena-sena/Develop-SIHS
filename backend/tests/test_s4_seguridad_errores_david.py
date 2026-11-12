from app.models.jornada import Jornada


def test_crear_ficha_sin_autenticacion_devuelve_401(client):
    # Arrange
    payload = {"codigoFicha": "S4-401", "idPrograma": 1, "idTrimestre": 1}

    # Act
    respuesta = client.post("/api/v1/fichas/", json=payload)

    # Assert
    assert respuesta.status_code == 401
    assert respuesta.json() == {"detail": "Not authenticated"}
    assert respuesta.headers["content-type"].startswith("application/json")


def test_crear_ficha_con_rol_sin_permiso_devuelve_403(
    client, autenticar_como, crear_ficha
):
    # Arrange
    ficha_base = crear_ficha(codigo="S4-BASE")
    _, headers = autenticar_como("Aprendiz")
    payload = {
        "codigoFicha": "S4-403",
        "idPrograma": ficha_base.idPrograma,
        "idTrimestre": ficha_base.idTrimestre,
    }

    # Act
    respuesta = client.post("/api/v1/fichas/", json=payload, headers=headers)

    # Assert
    assert respuesta.status_code == 403
    assert respuesta.json() == {"detail": "No autorizado"}
    assert respuesta.headers["content-type"].startswith("application/json")


def test_listar_fichas_como_instructor_devuelve_contrato_json(
    client, db_session, autenticar_como, crear_ficha
):
    # Arrange
    Jornada.__table__.create(bind=db_session.bind, checkfirst=True)
    ficha = crear_ficha(codigo="S4-LECTURA")
    _, headers = autenticar_como("Instructor")

    # Act
    respuesta = client.get("/api/v1/fichas/", headers=headers)

    # Assert
    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("application/json")
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert set(cuerpo[0]) == {
        "idFicha",
        "codigoFicha",
        "idPrograma",
        "idTrimestre",
        "idSede",
        "fechaInicioLectiva",
        "fechaFinLectiva",
        "fechaInicioProductiva",
        "fechaFinProductiva",
        "faseActual",
        "programa",
        "trimestre",
        "sede",
        "aprendicesTotales",
        "jornadas",
    }
    assert cuerpo[0]["idFicha"] == ficha.idFicha
    assert cuerpo[0]["codigoFicha"] == "S4-LECTURA"


def test_crear_ficha_con_json_malformado_devuelve_422_seguro(
    client, autenticar_como
):
    # Arrange
    _, headers = autenticar_como("Administrador")
    headers["Content-Type"] = "application/json"

    # Act
    respuesta = client.post(
        "/api/v1/fichas/",
        content='{"codigoFicha":',
        headers=headers,
    )

    # Assert
    assert respuesta.status_code == 422
    assert respuesta.headers["content-type"].startswith("application/json")
    assert isinstance(respuesta.json()["detail"], list)
    assert "Traceback" not in respuesta.text
    assert "sqlalchemy" not in respuesta.text.lower()
    assert "supabase" not in respuesta.text.lower()
