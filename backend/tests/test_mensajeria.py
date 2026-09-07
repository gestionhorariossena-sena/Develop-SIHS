"""SCRUM-119 — Módulo de Mensajería Instructor <-> Aprendiz (v1: sin
websockets, sin presencia en línea, adjuntos solo como URL de texto,
sin canal grupal de ficha)."""

from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.mensajeria import Conversacion, Mensaje
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
        FichaUsuario.__table__,
        ResultadoAprendizaje.__table__,
        Horario.__table__,
        horario_dia,
        Usuario.__table__,
        Conversacion.__table__,
        Mensaje.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar_catalogos_basicos(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia = DiaSemana(idDia=1, nombreDia="Lunes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia, ficha])
    db_session.commit()

    return {"idAmbiente": ambiente.id, "idJornada": jornada.idJornada, "idDia": dia.idDia, "idFicha": ficha.idFicha}


def _crear_horario(db_session, catalogos, id_instructor):
    horario = Horario(
        idHorario=1, horaInicio=time(7, 0), horaFin=time(9, 0),
        idJornada=catalogos["idJornada"], idTrimestre=1, idAmbiente=catalogos["idAmbiente"],
        idInstructor=id_instructor, idFicha=catalogos["idFicha"], idResultado=1,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=catalogos["idDia"]))
    db_session.commit()


def test_crear_conversacion_ok_cuando_instructor_dicta_a_la_ficha_del_aprendiz(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    aprendiz, headers = autenticar_como("Aprendiz")
    instructor = crear_usuario(nombre="Erick")

    db_session.add(FichaUsuario(idFicha=catalogos["idFicha"], idUsuario=aprendiz.idUsuario))
    db_session.commit()
    _crear_horario(db_session, catalogos, instructor.idUsuario)

    respuesta = client.post("/api/v1/mensajeria/conversaciones", json={"idInstructor": str(instructor.idUsuario)}, headers=headers)

    assert respuesta.status_code == 201
    assert respuesta.json()["idAprendiz"] == str(aprendiz.idUsuario)
    assert respuesta.json()["idInstructor"] == str(instructor.idUsuario)


def test_crear_conversacion_rechaza_instructor_que_no_dicta_a_la_ficha(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    aprendiz, headers = autenticar_como("Aprendiz")
    instructor_ajeno = crear_usuario(nombre="Sergio")

    db_session.add(FichaUsuario(idFicha=catalogos["idFicha"], idUsuario=aprendiz.idUsuario))
    db_session.commit()
    # instructor_ajeno no dicta ninguna clase a esa ficha.

    respuesta = client.post("/api/v1/mensajeria/conversaciones", json={"idInstructor": str(instructor_ajeno.idUsuario)}, headers=headers)

    assert respuesta.status_code == 403


def test_enviar_y_listar_mensajes(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    aprendiz, headers_aprendiz = autenticar_como("Aprendiz")
    instructor = crear_usuario(nombre="Erick")

    db_session.add(FichaUsuario(idFicha=catalogos["idFicha"], idUsuario=aprendiz.idUsuario))
    db_session.commit()
    _crear_horario(db_session, catalogos, instructor.idUsuario)

    creada = client.post("/api/v1/mensajeria/conversaciones", json={"idInstructor": str(instructor.idUsuario)}, headers=headers_aprendiz)
    id_conversacion = creada.json()["idConversacion"]

    envio = client.post(
        f"/api/v1/mensajeria/conversaciones/{id_conversacion}/mensajes",
        json={"contenido": "Profe, ¿hay clase el viernes?"},
        headers=headers_aprendiz,
    )
    assert envio.status_code == 201
    assert envio.json()["leido"] is False

    listado = client.get(f"/api/v1/mensajeria/conversaciones/{id_conversacion}/mensajes", headers=headers_aprendiz)
    assert listado.status_code == 200
    assert len(listado.json()) == 1

    marcado = client.patch(f"/api/v1/mensajeria/mensajes/{envio.json()['idMensaje']}/leido", headers=headers_aprendiz)
    assert marcado.status_code == 200
    assert marcado.json()["leido"] is True


def test_usuario_ajeno_no_puede_ver_ni_escribir_en_conversacion_de_otros(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    catalogos = _poblar_catalogos_basicos(db_session)

    aprendiz, headers_aprendiz = autenticar_como("Aprendiz")
    instructor = crear_usuario(nombre="Erick")
    _, headers_ajeno = autenticar_como("Aprendiz")

    db_session.add(FichaUsuario(idFicha=catalogos["idFicha"], idUsuario=aprendiz.idUsuario))
    db_session.commit()
    _crear_horario(db_session, catalogos, instructor.idUsuario)

    creada = client.post("/api/v1/mensajeria/conversaciones", json={"idInstructor": str(instructor.idUsuario)}, headers=headers_aprendiz)
    id_conversacion = creada.json()["idConversacion"]

    respuesta = client.get(f"/api/v1/mensajeria/conversaciones/{id_conversacion}/mensajes", headers=headers_ajeno)
    assert respuesta.status_code == 404

    respuesta_post = client.post(
        f"/api/v1/mensajeria/conversaciones/{id_conversacion}/mensajes",
        json={"contenido": "no debería poder"},
        headers=headers_ajeno,
    )
    assert respuesta_post.status_code == 404
