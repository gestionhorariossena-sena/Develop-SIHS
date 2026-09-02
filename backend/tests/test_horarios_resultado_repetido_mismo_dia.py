"""Bug reportado 2026-09-02: al programar al mismo instructor para
continuar la misma clase después del descanso (mismo resultado de
aprendizaje, misma ficha, mismo día, otro bloque de horas), el sistema lo
rechazaba como "resultado repetido" — la regla comparaba solo
(idFicha, idResultado) sin mirar el día. Ahora un horario que comparte al
menos un día con el nuevo se trata como continuación (no se marca); solo
se marca si el resultado ya se programó en un día completamente distinto,
que sigue siendo el caso real que la regla debe bloquear (ver
REGLAS_DE_NEGOCIO_CONOCIDAS.md)."""

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
        Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
        Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__,
        ResultadoAprendizaje.__table__, Horario.__table__, horario_dia, Usuario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30), estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente_a = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    ambiente_b = Ambiente(id=2, numero_ambiente=102, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    dia_martes = DiaSemana(idDia=2, nombreDia="Martes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos López", email="carlos.rr@example.com", tipoContrato="planta")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente_a, ambiente_b, jornada, dia_lunes, dia_martes, resultado, instructor, ficha])
    db_session.commit()

    # Bloque de la mañana, antes del descanso: Lunes 07:00-09:00.
    bloque_antes = Horario(
        idHorario=100, horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1, idTrimestre=1,
        idAmbiente=ambiente_a.id, idInstructor=instructor.idUsuario, idFicha=ficha.idFicha, idResultado=resultado.idResultado,
    )
    db_session.add(bloque_antes)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.commit()

    return {"idAmbienteA": ambiente_a.id, "idAmbienteB": ambiente_b.id, "idInstructor": instructor.idUsuario, "idFicha": ficha.idFicha, "idResultado": resultado.idResultado}


def test_continuar_mismo_resultado_el_mismo_dia_despues_del_descanso_no_es_cruce(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    # Mismo Lunes, después del descanso: 09:15-11:00 — mismo resultado,
    # mismo instructor, misma ficha, pero un bloque de horas distinto y sin
    # solape con el de la mañana.
    payload = {
        "idJornada": 1, "idTrimestre": 1, "idAmbiente": catalogos["idAmbienteA"],
        "idInstructor": str(catalogos["idInstructor"]), "idFicha": catalogos["idFicha"],
        "idResultado": catalogos["idResultado"], "horaInicio": "09:15:00", "horaFin": "11:00:00",
        "dias": [1],
    }

    respuesta = client.post("/api/v1/horarios/", json=payload, headers=headers)

    assert respuesta.status_code == 201
    assert db_session.query(Horario).count() == 2


def test_mismo_resultado_en_un_dia_distinto_sigue_siendo_cruce(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    # Martes (día distinto, sin relación con el Lunes ya programado) — este
    # sí es el caso real que la regla debe seguir bloqueando: el mismo
    # resultado programado dos veces en momentos no relacionados.
    payload = {
        "idJornada": 1, "idTrimestre": 1, "idAmbiente": catalogos["idAmbienteB"],
        "idInstructor": str(catalogos["idInstructor"]), "idFicha": catalogos["idFicha"],
        "idResultado": catalogos["idResultado"], "horaInicio": "07:00:00", "horaFin": "09:00:00",
        "dias": [2],
    }

    respuesta = client.post("/api/v1/horarios/", json=payload, headers=headers)

    assert respuesta.status_code == 409
    assert "ya tiene este resultado de aprendizaje programado" in respuesta.json()["detail"]["mensajes"][0]
    assert db_session.query(Horario).count() == 1
