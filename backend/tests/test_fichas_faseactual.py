"""Regresión: FichaService.crear/.actualizar armaban el modelo ORM con
una lista fija de campos que no incluía faseActual (el schema Pydantic
sí lo traía, pero se perdía en silencio al construir el objeto) -- el
mismo bug real que se encontró en ResultadoAprendizajeService al probar
el filtro por fase con datos reales. Prueba a nivel de API completa
porque el bug estaba justo en la frontera schema -> servicio -> modelo."""

from datetime import date

from app.models.coordinacion import Coordinacion
from app.models.programa import Programa
from app.models.trimestre import Trimestre


def _catalogo(db_session):
    db_session.add(Coordinacion(idCoordinacion=1, nombreCoordinacion="Demo"))
    db_session.add(Programa(idPrograma=1, codigoPrograma="P1", nombrePrograma="ADSO", activo=True, idCoordinacion=1))
    db_session.add(Trimestre(idTrimestre=1, nombre="2026-3", fechaInicio=date(2026, 7, 1), fechaFin=date(2026, 9, 30), estado="activo"))
    db_session.commit()


def test_crear_ficha_persiste_fase_actual(client, db_session, autenticar_como):
    _catalogo(db_session)
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/fichas/",
        json={"codigoFicha": "100", "idPrograma": 1, "idTrimestre": 1, "faseActual": 2},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["faseActual"] == 2


def test_actualizar_ficha_persiste_fase_actual(client, db_session, autenticar_como):
    _catalogo(db_session)
    _, headers = autenticar_como("Administrador")
    creada = client.post(
        "/api/v1/fichas/",
        json={"codigoFicha": "100", "idPrograma": 1, "idTrimestre": 1},
        headers=headers,
    ).json()
    assert creada["faseActual"] is None

    respuesta = client.put(
        f"/api/v1/fichas/{creada['idFicha']}",
        json={"codigoFicha": "100", "idPrograma": 1, "idTrimestre": 1, "faseActual": 3},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["faseActual"] == 3
