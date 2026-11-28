"""Errores del importador CSV de fichas: causas legibles, sin errores 500."""
from datetime import date

from app.models.coordinacion import Coordinacion
from app.models.programa import Programa
from app.models.trimestre import Trimestre


def _catalogos(db):
    db.add(Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología"))
    db.add(Programa(idPrograma=7, codigoPrograma="DEMO-ADSO", nombrePrograma="ADSO piloto", idCoordinacion=1))
    db.add(Trimestre(idTrimestre=9, nombre="Demo vigente", fechaInicio=date(2026, 10, 1), fechaFin=date(2026, 12, 30), estado="activo"))
    db.commit()


def test_crea_ficha_con_catalogos_locales(client, db_session, autenticar_como):
    _catalogos(db_session)
    _, headers = autenticar_como("Administrador")
    respuesta = client.post("/api/v1/fichas/", headers=headers, json={
        "codigoFicha": "3407178", "idPrograma": 7, "idTrimestre": 9
    })
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["codigoFicha"] == "3407178"


def test_importacion_no_duplica_ficha(client, db_session, autenticar_como):
    _catalogos(db_session)
    _, headers = autenticar_como("Administrador")
    payload = {"codigoFicha": "3407178", "idPrograma": 7, "idTrimestre": 9}
    assert client.post("/api/v1/fichas/", headers=headers, json=payload).status_code == 200
    duplicado = client.post("/api/v1/fichas/", headers=headers, json=payload)
    assert duplicado.status_code == 409
    assert "ya existe" in duplicado.json()["detail"].lower()


def test_referencia_inexistente_da_422_en_vez_de_500(client, db_session, autenticar_como):
    _catalogos(db_session)
    _, headers = autenticar_como("Administrador")
    respuesta = client.post("/api/v1/fichas/", headers=headers, json={
        "codigoFicha": "3407179", "idPrograma": 9999, "idTrimestre": 9
    })
    assert respuesta.status_code == 422
    assert "programa" in respuesta.json()["detail"].lower()


def test_coordinador_sin_permiso_obtiene_403_no_500(client, db_session, autenticar_como):
    _catalogos(db_session)
    _, headers = autenticar_como("Coordinador")
    respuesta = client.post("/api/v1/fichas/", headers=headers, json={
        "codigoFicha": "3407179", "idPrograma": 7, "idTrimestre": 9
    })
    assert respuesta.status_code == 403
