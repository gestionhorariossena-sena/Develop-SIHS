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


def test_actualizar_horario_con_forzar_permite_conflicto(client, db_session, autenticar_como):
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
    ambiente2 = Ambiente(
        id=2,
        numero_ambiente=102,
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
        ambiente2,
        jornada,
        dia_lunes,
        dia_miercoles,
        resultado,
        instructor,
        ficha,
    ])
    db_session.commit()

    # Horario existente: 8am-10am Lunes/Miércoles
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

    # Horario a actualizar: 2pm-4pm Martes (sin conflicto inicial)
    horario_a_actualizar = Horario(
        idHorario=101,
        horaInicio=time(14, 0),
        horaFin=time(16, 0),
        idJornada=1,
        idTrimestre=1,
        idAmbiente=2,
        idInstructor=instructor.idUsuario,
        idFicha=1,
        idResultado=9,
    )
    db_session.add(horario_a_actualizar)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=101, idDia=2))
    db_session.commit()

    # Intentamos actualizar al mismo horario del 100 (conflicto) con forzar=True
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

    response = client.put("/api/v1/horarios/101", json=payload, headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["idHorario"] == 101
    assert body["idFicha"] == 1
    assert body["horaInicio"] == "08:00:00"
    assert body["horaFin"] == "10:00:00"
