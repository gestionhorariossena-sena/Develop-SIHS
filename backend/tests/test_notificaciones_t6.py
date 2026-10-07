"""T-6 (SCRUM-139): endpoints nuevos de la campana y los avisos que faltaban
para cerrar los circuitos entre roles."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.notificacion import Notificacion
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.solicitud_cambio_horario import SolicitudCambioHorario
from app.models.usuario import Usuario
from app.services import solicitud_acceso_service
from app.services.notificacion_service import NotificacionService, TIPO_SISTEMA


def _crear(db_session, id_usuario, *, mensaje="Aviso", leida=False, tipo="sistema"):
    notificacion = Notificacion(idUsuario=id_usuario, tipo=tipo, mensaje=mensaje, leida=leida)
    db_session.add(notificacion)
    db_session.commit()
    db_session.refresh(notificacion)
    return notificacion


def _avisos_de(db_session, id_usuario):
    return db_session.query(Notificacion).filter(Notificacion.idUsuario == id_usuario).all()


# --- Endpoints de la campana ------------------------------------------------


def test_conteo_no_leidas_solo_cuenta_las_propias_sin_leer(client, autenticar_como, crear_usuario, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    otro = crear_usuario(nombre="Otro")
    _crear(db_session, usuario.idUsuario)
    _crear(db_session, usuario.idUsuario)
    _crear(db_session, usuario.idUsuario, leida=True)
    _crear(db_session, otro.idUsuario)

    respuesta = client.get("/api/v1/notificaciones/conteo-no-leidas", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"noLeidas": 2}


def test_listado_filtra_no_leidas_y_respeta_limite(client, autenticar_como, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    for i in range(3):
        _crear(db_session, usuario.idUsuario, mensaje=f"Nueva {i}")
    _crear(db_session, usuario.idUsuario, mensaje="Vieja", leida=True)

    solo_no_leidas = client.get("/api/v1/notificaciones/?solo_no_leidas=true", headers=headers).json()
    assert len(solo_no_leidas) == 3
    assert all(not n["leida"] for n in solo_no_leidas)

    limitadas = client.get("/api/v1/notificaciones/?limite=2", headers=headers).json()
    assert len(limitadas) == 2


def test_listado_rechaza_limite_fuera_de_rango(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    assert client.get("/api/v1/notificaciones/?limite=0", headers=headers).status_code == 422
    assert client.get("/api/v1/notificaciones/?limite=500", headers=headers).status_code == 422


def test_eliminar_notificacion_propia(client, autenticar_como, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    notificacion = _crear(db_session, usuario.idUsuario)

    respuesta = client.delete(f"/api/v1/notificaciones/{notificacion.idNotificacion}", headers=headers)

    assert respuesta.status_code == 204
    assert _avisos_de(db_session, usuario.idUsuario) == []


def test_eliminar_notificacion_ajena_da_404_y_no_la_borra(client, autenticar_como, crear_usuario, db_session):
    _, headers = autenticar_como("Aprendiz")
    otro = crear_usuario(nombre="Otro")
    ajena = _crear(db_session, otro.idUsuario)

    respuesta = client.delete(f"/api/v1/notificaciones/{ajena.idNotificacion}", headers=headers)

    assert respuesta.status_code == 404
    assert len(_avisos_de(db_session, otro.idUsuario)) == 1


def test_endpoints_exigen_sesion(client):
    assert client.get("/api/v1/notificaciones/conteo-no-leidas").status_code in (401, 403)
    assert client.delete("/api/v1/notificaciones/1").status_code in (401, 403)


# --- Aviso por rol ----------------------------------------------------------


def test_notificar_roles_excluye_al_autor_y_a_inactivos(db_session, crear_usuario, crear_rol):
    coordinador = crear_rol("Coordinador")
    administrador = crear_rol("Administrador")
    aprendiz = crear_rol("Aprendiz")
    autor = crear_usuario(nombre="Autor", roles=[coordinador])
    colega = crear_usuario(nombre="Colega", roles=[coordinador, administrador])
    inactivo = crear_usuario(nombre="Inactivo", roles=[administrador])
    inactivo.estado = "inactivo"
    alumno = crear_usuario(nombre="Alumno", roles=[aprendiz])
    db_session.commit()

    creadas = NotificacionService.notificar_roles_transaccional(
        db_session,
        roles={"Coordinador", "Administrador"},
        tipo=TIPO_SISTEMA,
        mensaje="Hola coordinación",
        excluir=autor.idUsuario,
    )
    db_session.commit()

    assert creadas == 1
    # Tener los dos roles no duplica el aviso.
    assert len(_avisos_de(db_session, colega.idUsuario)) == 1
    assert _avisos_de(db_session, autor.idUsuario) == []
    assert _avisos_de(db_session, inactivo.idUsuario) == []
    assert _avisos_de(db_session, alumno.idUsuario) == []


# --- Disparadores -----------------------------------------------------------


def _tablas_horario(db_session):
    from app.core.database import Base

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Sede.__table__,
            Ambiente.__table__,
            Jornada.__table__,
            DiaSemana.__table__,
            ResultadoAprendizaje.__table__,
            SolicitudCambioHorario.__table__,
        ],
    )


def _catalogos(db_session, crear_ficha):
    ficha = crear_ficha(codigo="FICHA-T6")
    db_session.add_all([
        Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal"),
        Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular",
                 estado_ambiente="disponible", sede_id=1),
        Jornada(idJornada=1, nombreJornada="Mañana"),
        DiaSemana(idDia=1, nombreDia="Lunes"),
        ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1),
    ])
    db_session.commit()
    return ficha


def _horario(db_session, ficha, id_instructor, *, id_horario=100, publicado=True):
    horario = Horario(
        idHorario=id_horario, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=ficha.idTrimestre, idAmbiente=1, idInstructor=id_instructor,
        idFicha=ficha.idFicha, idResultado=9, publicado=publicado,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=1))
    db_session.commit()
    return horario


def test_solicitud_de_cambio_avisa_a_coordinacion(
    client, db_session, autenticar_como, crear_usuario, crear_rol, crear_ficha
):
    _tablas_horario(db_session)
    ficha = _catalogos(db_session, crear_ficha)
    coordinadora = crear_usuario(nombre="Coordinadora", roles=[crear_rol("Coordinador")])
    instructor, headers = autenticar_como("Instructor")
    _horario(db_session, ficha, instructor.idUsuario)

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": 100, "tipo": "permuta", "motivo": "Cambio de ambiente"},
        headers=headers,
    )

    assert respuesta.status_code == 201
    avisos = _avisos_de(db_session, coordinadora.idUsuario)
    assert len(avisos) == 1
    assert avisos[0].tipo == "sistema"
    assert "FICHA-T6" in avisos[0].mensaje
    assert avisos[0].entidadRelacionada == "solicitudes_cambio_horario"
    assert _avisos_de(db_session, instructor.idUsuario) == []


def test_cruce_forzado_avisa_a_coordinacion_y_al_instructor(
    client, db_session, autenticar_como, crear_usuario, crear_rol, crear_ficha
):
    _tablas_horario(db_session)
    ficha = _catalogos(db_session, crear_ficha)
    autor, headers = autenticar_como("Coordinador")
    colega = crear_usuario(nombre="Colega", roles=[crear_rol("Coordinador")])
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos", email="carlos@example.com", tipoContrato="planta")
    db_session.add(instructor)
    db_session.commit()
    _horario(db_session, ficha, instructor.idUsuario)

    respuesta = client.post(
        "/api/v1/horarios/",
        json={
            "idJornada": 1, "idTrimestre": ficha.idTrimestre, "idAmbiente": 1,
            "idInstructor": str(instructor.idUsuario), "idFicha": ficha.idFicha, "idResultado": 9,
            "horaInicio": "08:00:00", "horaFin": "10:00:00", "dias": [1], "forzar": True,
        },
        headers=headers,
    )

    assert respuesta.status_code == 201
    cruces_colega = [n for n in _avisos_de(db_session, colega.idUsuario) if n.tipo == "cruce"]
    assert len(cruces_colega) == 1
    assert "cruce autorizado" in cruces_colega[0].mensaje
    assert [n for n in _avisos_de(db_session, autor.idUsuario) if n.tipo == "cruce"] == []
    assert [n for n in _avisos_de(db_session, instructor.idUsuario) if n.tipo == "cruce"]


def test_cruce_forzado_en_borrador_no_avisa_al_instructor(
    client, db_session, autenticar_como, crear_ficha
):
    _tablas_horario(db_session)
    ficha = _catalogos(db_session, crear_ficha)
    _, headers = autenticar_como("Coordinador")
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos", email="carlos@example.com", tipoContrato="planta")
    db_session.add(instructor)
    db_session.commit()
    _horario(db_session, ficha, instructor.idUsuario)

    respuesta = client.post(
        "/api/v1/horarios/",
        json={
            "idJornada": 1, "idTrimestre": ficha.idTrimestre, "idAmbiente": 1,
            "idInstructor": str(instructor.idUsuario), "idFicha": ficha.idFicha, "idResultado": 9,
            "horaInicio": "08:00:00", "horaFin": "10:00:00", "dias": [1], "forzar": True,
            "publicado": False,
        },
        headers=headers,
    )

    assert respuesta.status_code == 201
    assert [n for n in _avisos_de(db_session, instructor.idUsuario) if n.tipo == "cruce"] == []


def test_nueva_solicitud_de_acceso_avisa_a_administradores(client, db_session, crear_usuario, crear_rol):
    admin = crear_usuario(nombre="Admin", roles=[crear_rol("Administrador")])
    coordinador = crear_usuario(nombre="Coord", roles=[crear_rol("Coordinador")])
    rol_instructor = crear_rol("Instructor")

    respuesta = client.post(
        "/api/v1/solicitudes-acceso/",
        json={
            "nombre": "Maritza Benítez",
            "email": "mbenitez@sena.edu.co",
            "numeroDocumento": "52849120",
            "idRolSolicitado": rol_instructor.idRol,
            "motivo": "Soy instructora nueva.",
        },
    )

    assert respuesta.status_code == 201
    avisos = _avisos_de(db_session, admin.idUsuario)
    assert len(avisos) == 1
    assert "Maritza Benítez" in avisos[0].mensaje
    assert "Instructor" in avisos[0].mensaje
    assert _avisos_de(db_session, coordinador.idUsuario) == []


def test_aprobar_solicitud_deja_aviso_de_bienvenida(client, db_session, autenticar_como, crear_rol, monkeypatch):
    _, headers = autenticar_como("Administrador")
    rol_instructor = crear_rol("Instructor")
    id_nuevo = uuid.uuid4()
    monkeypatch.setattr(
        solicitud_acceso_service,
        "crear_o_recuperar_usuario_supabase",
        lambda email, password: ({"id": str(id_nuevo), "email": email}, True),
    )
    creada = client.post(
        "/api/v1/solicitudes-acceso/",
        json={
            "nombre": "Pedro Ruiz",
            "email": "pruiz@sena.edu.co",
            "numeroDocumento": "1020",
            "idRolSolicitado": rol_instructor.idRol,
            "motivo": "Ingreso",
        },
    ).json()

    respuesta = client.post(
        f"/api/v1/solicitudes-acceso/{creada['idSolicitud']}/aprobar",
        json={"idRol": rol_instructor.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text
    avisos = _avisos_de(db_session, id_nuevo)
    assert len(avisos) == 1
    assert "bienvenida" in avisos[0].mensaje
    assert "Instructor" in avisos[0].mensaje
