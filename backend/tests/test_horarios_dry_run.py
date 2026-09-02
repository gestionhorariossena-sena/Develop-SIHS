import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
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


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Sede.__table__,
        Ambiente.__table__,
        Jornada.__table__,
        DiaSemana.__table__,
        Ficha.__table__,
        ResultadoAprendizaje.__table__,
        Horario.__table__,
        horario_dia,
        Usuario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def test_dry_run_detecta_conflictos(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)

    _, headers = autenticar_como("Coordinador")

    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1,
        codigoPrograma="TEC-01",
        nombrePrograma="Tecnología",
        nivelFormacion="Técnico",
        activo=True,
        idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1,
        nombre="2026-1",
        fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30),
        estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
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
    dia_miercoles = DiaSemana(idDia=3, nombreDia="Miércoles")
    resultado = ResultadoAprendizaje(
        idResultado=9,
        descripcion="Resultado A",
        codigo="RA-9",
        idCompetencia=1,
        horasAsignadas=10,
    )

    instructor = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Carlos López",
        email="carlos@example.com",
        tipoContrato="planta",
    )
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([
        coordinacion,
        programa,
        trimestre,
        sede,
        ambiente,
        jornada,
        dia_lunes,
        dia_miercoles,
        resultado,
        instructor,
        ficha,
    ])
    db_session.commit()

    horario_existente = Horario(
        idHorario=100,
        horaInicio=time(8, 0),
        horaFin=time(10, 0),
        idJornada=1,
        idTrimestre=1,
        idAmbiente=1,
        idInstructor=instructor.idUsuario,
        idFicha=1,
        idResultado=9,
    )
    db_session.add(horario_existente)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=3))
    db_session.commit()

    payload = {
        "idJornada": 1,
        "idTrimestre": 1,
        "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario),
        "idFicha": 1,
        "idResultado": 9,
        "horaInicio": "08:00:00",
        "horaFin": "10:00:00",
        "dias": [1, 3],
        "excluirIdHorario": None,
    }

    response = client.post("/api/v1/horarios/validar", json=payload, headers=headers)

    assert response.status_code == 409
    body = response.json()
    assert body["ok"] is False
    assert body["puedeGuardar"] is False
    assert len(body["conflictos"]) >= 1
    assert any("cruce" in conflicto["tipo"] or "resultado" in conflicto["tipo"] for conflicto in body["conflictos"])


def test_dry_run_permite_horario_sin_conflictos(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)

    _, headers = autenticar_como("Coordinador")

    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1,
        codigoPrograma="TEC-01",
        nombrePrograma="Tecnología",
        nivelFormacion="Técnico",
        activo=True,
        idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1,
        nombre="2026-1",
        fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30),
        estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
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
    resultado = ResultadoAprendizaje(
        idResultado=9,
        descripcion="Resultado A",
        codigo="RA-9",
        idCompetencia=1,
        horasAsignadas=10,
    )
    instructor = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Carlos López",
        email="carlos@example.com",
        tipoContrato="planta",
    )
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([
        coordinacion,
        programa,
        trimestre,
        sede,
        ambiente,
        jornada,
        dia_lunes,
        resultado,
        instructor,
        ficha,
    ])
    db_session.commit()

    payload = {
        "idJornada": 1,
        "idTrimestre": 1,
        "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario),
        "idFicha": 1,
        "idResultado": 9,
        "horaInicio": "09:00:00",
        "horaFin": "11:00:00",
        "dias": [2],
        "excluirIdHorario": None,
    }

    response = client.post("/api/v1/horarios/validar", json=payload, headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["puedeGuardar"] is True


def test_crear_horario_con_forzar_permite_conflicto(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)

    _, headers = autenticar_como("Coordinador")

    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1,
        codigoPrograma="TEC-01",
        nombrePrograma="Tecnología",
        nivelFormacion="Técnico",
        activo=True,
        idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1,
        nombre="2026-1",
        fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30),
        estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
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
    dia_miercoles = DiaSemana(idDia=3, nombreDia="Miércoles")
    resultado = ResultadoAprendizaje(
        idResultado=9,
        descripcion="Resultado A",
        codigo="RA-9",
        idCompetencia=1,
        horasAsignadas=10,
    )
    instructor = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Carlos López",
        email="carlos@example.com",
        tipoContrato="planta",
    )
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([
        coordinacion,
        programa,
        trimestre,
        sede,
        ambiente,
        jornada,
        dia_lunes,
        dia_miercoles,
        resultado,
        instructor,
        ficha,
    ])
    db_session.commit()

    horario_existente = Horario(
        idHorario=100,
        horaInicio=time(8, 0),
        horaFin=time(10, 0),
        idJornada=1,
        idTrimestre=1,
        idAmbiente=1,
        idInstructor=instructor.idUsuario,
        idFicha=1,
        idResultado=9,
    )
    db_session.add(horario_existente)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=3))
    db_session.commit()

    payload = {
        "idJornada": 1,
        "idTrimestre": 1,
        "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario),
        "idFicha": 1,
        "idResultado": 9,
        "horaInicio": "08:00:00",
        "horaFin": "10:00:00",
        "dias": [1, 3],
        "forzar": True,
    }

    response = client.post("/api/v1/horarios/", json=payload, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["idFicha"] == 1
    assert body["idInstructor"] == str(instructor.idUsuario)
    assert body["idHorario"] > 0
