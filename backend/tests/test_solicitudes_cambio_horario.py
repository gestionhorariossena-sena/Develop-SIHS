"""SCRUM-116: solicitudes de cambio/permuta de horario del instructor."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.solicitud_cambio_horario import SolicitudCambioHorario
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Ambiente.__table__,
        Jornada.__table__,
        DiaSemana.__table__,
        Ficha.__table__,
        Horario.__table__,
        horario_dia,
        Usuario.__table__,
        SolicitudCambioHorario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar_catalogos_y_horario(db_session, id_instructor):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, ambiente, jornada, dia_lunes, ficha])
    db_session.commit()

    horario = Horario(
        idHorario=1, horaInicio=time(7, 0), horaFin=time(9, 0),
        idJornada=1, idTrimestre=1, idAmbiente=1,
        idInstructor=id_instructor, idFicha=1, idResultado=1,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=1))
    db_session.commit()
    return horario


def test_instructor_crea_solicitud_sobre_su_propio_horario(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers = autenticar_como("Instructor")
    _poblar_catalogos_y_horario(db_session, instructor.idUsuario)

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": 1, "tipo": "permuta", "motivo": "Necesito cambiar de ambiente por mantenimiento"},
        headers=headers,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "pendiente"
    assert cuerpo["idHorarioOrigen"] == 1


def test_instructor_no_puede_crear_solicitud_sobre_horario_de_otro(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    otro_instructor = crear_usuario(nombre="Otro")
    _poblar_catalogos_y_horario(db_session, otro_instructor.idUsuario)
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": 1, "tipo": "novedad", "motivo": "x"},
        headers=headers,
    )

    assert respuesta.status_code == 404


def test_rol_distinto_de_instructor_no_puede_crear(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": 1, "tipo": "novedad", "motivo": "x"},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_instructor_lista_solo_las_propias(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    instructor, headers = autenticar_como("Instructor")
    _poblar_catalogos_y_horario(db_session, instructor.idUsuario)

    otro_instructor = crear_usuario(nombre="Otro2", email="otro2@example.com")
    db_session.add(Horario(
        idHorario=2, horaInicio=time(10, 0), horaFin=time(12, 0),
        idJornada=1, idTrimestre=1, idAmbiente=1,
        idInstructor=otro_instructor.idUsuario, idFicha=1, idResultado=1,
    ))
    db_session.commit()

    db_session.add_all([
        SolicitudCambioHorario(idInstructor=instructor.idUsuario, idHorarioOrigen=1, tipo="novedad", motivo="a"),
        SolicitudCambioHorario(idInstructor=otro_instructor.idUsuario, idHorarioOrigen=2, tipo="novedad", motivo="b"),
    ])
    db_session.commit()

    respuesta = client.get("/api/v1/solicitudes-cambio-horario/mias", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["idInstructor"] == str(instructor.idUsuario)


def test_coordinador_lista_todas(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = crear_usuario(nombre="Inst")
    _poblar_catalogos_y_horario(db_session, instructor.idUsuario)

    db_session.add(SolicitudCambioHorario(idInstructor=instructor.idUsuario, idHorarioOrigen=1, tipo="novedad", motivo="a"))
    db_session.commit()

    respuesta = client.get("/api/v1/solicitudes-cambio-horario/", headers=headers)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1


def test_coordinador_resuelve_solicitud(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    instructor = crear_usuario(nombre="Inst2")
    _poblar_catalogos_y_horario(db_session, instructor.idUsuario)

    solicitud = SolicitudCambioHorario(idInstructor=instructor.idUsuario, idHorarioOrigen=1, tipo="novedad", motivo="a")
    db_session.add(solicitud)
    db_session.commit()

    respuesta = client.patch(
        f"/api/v1/solicitudes-cambio-horario/{solicitud.idSolicitud}/resolver",
        json={"estado": "aprobada"},
        headers=headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "aprobada"
    assert cuerpo["idAdminResolvio"] == str(coordinador.idUsuario)
    assert cuerpo["fechaResolucion"] is not None


def test_instructor_no_puede_resolver(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    instructor, headers = autenticar_como("Instructor")
    otro = crear_usuario(nombre="Otro3")
    _poblar_catalogos_y_horario(db_session, otro.idUsuario)

    solicitud = SolicitudCambioHorario(idInstructor=otro.idUsuario, idHorarioOrigen=1, tipo="novedad", motivo="a")
    db_session.add(solicitud)
    db_session.commit()

    respuesta = client.patch(
        f"/api/v1/solicitudes-cambio-horario/{solicitud.idSolicitud}/resolver",
        json={"estado": "aprobada"},
        headers=headers,
    )

    assert respuesta.status_code == 403
