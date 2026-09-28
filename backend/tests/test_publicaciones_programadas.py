from datetime import date, datetime, time, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.horario import Horario
from app.models.notificacion import Notificacion
from app.models.trimestre import Trimestre
from app.services import publicacion_programada_service as service
from app.services.horario_service import HorarioService, PublicacionProgramadaPendienteError


def _base(db, crear_usuario):
    coordinador = crear_usuario(nombre="Coordinador", roles=[])
    instructor = crear_usuario(nombre="Instructor", roles=[])
    trimestre = Trimestre(
        nombre="2026-3", fechaInicio=date(2026, 7, 1), fechaFin=date(2026, 9, 30), estado="activo"
    )
    db.add(trimestre)
    db.flush()
    horario = Horario(
        horaInicio=time(8), horaFin=time(9), idJornada=1, idTrimestre=trimestre.idTrimestre,
        idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=1, idResultado=1,
        activo=True, publicado=False,
    )
    db.add(horario)
    db.commit()
    return coordinador, instructor, trimestre, horario


def _patch_validation(monkeypatch):
    monkeypatch.setattr(service, "_validar_conjunto", lambda db, horarios: None)
    monkeypatch.setattr(service, "_huella", lambda db, horario: "a" * 64)


def _programar(db, coordinador, trimestre, horario, fecha=None):
    return service.programar(
        db,
        id_trimestre=trimestre.idTrimestre,
        ids_horarios=[horario.idHorario],
        fecha_local=fecha or datetime.now() + timedelta(hours=2),
        responsable=coordinador,
    )


def test_programar_interpreta_hora_local_bogota_y_cancela(db_session, crear_usuario, monkeypatch):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    local = datetime(2027, 1, 15, 10, 30)
    programada = _programar(db_session, coordinador, trimestre, horario, local)
    assert programada.fechaEjecucion.replace(tzinfo=timezone.utc) == datetime(
        2027, 1, 15, 15, 30, tzinfo=timezone.utc
    )
    cancelada = service.cancelar(db_session, programada, coordinador)
    assert cancelada.estado == "cancelada"


def test_programacion_rechaza_horario_publicado_o_de_otro_periodo(db_session, crear_usuario, monkeypatch):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    otro = Trimestre(
        nombre="2027-1", fechaInicio=date(2027, 1, 1), fechaFin=date(2027, 3, 31), estado="planeado"
    )
    db_session.add(otro)
    db_session.commit()
    with pytest.raises(service.PublicacionProgramadaError, match="período"):
        service.programar(
            db_session, id_trimestre=otro.idTrimestre,
            ids_horarios=[horario.idHorario], fecha_local=datetime.now() + timedelta(days=1),
            responsable=coordinador,
        )
    horario.publicado = True
    db_session.commit()
    with pytest.raises(service.PublicacionProgramadaError, match="borradores activos"):
        _programar(db_session, coordinador, trimestre, horario)


def test_reprogramar_refresca_revision_y_asociaciones(db_session, crear_usuario, monkeypatch):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    actualizada = service.reprogramar(
        db_session, programada, id_trimestre=trimestre.idTrimestre,
        ids_horarios=[horario.idHorario], fecha_local=datetime.now() + timedelta(days=2),
        responsable=coordinador,
    )
    assert actualizada.revision == 2
    assert actualizada.estado == "pendiente"
    assert service.ids_de_horarios(db_session, actualizada.idPublicacion) == [horario.idHorario]


def test_ejecucion_publica_atomicamente_y_segundo_worker_no_duplica(db_session, crear_usuario, monkeypatch):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    programada.fechaEjecucion = datetime.now(timezone.utc) - timedelta(seconds=2)
    db_session.commit()
    ahora = datetime.now(timezone.utc)
    assert service.ejecutar(db_session, programada.idPublicacion, ahora=ahora) is True
    assert db_session.get(Horario, horario.idHorario).publicado is True
    assert db_session.get(type(programada), programada.idPublicacion).estado == "publicada"
    assert service.ejecutar(db_session, programada.idPublicacion, ahora=ahora) is False
    avisos = db_session.execute(select(Notificacion).where(Notificacion.idUsuario == coordinador.idUsuario)).scalars().all()
    assert len(avisos) == 1
    assert "completó" in avisos[0].mensaje


def test_conflicto_falla_sin_publicar_y_solo_avisa_coordinacion(db_session, crear_usuario, monkeypatch):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    programada.fechaEjecucion = datetime.now(timezone.utc) - timedelta(seconds=2)
    db_session.commit()
    monkeypatch.setattr(service, "_validar_conjunto", lambda db, horarios: (_ for _ in ()).throw(
        service.PublicacionProgramadaError("conflicto de prueba")
    ))
    assert service.ejecutar(db_session, programada.idPublicacion) is False
    assert db_session.get(Horario, horario.idHorario).publicado is False
    assert db_session.get(type(programada), programada.idPublicacion).estado == "fallida"
    avisos = db_session.execute(select(Notificacion)).scalars().all()
    assert len(avisos) == 1
    assert avisos[0].idUsuario == coordinador.idUsuario
    assert avisos[0].tipo == "sistema"


def test_edicion_tras_programar_exige_revision_y_no_publica(db_session, crear_usuario, monkeypatch):
    monkeypatch.setattr(service, "_validar_conjunto", lambda db, horarios: None)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    horario.horaInicio = time(7)
    programada.fechaEjecucion = datetime.now(timezone.utc) - timedelta(seconds=2)
    db_session.commit()
    assert service.ejecutar(db_session, programada.idPublicacion) is False
    assert db_session.get(Horario, horario.idHorario).publicado is False
    assert db_session.get(type(programada), programada.idPublicacion).estado == "revision_requerida"
    avisos = db_session.execute(select(Notificacion)).scalars().all()
    assert len(avisos) == 1 and avisos[0].idUsuario == coordinador.idUsuario


def test_edicion_invalida_programacion_y_bloquea_publicacion_manual(db_session, crear_usuario, monkeypatch):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    HorarioService.invalidar_publicaciones_programadas(
        db_session, [horario.idHorario], "edición de prueba",
    )
    db_session.commit()
    assert db_session.get(type(programada), programada.idPublicacion).estado == "revision_requerida"
    with pytest.raises(PublicacionProgramadaPendienteError):
        HorarioService.cambiar_estado(db_session, horario.idHorario, publicado=True)


def test_worker_encuentra_vencidas_sin_sesion_de_interfaz(db_session, crear_usuario, monkeypatch):
    from app.workers import publicacion_programada_worker as worker

    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    programada.fechaEjecucion = datetime.now(timezone.utc) - timedelta(seconds=2)
    db_session.commit()
    id_programada = programada.idPublicacion
    procesadas = []
    monkeypatch.setattr(worker, "SessionLocal", lambda: db_session)
    monkeypatch.setattr(worker, "ejecutar", lambda db, id_publicacion: procesadas.append(id_publicacion) or True)

    assert worker.procesar_vencidas() == 1
    assert procesadas == [id_programada]


def test_fallo_de_notificacion_revierte_publicacion_y_avisos_de_destinatarios(
    db_session, crear_usuario, monkeypatch
):
    _patch_validation(monkeypatch)
    coordinador, _, trimestre, horario = _base(db_session, crear_usuario)
    programada = _programar(db_session, coordinador, trimestre, horario)
    programada.fechaEjecucion = datetime.now(timezone.utc) - timedelta(seconds=2)
    db_session.commit()

    def falla_aviso(*args, **kwargs):
        raise RuntimeError("fallo al persistir aviso de destinatario")

    monkeypatch.setattr(service.NotificacionService, "crear_agrupada_transaccional", falla_aviso)
    assert service.ejecutar(db_session, programada.idPublicacion) is False
    assert db_session.get(Horario, horario.idHorario).publicado is False
    assert db_session.get(type(programada), programada.idPublicacion).estado == "fallida"
    avisos = db_session.execute(select(Notificacion)).scalars().all()
    assert len(avisos) == 1 and avisos[0].tipo == "sistema"


def test_solo_coordinacion_y_admin_pueden_consultar(client, autenticar_como):
    _, headers = autenticar_como("Instructor")
    response = client.get("/api/v1/publicaciones-programadas/", headers=headers)
    assert response.status_code == 403
    _, coordinador_headers = autenticar_como("Coordinador")
    assert client.get("/api/v1/publicaciones-programadas/", headers=coordinador_headers).status_code == 200


def test_disponibilidad_worker_senal_vigente(db_session):
    from datetime import datetime, timezone

    from app.services.worker_publicacion_service import consultar_disponibilidad, registrar_senal

    assert consultar_disponibilidad(db_session)["habilitado"] is False

    registrar_senal(db_session)
    assert consultar_disponibilidad(db_session)["habilitado"] is True
    assert consultar_disponibilidad(
        db_session, ahora=datetime.now(timezone.utc) + timedelta(seconds=31)
    )["habilitado"] is False


def test_api_no_programa_si_no_hay_worker_activo(db_session, crear_usuario):
    from fastapi import HTTPException

    from app.api.v1.publicaciones_programadas import crear
    from app.schemas.publicacion_programada import PublicacionProgramadaInput

    coordinador = crear_usuario(nombre="Coordinador")
    with pytest.raises(HTTPException) as error:
        crear(
            PublicacionProgramadaInput(
                idTrimestre=1,
                idHorarios=[1],
                fechaHoraLocal=datetime(2099, 1, 1, 10),
            ),
            db=db_session,
            usuario=coordinador,
        )
    assert error.value.status_code == 503
    assert error.value.detail["motivo"] == "worker_no_disponible"


def test_dependencia_de_gestion_rechaza_otros_roles(crear_usuario, crear_rol):
    from fastapi import HTTPException

    from app.api.v1.publicaciones_programadas import puede_gestionar

    instructor = crear_usuario(roles=[crear_rol("Instructor")])
    with pytest.raises(HTTPException) as error:
        puede_gestionar(usuario=instructor)
    assert error.value.status_code == 403

    coordinador = crear_usuario(roles=[crear_rol("Coordinador")])
    assert puede_gestionar(usuario=coordinador) is coordinador
