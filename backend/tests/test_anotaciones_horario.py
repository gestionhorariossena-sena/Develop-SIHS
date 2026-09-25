from app.core.database import Base
from app.models.anotacion_horario import AnotacionHorario


def _crear_tablas_extra(db_session):
    Base.metadata.create_all(bind=db_session.bind, tables=[AnotacionHorario.__table__])


def test_crear_requiere_aprendiz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.post("/api/v1/anotaciones-horario/", json={"nota": "Traer pendrive"}, headers=headers)

    assert respuesta.status_code == 403


def test_crear_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/anotaciones-horario/",
        json={"nota": "Traer modelos ER normalizados en pendrive", "etiqueta": "Importante", "recordatorioActivo": True},
        headers=headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nota"] == "Traer modelos ER normalizados en pendrive"
    assert cuerpo["etiqueta"] == "Importante"
    assert cuerpo["recordatorioActivo"] is True
    assert cuerpo["idHorario"] is None


def test_crear_etiqueta_por_defecto_es_normal(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post("/api/v1/anotaciones-horario/", json={"nota": "Sin etiqueta"}, headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["etiqueta"] == "Normal"


def test_crear_etiqueta_invalida_da_422(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/anotaciones-horario/", json={"nota": "x", "etiqueta": "NoExiste"}, headers=headers
    )

    assert respuesta.status_code == 422


def test_mias_solo_devuelve_las_del_usuario_autenticado(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers_a = autenticar_como("Aprendiz")
    _, headers_b = autenticar_como("Aprendiz")

    client.post("/api/v1/anotaciones-horario/", json={"nota": "Nota de A"}, headers=headers_a)
    client.post("/api/v1/anotaciones-horario/", json={"nota": "Nota de B"}, headers=headers_b)

    respuesta = client.get("/api/v1/anotaciones-horario/mias", headers=headers_a)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["nota"] == "Nota de A"


def test_mias_requiere_aprendiz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/anotaciones-horario/mias", headers=headers)

    assert respuesta.status_code == 403


def test_actualizar_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")
    creada = client.post(
        "/api/v1/anotaciones-horario/", json={"nota": "Original"}, headers=headers
    ).json()

    respuesta = client.put(
        f"/api/v1/anotaciones-horario/{creada['idAnotacion']}",
        json={"nota": "Editada", "etiqueta": "Examen", "recordatorioActivo": True},
        headers=headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nota"] == "Editada"
    assert cuerpo["etiqueta"] == "Examen"
    assert cuerpo["recordatorioActivo"] is True


def test_actualizar_anotacion_de_otro_usuario_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers_a = autenticar_como("Aprendiz")
    _, headers_b = autenticar_como("Aprendiz")
    creada = client.post(
        "/api/v1/anotaciones-horario/", json={"nota": "De A"}, headers=headers_a
    ).json()

    respuesta = client.put(
        f"/api/v1/anotaciones-horario/{creada['idAnotacion']}",
        json={"nota": "Intento de B"},
        headers=headers_b,
    )

    assert respuesta.status_code == 404


def test_actualizar_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.put(
        "/api/v1/anotaciones-horario/9999", json={"nota": "No existe"}, headers=headers
    )

    assert respuesta.status_code == 404


def test_eliminar_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")
    creada = client.post(
        "/api/v1/anotaciones-horario/", json={"nota": "Para borrar"}, headers=headers
    ).json()

    respuesta = client.delete(f"/api/v1/anotaciones-horario/{creada['idAnotacion']}", headers=headers)

    assert respuesta.status_code == 200
    assert client.get("/api/v1/anotaciones-horario/mias", headers=headers).json() == []


def test_eliminar_anotacion_de_otro_usuario_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers_a = autenticar_como("Aprendiz")
    _, headers_b = autenticar_como("Aprendiz")
    creada = client.post(
        "/api/v1/anotaciones-horario/", json={"nota": "De A"}, headers=headers_a
    ).json()

    respuesta = client.delete(f"/api/v1/anotaciones-horario/{creada['idAnotacion']}", headers=headers_b)

    assert respuesta.status_code == 404
