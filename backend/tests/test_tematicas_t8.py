"""T-8 (SCRUM-139): pestaña "Temáticas" del administrador — vista agregada
de competencias y resultados, y borrado/alta que ya no revientan con 500."""

from datetime import time

from app.core.database import Base
from app.models.actividades_aprendizaje import ActividadAprendizaje
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.horario import Horario
from app.models.resultado_aprendizaje import ResultadoAprendizaje


def _tablas(db_session):
    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[ResultadoAprendizaje.__table__, ActividadAprendizaje.__table__],
    )


def _curriculo(db_session, crear_ficha):
    """Programa con dos competencias; la primera con dos resultados."""
    ficha = crear_ficha()
    competencia_a = CompetenciaFormacion(codigo="220501", descripcion="Programar software", idPrograma=ficha.idPrograma)
    competencia_b = CompetenciaFormacion(codigo="240201", descripcion="Comunicación", idPrograma=ficha.idPrograma)
    db_session.add_all([competencia_a, competencia_b])
    db_session.commit()
    ra_1 = ResultadoAprendizaje(codigo="RA-1", descripcion="Codificar módulos", idCompetencia=competencia_a.idCompetencia,
                                horasAsignadas=40, numeroFase=1)
    ra_2 = ResultadoAprendizaje(codigo="RA-2", descripcion="Probar el software", idCompetencia=competencia_a.idCompetencia,
                                horasAsignadas=20, numeroFase=2)
    db_session.add_all([ra_1, ra_2])
    db_session.commit()
    return ficha, competencia_a, competencia_b, ra_1, ra_2


def _usar_en_horario(db_session, ficha, resultado, crear_usuario):
    db_session.add(Horario(
        horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1, idTrimestre=ficha.idTrimestre,
        idAmbiente=1, idInstructor=crear_usuario(nombre="Instructor").idUsuario,
        idFicha=ficha.idFicha, idResultado=resultado.idResultado,
    ))
    db_session.commit()


def test_listar_tematicas_agrupa_resultados_por_competencia(
    client, db_session, autenticar_como, crear_ficha, crear_usuario
):
    _tablas(db_session)
    _, headers = autenticar_como("Administrador")
    ficha, competencia_a, competencia_b, ra_1, _ = _curriculo(db_session, crear_ficha)
    _usar_en_horario(db_session, ficha, ra_1, crear_usuario)

    respuesta = client.get("/api/v1/tematicas/", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert [c["codigo"] for c in cuerpo] == ["220501", "240201"]
    primera = cuerpo[0]
    assert primera["nombrePrograma"] is not None
    assert primera["totalHoras"] == 60
    assert [r["codigo"] for r in primera["resultados"]] == ["RA-1", "RA-2"]
    assert [r["horariosAsignados"] for r in primera["resultados"]] == [1, 0]
    assert cuerpo[1]["resultados"] == []
    assert cuerpo[1]["totalHoras"] == 0


def test_listar_tematicas_filtra_por_programa_y_busqueda(client, db_session, autenticar_como, crear_ficha):
    _tablas(db_session)
    _, headers = autenticar_como("Coordinador")
    ficha, *_ = _curriculo(db_session, crear_ficha)
    otra_ficha = crear_ficha()
    db_session.add(CompetenciaFormacion(codigo="999", descripcion="Otra", idPrograma=otra_ficha.idPrograma))
    db_session.commit()

    por_programa = client.get(f"/api/v1/tematicas/?id_programa={ficha.idPrograma}", headers=headers).json()
    assert {c["codigo"] for c in por_programa} == {"220501", "240201"}

    # La búsqueda que solo coincide con un resultado muestra solo ese.
    por_resultado = client.get("/api/v1/tematicas/?busqueda=probar", headers=headers).json()
    assert len(por_resultado) == 1
    assert [r["codigo"] for r in por_resultado[0]["resultados"]] == ["RA-2"]

    # La que coincide con la competencia la trae entera.
    por_competencia = client.get("/api/v1/tematicas/?busqueda=programar", headers=headers).json()
    assert len(por_competencia[0]["resultados"]) == 2


def test_listar_tematicas_exige_gestion(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    assert client.get("/api/v1/tematicas/", headers=headers).status_code == 403


def test_eliminar_resultado_usado_en_horario_da_409(
    client, db_session, autenticar_como, crear_ficha, crear_usuario
):
    _tablas(db_session)
    _, headers = autenticar_como("Administrador")
    ficha, _, _, ra_1, _ = _curriculo(db_session, crear_ficha)
    _usar_en_horario(db_session, ficha, ra_1, crear_usuario)

    respuesta = client.delete(f"/api/v1/resultados-aprendizaje/{ra_1.idResultado}", headers=headers)

    assert respuesta.status_code == 409
    assert "bloque" in respuesta.json()["detail"]
    assert db_session.get(ResultadoAprendizaje, ra_1.idResultado) is not None


def test_eliminar_resultado_libre_funciona(client, db_session, autenticar_como, crear_ficha):
    _tablas(db_session)
    _, headers = autenticar_como("Administrador")
    *_, ra_2 = _curriculo(db_session, crear_ficha)

    respuesta = client.delete(f"/api/v1/resultados-aprendizaje/{ra_2.idResultado}", headers=headers)

    assert respuesta.status_code == 200


def test_eliminar_competencia_con_resultados_da_409(client, db_session, autenticar_como, crear_ficha):
    _tablas(db_session)
    _, headers = autenticar_como("Administrador")
    _, competencia_a, competencia_b, _, _ = _curriculo(db_session, crear_ficha)

    con_resultados = client.delete(f"/api/v1/competencias-formacion/{competencia_a.idCompetencia}", headers=headers)
    vacia = client.delete(f"/api/v1/competencias-formacion/{competencia_b.idCompetencia}", headers=headers)

    assert con_resultados.status_code == 409
    assert "2 resultado" in con_resultados.json()["detail"]
    assert vacia.status_code == 200


def test_crear_con_referencias_inexistentes_da_422(client, db_session, autenticar_como):
    _tablas(db_session)
    _, headers = autenticar_como("Administrador")

    competencia = client.post(
        "/api/v1/competencias-formacion/",
        json={"codigo": "X", "descripcion": "Sin programa", "idPrograma": 9999},
        headers=headers,
    )
    resultado = client.post(
        "/api/v1/resultados-aprendizaje/",
        json={"codigo": "RA-X", "descripcion": "Sin competencia", "idCompetencia": 9999},
        headers=headers,
    )

    assert competencia.status_code == 422
    assert "programa" in competencia.json()["detail"]
    assert resultado.status_code == 422
    assert "competencia" in resultado.json()["detail"]
