"""H-8 y H-9 — a quién le llega qué.

Hasta el 2026-09-24 el sistema tenía UN solo disparador de notificaciones
(cambiar ambiente o instructor de un bloque) y solo alcanzaba a los
aprendices vinculados a la ficha. Un instructor al que le movían el aula
nunca se enteraba, y publicar un horario no avisaba a nadie: quedaba ahí
esperando a que alguien entrara a mirarlo.
"""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.notificacion import Notificacion
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
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
        ],
    )


def _catalogos(db_session):
    db_session.add_all(
        [
            Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología"),
            Programa(
                idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
                nivelFormacion="Técnico", activo=True, idCoordinacion=1,
            ),
            Trimestre(
                idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5),
                fechaFin=date(2026, 4, 30), estado="activo",
            ),
            Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal"),
            # Especiales a propósito: el CHECK `nombreAmbienteRegular`
            # obliga a que todo ambiente "regular" se llame "Ambiente", y
            # acá hacen falta dos nombres distinguibles en el mensaje.
            Ambiente(id=1, numero_ambiente=101, nombre="Laboratorio de Redes", tipo_ambiente="especial", estado_ambiente="disponible", sede_id=1),
            Ambiente(id=2, numero_ambiente=202, nombre="Taller de Software", tipo_ambiente="especial", estado_ambiente="disponible", sede_id=1),
            Jornada(idJornada=1, nombreJornada="Mañana"),
            DiaSemana(idDia=1, nombreDia="Lunes"),
            ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10),
            Ficha(idFicha=1, codigoFicha="3171618", idPrograma=1, idTrimestre=1),
        ]
    )
    db_session.commit()


def _instructor(db_session, nombre="Carlos López"):
    usuario = Usuario(
        idUsuario=uuid.uuid4(), nombre=nombre,
        email=f"{uuid.uuid4().hex[:8]}@example.com", tipoContrato="planta",
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


def _aprendiz_de_la_ficha(db_session, crear_usuario, crear_rol, id_ficha=1):
    # Con el rol puesto: `obtener_aprendices_por_ficha` filtra por
    # Rol.nombre == "Aprendiz", no basta con el vínculo a la ficha.
    aprendiz = crear_usuario(nombre="Juan", roles=[crear_rol("Aprendiz")])
    db_session.add(FichaUsuario(idFicha=id_ficha, idUsuario=aprendiz.idUsuario))
    db_session.commit()
    return aprendiz


def _horario(db_session, id_horario, instructor, *, id_ambiente=1, publicado=True):
    horario = Horario(
        idHorario=id_horario, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=1, idAmbiente=id_ambiente, idInstructor=instructor.idUsuario,
        idFicha=1, idResultado=9, publicado=publicado,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=1))
    db_session.commit()
    return horario


def _notificaciones_de(db_session, usuario):
    return (
        db_session.query(Notificacion)
        .filter(Notificacion.idUsuario == usuario.idUsuario)
        .order_by(Notificacion.idNotificacion)
        .all()
    )


def test_mover_el_ambiente_avisa_tambien_al_instructor(client, db_session, autenticar_como, crear_usuario, crear_rol):
    """El hueco de H-8: al instructor le cambiaban el aula y se enteraba
    llegando al salón equivocado."""
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    _catalogos(db_session)
    instructor = _instructor(db_session)
    aprendiz = _aprendiz_de_la_ficha(db_session, crear_usuario, crear_rol)
    _horario(db_session, 100, instructor)

    respuesta = client.put(
        "/api/v1/horarios/100",
        json={
            "horaInicio": "08:00:00", "horaFin": "10:00:00", "idJornada": 1, "idTrimestre": 1,
            "idAmbiente": 2, "idInstructor": str(instructor.idUsuario),
            "idFicha": 1, "idResultado": 9, "dias": [1],
        },
        headers=headers,
    )

    assert respuesta.status_code == 200

    del_instructor = _notificaciones_de(db_session, instructor)
    assert len(del_instructor) == 1
    assert "Taller de Software" in del_instructor[0].mensaje
    assert del_instructor[0].tipo == "ambiente"

    # Y los aprendices siguen recibiendo el suyo, como antes.
    assert len(_notificaciones_de(db_session, aprendiz)) == 1


def test_reasignar_el_bloque_avisa_a_los_dos_instructores(client, db_session, autenticar_como, crear_usuario, crear_rol):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    _catalogos(db_session)
    anterior = _instructor(db_session, "Carlos López")
    nuevo = _instructor(db_session, "Marta Ruiz")
    _horario(db_session, 100, anterior)

    respuesta = client.put(
        "/api/v1/horarios/100",
        json={
            "horaInicio": "08:00:00", "horaFin": "10:00:00", "idJornada": 1, "idTrimestre": 1,
            "idAmbiente": 1, "idInstructor": str(nuevo.idUsuario),
            "idFicha": 1, "idResultado": 9, "dias": [1],
        },
        headers=headers,
    )

    assert respuesta.status_code == 200

    del_nuevo = _notificaciones_de(db_session, nuevo)
    assert len(del_nuevo) == 1
    assert "Cambió tu bloque" in del_nuevo[0].mensaje

    del_anterior = _notificaciones_de(db_session, anterior)
    assert len(del_anterior) == 1
    assert "Ya no tienes el bloque" in del_anterior[0].mensaje
    assert "Marta Ruiz" in del_anterior[0].mensaje


def test_publicar_un_borrador_avisa_a_instructor_y_aprendices(client, db_session, autenticar_como, crear_usuario, crear_rol):
    """H-9: publicar era un cambio invisible."""
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    _catalogos(db_session)
    instructor = _instructor(db_session)
    aprendiz = _aprendiz_de_la_ficha(db_session, crear_usuario, crear_rol)
    _horario(db_session, 100, instructor, publicado=False)

    respuesta = client.patch("/api/v1/horarios/100/estado", json={"publicado": True}, headers=headers)

    assert respuesta.status_code == 200
    assert "3171618" in _notificaciones_de(db_session, instructor)[0].mensaje
    assert "Mi horario" in _notificaciones_de(db_session, aprendiz)[0].mensaje


def test_despublicar_no_avisa_y_republicar_no_repite_el_aviso(client, db_session, autenticar_como, crear_usuario, crear_rol):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    _catalogos(db_session)
    instructor = _instructor(db_session)
    _horario(db_session, 100, instructor, publicado=False)

    client.patch("/api/v1/horarios/100/estado", json={"publicado": True}, headers=headers)
    client.patch("/api/v1/horarios/100/estado", json={"publicado": False}, headers=headers)
    client.patch("/api/v1/horarios/100/estado", json={"publicado": True}, headers=headers)

    # Tres llamadas, un solo aviso: quitar y volver a poner no es noticia.
    assert len(_notificaciones_de(db_session, instructor)) == 1


def test_publicar_el_horario_de_una_ficha_no_manda_un_aviso_por_bloque(client, db_session, autenticar_como, crear_usuario, crear_rol):
    """El asistente guarda bloque por bloque: sin agrupar, a cada aprendiz
    le entraría un campanazo por cada franja de la semana."""
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    _catalogos(db_session)
    instructor = _instructor(db_session)
    aprendiz = _aprendiz_de_la_ficha(db_session, crear_usuario, crear_rol)

    for hora in (8, 10, 14):
        respuesta = client.post(
            "/api/v1/horarios/",
            json={
                "horaInicio": f"{hora:02d}:00:00", "horaFin": f"{hora + 1:02d}:00:00",
                "idJornada": 1, "idTrimestre": 1, "idAmbiente": 1,
                "idInstructor": str(instructor.idUsuario), "idFicha": 1,
                "idResultado": 9, "dias": [1], "forzar": True,
            },
            headers=headers,
        )
        assert respuesta.status_code == 201

    assert len(_notificaciones_de(db_session, aprendiz)) == 1
    assert len(_notificaciones_de(db_session, instructor)) == 1


def test_un_tipo_de_notificacion_que_el_panel_no_sabe_pintar_no_se_guarda(db_session, crear_usuario):
    """El panel mapea tipo -> icono y color con un Record cerrado: un tipo
    fuera de esa lista llegaba sin icono ni estilo. Hasta H-8 el único
    disparador del sistema mandaba justamente uno de esos."""
    import pytest

    from app.services.notificacion_service import NotificacionService

    usuario = crear_usuario()

    with pytest.raises(ValueError, match="Tipo de notificación desconocido"):
        NotificacionService.crear(
            db_session, id_usuario=usuario.idUsuario, tipo="Cambios de Aula & Horario", mensaje="hola"
        )
