import uuid
from datetime import date, time

from app.core.database import Base
from app.models.ambiente import Ambiente
from app.models.auditoria import Auditoria
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_horario(db_session):
    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Sede.__table__,
        Ambiente.__table__,
        Jornada.__table__,
        DiaSemana.__table__,
        CompetenciaFormacion.__table__,
        Ficha.__table__,
        ResultadoAprendizaje.__table__,
        Usuario.__table__,
        Horario.__table__,
        horario_dia,
        Auditoria.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _preparar_datos(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Coordinación de prueba")
    programa = Programa(
        idPrograma=1,
        codigoPrograma="S4-PRUEBA",
        nombrePrograma="Programa de prueba",
        nivelFormacion="Tecnólogo",
        activo=True,
        idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1,
        nombre="Trimestre de prueba",
        fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30),
        estado="activo",
    )
    sede = Sede(id=1, nombre="Sede de prueba", direccion="Dirección de prueba", tipo="principal")
    ambiente = Ambiente(
        id=1,
        numero_ambiente=101,
        nombre="Ambiente",
        tipo_ambiente="regular",
        estado_ambiente="disponible",
        sede_id=1,
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    competencia = CompetenciaFormacion(
        idCompetencia=1,
        codigo="COMP-S4",
        descripcion="Competencia para pruebas",
        idPrograma=1,
    )
    resultado = ResultadoAprendizaje(
        idResultado=9,
        descripcion="Resultado de prueba",
        codigo="RA-S4",
        idCompetencia=1,
        horasAsignadas=10,
    )
    instructor = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Instructor de prueba",
        email="instructor-s4@example.test",
        tipoContrato="planta",
    )
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-S4", idPrograma=1, idTrimestre=1)

    db_session.add_all([
        coordinacion,
        programa,
        trimestre,
        sede,
        ambiente,
        jornada,
        dia_lunes,
        competencia,
        resultado,
        instructor,
        ficha,
    ])
    db_session.commit()
    return instructor


def _payload(instructor):
    return {
        "idJornada": 1,
        "idTrimestre": 1,
        "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario),
        "idFicha": 1,
        "idResultado": 9,
        "horaInicio": "08:00:00",
        "horaFin": "10:00:00",
        "dias": [1],
        "publicado": False,
    }


def _crear_horario(db_session, instructor, *, id_horario=100):
    horario = Horario(
        idHorario=id_horario,
        horaInicio=time(8, 0),
        horaFin=time(10, 0),
        idJornada=1,
        idTrimestre=1,
        idAmbiente=1,
        idInstructor=instructor.idUsuario,
        idFicha=1,
        idResultado=9,
        publicado=False,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=1))
    db_session.commit()
    return horario


def test_post_crea_horario_y_devuelve_contrato_json(client, db_session, autenticar_como):
    _crear_tablas_horario(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _preparar_datos(db_session)

    respuesta = client.post("/api/v1/horarios/", json=_payload(instructor), headers=headers)

    assert respuesta.status_code == 201
    assert respuesta.headers["content-type"].startswith("application/json")
    cuerpo = respuesta.json()
    assert cuerpo["idHorario"] > 0
    assert cuerpo["idInstructor"] == str(instructor.idUsuario)
    assert cuerpo["idFicha"] == 1
    assert cuerpo["horaInicio"] == "08:00:00"
    assert cuerpo["dias"] == [1]
    assert db_session.query(Horario).filter_by(idHorario=cuerpo["idHorario"]).one()


def test_get_horario_existente_devuelve_datos_y_dias(client, db_session, autenticar_como):
    _crear_tablas_horario(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _preparar_datos(db_session)
    _crear_horario(db_session, instructor)

    respuesta = client.get("/api/v1/horarios/100", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["idHorario"] == 100
    assert cuerpo["idInstructor"] == str(instructor.idUsuario)
    assert cuerpo["horaInicio"] == "08:00:00"
    assert cuerpo["horaFin"] == "10:00:00"
    assert cuerpo["dias"] == [1]


def test_get_horario_inexistente_devuelve_404_con_detail(client, db_session, autenticar_como):
    _crear_tablas_horario(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get("/api/v1/horarios/99999", headers=headers)

    assert respuesta.status_code == 404
    assert respuesta.headers["content-type"].startswith("application/json")
    assert respuesta.json()["detail"] == "Horario no encontrado"


def test_put_actualiza_horario_y_persiste_el_cambio(client, db_session, autenticar_como):
    _crear_tablas_horario(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _preparar_datos(db_session)
    _crear_horario(db_session, instructor)
    payload = {**_payload(instructor), "horaInicio": "10:00:00", "horaFin": "12:00:00"}

    respuesta = client.put("/api/v1/horarios/100", json=payload, headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["idHorario"] == 100
    assert cuerpo["horaInicio"] == "10:00:00"
    assert cuerpo["horaFin"] == "12:00:00"
    db_session.expire_all()
    persistido = db_session.query(Horario).filter_by(idHorario=100).one()
    assert persistido.horaInicio == time(10, 0)
    assert persistido.horaFin == time(12, 0)


def test_delete_elimina_horario_y_devuelve_confirmacion(client, db_session, autenticar_como):
    _crear_tablas_horario(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _preparar_datos(db_session)
    _crear_horario(db_session, instructor)

    respuesta = client.delete("/api/v1/horarios/100", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"mensaje": "Horario eliminado"}
    assert db_session.query(Horario).filter_by(idHorario=100).count() == 0


def test_post_horario_con_campo_requerido_ausente_devuelve_422(client, db_session, autenticar_como):
    _crear_tablas_horario(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _preparar_datos(db_session)
    payload = _payload(instructor)
    payload.pop("idResultado")

    respuesta = client.post("/api/v1/horarios/", json=payload, headers=headers)

    assert respuesta.status_code == 422
    assert respuesta.headers["content-type"].startswith("application/json")
    error = respuesta.json()["detail"][0]
    assert error["loc"] == ["body", "idResultado"]
    assert error["type"] == "missing"
