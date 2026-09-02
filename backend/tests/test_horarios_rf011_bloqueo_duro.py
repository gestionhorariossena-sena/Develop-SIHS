"""RF-011 es bloqueo duro (§7.2 de PLAN_INTEGRACION_LOGICA_Y_BD.md): a
diferencia de los cruces físicos (ficha/instructor/ambiente/resultado
repetido), nunca se puede saltar con `forzar=True`. Backlog "Nuevo
alcance" épica A, tarea 9 ("Test: RF-011 sigue bloqueando duro aunque
forzar=true") — faltaba, los tests existentes de forzar solo cubrían
cruces físicos."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base
    from app.models.resultado_aprendizaje import ResultadoAprendizaje

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


def _poblar_catalogos_basicos(db_session):
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
    jornada_noche = Jornada(idJornada=2, nombreJornada="Noche")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all(
        [coordinacion, programa, trimestre, sede, ambiente, jornada_noche, dia_lunes, ficha]
    )
    db_session.commit()

    return {"idAmbiente": ambiente.id, "idJornadaNoche": jornada_noche.idJornada, "idDiaLunes": dia_lunes.idDia, "idFicha": ficha.idFicha}


def test_crear_con_forzar_no_salta_rf011_planta_en_noche(client, db_session, autenticar_como):
    """RF-011: un instructor de planta no puede programarse en jornada
    Noche — ni siquiera con forzar=True."""
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    _, headers = autenticar_como("Coordinador")

    instructor_planta = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Sergio Planta",
        email="sergio@example.com",
        tipoContrato="planta",
    )
    db_session.add(instructor_planta)
    db_session.commit()

    payload = {
        "idJornada": catalogos["idJornadaNoche"],
        "idTrimestre": 1,
        "idAmbiente": catalogos["idAmbiente"],
        "idInstructor": str(instructor_planta.idUsuario),
        "idFicha": catalogos["idFicha"],
        "idResultado": 1,
        "horaInicio": "18:00:00",
        "horaFin": "20:00:00",
        "dias": [catalogos["idDiaLunes"]],
        "forzar": True,
    }

    respuesta = client.post("/api/v1/horarios/", json=payload, headers=headers)

    assert respuesta.status_code == 409
    mensajes = respuesta.json()["detail"]["mensajes"]
    assert any("Noche" in m and "planta" in m for m in mensajes)
    assert db_session.query(Horario).count() == 0


def test_actualizar_con_forzar_no_salta_rf011_planta_en_noche(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    _, headers = autenticar_como("Coordinador")

    instructor_planta = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Sergio Planta",
        email="sergio@example.com",
        tipoContrato="planta",
    )
    db_session.add(instructor_planta)
    db_session.commit()

    horario_existente = Horario(
        idHorario=1,
        horaInicio=time(7, 0),
        horaFin=time(9, 0),
        idJornada=catalogos["idJornadaNoche"],
        idTrimestre=1,
        idAmbiente=catalogos["idAmbiente"],
        idInstructor=instructor_planta.idUsuario,
        idFicha=catalogos["idFicha"],
        idResultado=1,
    )
    db_session.add(horario_existente)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=catalogos["idDiaLunes"]))
    db_session.commit()

    payload = {
        "idJornada": catalogos["idJornadaNoche"],
        "idTrimestre": 1,
        "idAmbiente": catalogos["idAmbiente"],
        "idInstructor": str(instructor_planta.idUsuario),
        "idFicha": catalogos["idFicha"],
        "idResultado": 1,
        "horaInicio": "18:00:00",
        "horaFin": "20:00:00",
        "dias": [catalogos["idDiaLunes"]],
        "forzar": True,
    }

    respuesta = client.put(f"/api/v1/horarios/{horario_existente.idHorario}", json=payload, headers=headers)

    assert respuesta.status_code == 409
    mensajes = respuesta.json()["detail"]["mensajes"]
    assert any("Noche" in m and "planta" in m for m in mensajes)


def test_crear_con_forzar_permite_fisico_pero_bloquea_si_tambien_hay_rf011(client, db_session, autenticar_como):
    """Si un mismo intento tiene un cruce físico Y una violación RF-011 a
    la vez, forzar=True debe seguir bloqueando (RF-011 manda) — no basta
    con que exista *algún* cruce físico forzable."""
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    _, headers = autenticar_como("Coordinador")

    instructor_planta = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Sergio Planta",
        email="sergio@example.com",
        tipoContrato="planta",
    )
    otro_instructor = Usuario(
        idUsuario=uuid.uuid4(),
        nombre="Otro Instructor",
        email="otro@example.com",
        tipoContrato="planta",
    )
    db_session.add_all([instructor_planta, otro_instructor])
    db_session.commit()

    # Cruce físico: el mismo ambiente ya está ocupado en ese horario por
    # otro instructor.
    horario_existente = Horario(
        idHorario=1,
        horaInicio=time(18, 0),
        horaFin=time(20, 0),
        idJornada=catalogos["idJornadaNoche"],
        idTrimestre=1,
        idAmbiente=catalogos["idAmbiente"],
        idInstructor=otro_instructor.idUsuario,
        idFicha=catalogos["idFicha"],
        idResultado=1,
    )
    db_session.add(horario_existente)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=catalogos["idDiaLunes"]))
    db_session.commit()

    payload = {
        "idJornada": catalogos["idJornadaNoche"],
        "idTrimestre": 1,
        "idAmbiente": catalogos["idAmbiente"],  # mismo ambiente -> cruce físico
        "idInstructor": str(instructor_planta.idUsuario),  # planta + Noche -> RF-011
        "idFicha": catalogos["idFicha"],
        "idResultado": 1,
        "horaInicio": "18:00:00",
        "horaFin": "20:00:00",
        "dias": [catalogos["idDiaLunes"]],
        "forzar": True,
    }

    respuesta = client.post("/api/v1/horarios/", json=payload, headers=headers)

    assert respuesta.status_code == 409
