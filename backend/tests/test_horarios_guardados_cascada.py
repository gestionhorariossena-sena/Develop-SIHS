"""Bug reportado 2026-09-02: borrar un "horario completo" (horarios_
guardados, el snapshot que arma NuevoHorario.tsx) no borraba las clases
reales correspondientes en `horarios` — quedaban huérfanas y el instructor
seguía "ocupado" para cruces aunque su horario ya no apareciera en el
historial. Las dos tablas no tenían ningún vínculo. Ahora el snapshot
guarda `idsHorarios` (los ids reales creados en el mismo guardado) y
borrarlo borra también esas clases."""

import uuid
from datetime import date, time, timedelta

import pytest

from app.models.ambiente import Ambiente
from app.models.anotacion_horario import AnotacionHorario
from app.models.asistencia import Asistencia
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.horario_guardado import HorarioGuardado
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.solicitud_cambio_horario import SolicitudCambioHorario
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
        Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__,
        ResultadoAprendizaje.__table__, Horario.__table__, horario_dia, Usuario.__table__,
        HorarioGuardado.__table__,
        Asistencia.__table__, AnotacionHorario.__table__, SolicitudCambioHorario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología", nivelFormacion="Técnico", activo=True, idCoordinacion=1)
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos López", email="carlos.guardado@example.com", tipoContrato="planta")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, resultado, instructor, ficha])
    db_session.commit()

    horario = Horario(
        idHorario=500, horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1, idTrimestre=1,
        idAmbiente=ambiente.id, idInstructor=instructor.idUsuario, idFicha=ficha.idFicha, idResultado=resultado.idResultado,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=500, idDia=1))
    db_session.commit()

    return {"idHorario": horario.idHorario, "idInstructor": instructor.idUsuario}


def _crear_snapshot(db_session, id_horario, usuario_id, *, publicado=True):
    horario = db_session.query(Horario).filter(Horario.idHorario == id_horario).one()
    horario.publicado = publicado
    snapshot = HorarioGuardado(
        idUsuario=usuario_id,
        ficha="FICHA-001",
        aprendices="30",
        horasTrimestre="20",
        bloques=[{"id": "b1", "tematica": "Tema", "instructor": "Carlos", "ficha": "FICHA-001", "ambiente": "Ambiente"}],
        grid=[["b1"]],
        idsHorarios=[id_horario],
    )
    db_session.add(snapshot)
    db_session.commit()
    return snapshot


def _payload_reemplazo(db_session, id_horario, id_instructor, *, inicio="08:00:00", id_resultado=9):
    fecha_original = db_session.query(Horario).filter_by(idHorario=id_horario).one().fechaModificacion
    return {
        "ficha": "FICHA-001", "aprendices": "30", "horasTrimestre": "20",
        "fechaInicio": None, "fechaFin": None,
        "bloques": [{"id": "b1", "tematica": "Tema editado", "instructor": "Carlos", "ficha": "FICHA-001", "ambiente": "Ambiente"}],
        "grid": [["b1"]],
        "horarios": [{
            "horaInicio": inicio, "horaFin": "10:00:00", "idJornada": 1,
            "idTrimestre": 1, "idAmbiente": 1, "idInstructor": str(id_instructor),
            "idFicha": 1, "idResultado": id_resultado, "dias": [1],
            "idHorarioOriginal": id_horario,
            "fechaModificacionOriginal": fecha_original.isoformat(),
            "bloqueIdx": 0, "bloqueId": "b1",
        }],
    }


def test_reemplazo_exitoso_preserva_id_y_estado_borrador(client, db_session, autenticar_como, monkeypatch):
    from app.services.horario_service import HorarioService

    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario, publicado=False)
    monkeypatch.setattr(HorarioService, "_validar_ficha_del_periodo", staticmethod(lambda *_: None))

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=_payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"]),
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text
    db_session.refresh(snapshot)
    horario = db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one()
    assert snapshot.idsHorarios == [catalogos["idHorario"]]
    assert horario.horaInicio == time(8, 0)
    assert horario.activo is True
    assert horario.publicado is False
    from app.models.notificacion import Notificacion
    assert db_session.query(Notificacion).count() == 0


def test_reemplazo_con_conflicto_revierte_y_conserva_snapshot(client, db_session, autenticar_como, monkeypatch):
    from app.services.horario_service import HorarioService

    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario)
    monkeypatch.setattr(HorarioService, "_validar_ficha_del_periodo", staticmethod(lambda *_: None))
    monkeypatch.setattr(HorarioService, "_detectar_cruces", staticmethod(lambda *_args, **_kwargs: ["conflicto simulado"]))

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=_payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"]),
        headers=headers,
    )

    assert respuesta.status_code == 409
    db_session.refresh(snapshot)
    horario = db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one()
    assert snapshot.idsHorarios == [catalogos["idHorario"]]
    assert horario.horaInicio == time(7, 0)
    assert horario.publicado is True


def test_fallo_intermedio_revierte_horario_snapshot_y_notificaciones(client, db_session, autenticar_como, monkeypatch):
    from app.models.notificacion import Notificacion
    from app.services.auditoria_service import AuditoriaService
    from app.services.horario_service import HorarioService

    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario)
    monkeypatch.setattr(HorarioService, "_validar_ficha_del_periodo", staticmethod(lambda *_: None))
    monkeypatch.setattr(HorarioService, "_detectar_cruces", staticmethod(lambda *_args, **_kwargs: []))
    monkeypatch.setattr(AuditoriaService, "registrar_transaccional", staticmethod(lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("fallo intermedio"))))

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=_payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"]),
        headers=headers,
    )

    assert respuesta.status_code == 500
    db_session.refresh(snapshot)
    horario = db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one()
    assert horario.horaInicio == time(7, 0)
    assert horario.publicado is True
    assert snapshot.idsHorarios == [catalogos["idHorario"]]
    assert db_session.query(Notificacion).count() == 0


def test_detecta_conflicto_entre_asignaciones_nuevas_y_retrocede(client, db_session, autenticar_como, monkeypatch):
    from app.services.horario_service import HorarioService

    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario)
    monkeypatch.setattr(HorarioService, "_validar_ficha_del_periodo", staticmethod(lambda *_: None))
    payload = _payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"])
    payload["bloques"].append({"id": "b2", "tematica": "Tema 2", "instructor": "Carlos", "ficha": "FICHA-001", "ambiente": "Ambiente"})
    payload["grid"] = [["b1"], ["b2"]]
    segunda = {**payload["horarios"][0], "idHorarioOriginal": None}
    segunda["fechaModificacionOriginal"] = None
    segunda["bloqueIdx"] = 1
    segunda["bloqueId"] = "b2"
    payload["horarios"].append(segunda)

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=payload,
        headers=headers,
    )

    assert respuesta.status_code == 409
    db_session.refresh(snapshot)
    assert snapshot.idsHorarios == [catalogos["idHorario"]]
    assert db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one().horaInicio == time(7, 0)


def test_edicion_publicada_notifica_solo_despues_de_confirmar(client, db_session, autenticar_como, monkeypatch):
    from app.models.notificacion import Notificacion
    from app.services.horario_service import HorarioService

    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario, publicado=True)
    monkeypatch.setattr(HorarioService, "_validar_ficha_del_periodo", staticmethod(lambda *_: None))

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=_payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"]),
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text
    horario = db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one()
    assert horario.publicado is True
    notificaciones = db_session.query(Notificacion).all()
    assert len(notificaciones) == 1
    assert notificaciones[0].idUsuario == catalogos["idInstructor"]


def test_reemplazo_requiere_rol_de_coordinacion(client, db_session, autenticar_como, monkeypatch):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, _ = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario)
    _, headers = autenticar_como("Instructor")

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=_payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"]),
        headers=headers,
    )

    assert respuesta.status_code == 403
    assert db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one().horaInicio == time(7, 0)


def test_rechaza_edicion_obsoleta_sin_sobrescribir_cambio_reciente(client, db_session, autenticar_como, monkeypatch):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    coordinador, headers = autenticar_como("Coordinador")
    snapshot = _crear_snapshot(db_session, catalogos["idHorario"], coordinador.idUsuario)
    payload = _payload_reemplazo(db_session, catalogos["idHorario"], catalogos["idInstructor"])
    horario = db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one()
    horario.horaInicio = time(7, 30)
    horario.fechaModificacion = horario.fechaModificacion + timedelta(seconds=1)
    db_session.commit()

    respuesta = client.put(
        f"/api/v1/horarios-guardados/{snapshot.idHorarioGuardado}/reemplazar",
        json=payload,
        headers=headers,
    )

    assert respuesta.status_code == 409
    assert "cambió desde que se abrió" in respuesta.json()["detail"]
    assert db_session.query(Horario).filter_by(idHorario=catalogos["idHorario"]).one().horaInicio == time(7, 30)


def test_borrar_horario_completo_borra_tambien_la_clase_real_vinculada(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    payload = {
        "ficha": "FICHA-001", "aprendices": "30", "horasTrimestre": "20",
        "fechaInicio": None, "fechaFin": None,
        "bloques": [{"id": "b1", "tematica": "Tema", "instructor": "Carlos López", "ficha": "FICHA-001", "ambiente": "Ambiente"}],
        "grid": [["b1"]],
        "idsHorarios": [catalogos["idHorario"]],
    }
    creado = client.post("/api/v1/horarios-guardados/", json=payload, headers=headers)
    assert creado.status_code == 200
    id_guardado = creado.json()["idHorarioGuardado"]

    respuesta = client.delete(f"/api/v1/horarios-guardados/{id_guardado}", headers=headers)

    assert respuesta.status_code == 200
    assert db_session.query(HorarioGuardado).count() == 0
    # Antes del fix esta clase quedaba huérfana — el instructor seguía
    # "ocupado" para cruces aunque el horario completo ya no apareciera.
    assert db_session.query(Horario).filter(Horario.idHorario == catalogos["idHorario"]).first() is None


def test_borrar_horario_completo_sin_idshorarios_no_falla_ni_borra_otras_clases(client, db_session, autenticar_como):
    """Snapshots creados antes de este fix (o sin idsHorarios por lo que
    sea) siguen borrándose sin romper — solo no pueden liberar la clase
    real, porque no hay forma de saber cuál era."""
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    payload = {
        "ficha": "FICHA-001", "aprendices": "30", "horasTrimestre": "20",
        "fechaInicio": None, "fechaFin": None,
        "bloques": [{"id": "b1", "tematica": "Tema", "instructor": "Carlos López", "ficha": "FICHA-001", "ambiente": "Ambiente"}],
        "grid": [["b1"]],
    }
    creado = client.post("/api/v1/horarios-guardados/", json=payload, headers=headers)
    id_guardado = creado.json()["idHorarioGuardado"]

    respuesta = client.delete(f"/api/v1/horarios-guardados/{id_guardado}", headers=headers)

    assert respuesta.status_code == 200
    assert db_session.query(HorarioGuardado).count() == 0
    assert db_session.query(Horario).filter(Horario.idHorario == catalogos["idHorario"]).first() is not None


def test_listar_horarios_guardados_con_idshorarios_null_no_da_500(client, db_session, autenticar_como):
    """Bug reportado 2026-09-02, segunda vuelta: snapshots creados ANTES
    de que existiera la columna `idsHorarios` quedan con NULL en la BD
    real (no `[]` — el default de Pydantic solo aplica cuando el cliente
    omite el campo al crear, no a filas insertadas por fuera de la API).
    GET /horarios-guardados/ tumbaba TODO el listado con
    ResponseValidationError apenas topaba una fila así — en Historial de
    horarios esto se veía como "solo cargan los horarios individuales,
    nunca los completos"."""
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    usuario, headers = autenticar_como("Coordinador")

    guardado_legado = HorarioGuardado(
        idUsuario=usuario.idUsuario,
        ficha="FICHA-VIEJA",
        bloques=[{"id": "b1", "tematica": "Tema", "instructor": "Carlos López", "ficha": "FICHA-VIEJA", "ambiente": "Ambiente"}],
        grid=[["b1"]],
        # Sin idsHorarios: queda NULL en la BD, como cualquier fila creada
        # antes de que este campo existiera.
    )
    db_session.add(guardado_legado)
    db_session.commit()

    respuesta = client.get("/api/v1/horarios-guardados/", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["idsHorarios"] == []


def test_listar_horarios_guardados_expone_programa_de_la_ficha(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    usuario, headers = autenticar_como("Coordinador")

    guardado = HorarioGuardado(
        idUsuario=usuario.idUsuario,
        ficha="FICHA-001",
        bloques=[],
        grid=[],
    )
    db_session.add(guardado)
    db_session.commit()

    respuesta = client.get("/api/v1/horarios-guardados/", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()[0]["programaNombre"] == "Tecnología"


def test_listar_horarios_guardados_sin_ficha_catalogada_deja_programa_nulo(
    client, db_session, autenticar_como
):
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    usuario, headers = autenticar_como("Coordinador")

    guardado = HorarioGuardado(
        idUsuario=usuario.idUsuario,
        ficha="FICHA-MANUAL",
        bloques=[],
        grid=[],
    )
    db_session.add(guardado)
    db_session.commit()

    respuesta = client.get("/api/v1/horarios-guardados/", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()[0]["programaNombre"] is None


def test_instructor_no_puede_ver_el_historial_de_horarios_de_otros(client, db_session, autenticar_como):
    """Reportado 2026-09-03: un Instructor podía pedir GET
    /horarios-guardados/ directo (sin pasar por el sidebar) y ver los
    snapshots de TODOS los instructores — esta ruta solo chequeaba
    autenticación, no rol. Es una herramienta de coordinación; el
    Instructor ve su propio horario vigente vía /usuarios/me/horarios."""
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/horarios-guardados/", headers=headers)

    assert respuesta.status_code == 403
