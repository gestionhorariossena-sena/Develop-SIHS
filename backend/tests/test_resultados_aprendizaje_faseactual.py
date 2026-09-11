"""Regresión: ResultadoAprendizajeService.crear/.actualizar armaban el
modelo ORM con una lista fija de campos que no incluía numeroFase -- se
descubrió al reimportar currículo real con fase (curriculo_service ya
la etiquetaba bien) y ver que quedaba en null en la BD: el schema
Pydantic la traía, el servicio la descartaba en silencio."""

from app.core.database import Base
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje


def _crear_competencia(db_session):
    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[Coordinacion.__table__, Programa.__table__, CompetenciaFormacion.__table__, ResultadoAprendizaje.__table__],
    )
    db_session.add(Coordinacion(idCoordinacion=1, nombreCoordinacion="Demo"))
    db_session.add(Programa(idPrograma=1, codigoPrograma="P1", nombrePrograma="ADSO", activo=True, idCoordinacion=1))
    db_session.add(CompetenciaFormacion(idCompetencia=1, descripcion="Competencia demo", idPrograma=1))
    db_session.commit()


def test_crear_resultado_persiste_numero_fase(client, db_session, autenticar_como):
    _crear_competencia(db_session)
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/resultados-aprendizaje/",
        json={"descripcion": "Resultado demo", "idCompetencia": 1, "numeroFase": 2},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["numeroFase"] == 2


def test_actualizar_resultado_persiste_numero_fase(client, db_session, autenticar_como):
    _crear_competencia(db_session)
    _, headers = autenticar_como("Administrador")
    creado = client.post(
        "/api/v1/resultados-aprendizaje/",
        json={"descripcion": "Resultado demo", "idCompetencia": 1},
        headers=headers,
    ).json()
    assert creado["numeroFase"] is None

    respuesta = client.put(
        f"/api/v1/resultados-aprendizaje/{creado['idResultado']}",
        json={"descripcion": "Resultado demo", "idCompetencia": 1, "numeroFase": 4},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["numeroFase"] == 4
