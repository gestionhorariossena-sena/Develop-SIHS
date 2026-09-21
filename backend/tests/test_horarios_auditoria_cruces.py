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


def _catalogo_base(db_session, id_trimestre=1, id_sede=1, id_ambiente=1):
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
        idTrimestre=id_trimestre,
        nombre="2026-1",
        fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30),
        estado="activo",
    )
    sede = Sede(id=id_sede, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(
        id=id_ambiente,
        numero_ambiente=100 + id_ambiente,
        nombre="Ambiente",
        tipo_ambiente="regular",
        estado_ambiente="disponible",
        sede_id=id_sede,
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado_a = ResultadoAprendizaje(
        idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10
    )
    resultado_b = ResultadoAprendizaje(
        idResultado=10, descripcion="Resultado B", codigo="RA-10", idCompetencia=1, horasAsignadas=10
    )

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, resultado_a, resultado_b])
    db_session.commit()


def test_auditoria_reporta_un_cruce_de_ambiente_una_sola_vez(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session)

    _, headers = autenticar_como("Coordinador")

    instructor_a = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos López", email="carlos@example.com", tipoContrato="planta")
    instructor_b = Usuario(idUsuario=uuid.uuid4(), nombre="Diana Prieto", email="diana@example.com", tipoContrato="planta")
    ficha_a = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)
    ficha_b = Ficha(idFicha=2, codigoFicha="FICHA-002", idPrograma=1, idTrimestre=1)
    db_session.add_all([instructor_a, instructor_b, ficha_a, ficha_b])
    db_session.commit()

    horario_1 = Horario(
        idHorario=100, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1, idTrimestre=1,
        idAmbiente=1, idInstructor=instructor_a.idUsuario, idFicha=1, idResultado=9,
    )
    db_session.add(horario_1)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.commit()

    # Mismo ambiente, mismo día, horas solapadas, pero ficha/instructor distintos:
    # cruce_ambiente real, forzado a propósito para simular datos ya guardados
    # con un conflicto (ej. importados, o guardados antes de esta regla).
    payload = {
        "idJornada": 1, "idTrimestre": 1, "idAmbiente": 1,
        "idInstructor": str(instructor_b.idUsuario), "idFicha": 2, "idResultado": 10,
        "horaInicio": "09:00:00", "horaFin": "11:00:00", "dias": [1], "forzar": True,
    }
    creado = client.post("/api/v1/horarios/", json=payload, headers=headers)
    assert creado.status_code == 201
    id_horario_2 = creado.json()["idHorario"]

    respuesta = client.get("/api/v1/horarios/auditoria-cruces", headers=headers)
    assert respuesta.status_code == 200
    body = respuesta.json()

    cruces_ambiente = [c for c in body["conflictos"] if c["tipo"] == "cruce_ambiente"]
    assert len(cruces_ambiente) == 1, "el cruce simétrico entre horario_1 y horario_2 debe reportarse una sola vez"

    conflicto = cruces_ambiente[0]
    assert {conflicto["idHorario"], conflicto["idHorarioExistente"]} == {100, id_horario_2}
    assert body["resumen"]["totalCruces"] == len(body["conflictos"])
    assert "cruce_ambiente" in body["resumen"]["tipos"]


def test_auditoria_filtra_por_trimestre(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _catalogo_base(db_session, id_trimestre=1)

    trimestre_2 = Trimestre(idTrimestre=2, nombre="2026-2", fechaInicio=date(2026, 5, 1), fechaFin=date(2026, 8, 30), estado="activo")
    ficha_otro_trimestre = Ficha(idFicha=3, codigoFicha="FICHA-003", idPrograma=1, idTrimestre=2)
    db_session.add_all([trimestre_2, ficha_otro_trimestre])
    db_session.commit()

    _, headers = autenticar_como("Coordinador")

    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos López", email="carlos@example.com", tipoContrato="planta")
    db_session.add(instructor)
    db_session.commit()

    # Un solo horario, en el trimestre 2 — sin nada con qué chocar.
    horario = Horario(
        idHorario=200, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1, idTrimestre=2,
        idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=3, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=200, idDia=1))
    db_session.commit()

    respuesta = client.get("/api/v1/horarios/auditoria-cruces?idTrimestre=1", headers=headers)
    assert respuesta.status_code == 200
    assert respuesta.json()["conflictos"] == []

    respuesta_t2 = client.get("/api/v1/horarios/auditoria-cruces?idTrimestre=2", headers=headers)
    assert respuesta_t2.status_code == 200
    assert respuesta_t2.json()["resumen"]["totalCruces"] == 0
