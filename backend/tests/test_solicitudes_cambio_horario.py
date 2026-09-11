import uuid
from datetime import date, time

from app.core.database import Base
from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.solicitud_cambio_horario import SolicitudCambioHorario
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
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
        SolicitudCambioHorario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _armar_base(db_session, *, instructor, idAmbiente=1, idHorario=100, dias=(1,)):
    """Arma la cadena completa (coordinación -> ... -> horario) que exige
    HorarioService para poder aprobar una solicitud aplicando un cambio
    real, igual patrón que test_horarios_dry_run.py."""
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=idAmbiente, numero_ambiente=100 + idAmbiente, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, resultado, ficha])
    db_session.commit()

    horario = Horario(
        idHorario=idHorario, horaInicio=time(8, 0), horaFin=time(10, 0),
        idJornada=1, idTrimestre=1, idAmbiente=idAmbiente, idInstructor=instructor.idUsuario,
        idFicha=1, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    for id_dia in dias:
        db_session.execute(horario_dia.insert().values(idHorario=idHorario, idDia=id_dia))
    db_session.commit()
    return horario


def _payload_cambios_desde(horario, **overrides):
    payload = {
        "horaInicio": horario.horaInicio.isoformat(),
        "horaFin": horario.horaFin.isoformat(),
        "idJornada": horario.idJornada,
        "idTrimestre": horario.idTrimestre,
        "idAmbiente": horario.idAmbiente,
        "idInstructor": str(horario.idInstructor),
        "idFicha": horario.idFicha,
        "idResultado": horario.idResultado,
        "dias": [1],
        "forzar": False,
    }
    payload.update(overrides)
    return payload


def test_crear_requiere_instructor(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    instructor = crear_usuario(nombre="Carlos")
    horario = _armar_base(db_session, instructor=instructor)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "novedad", "motivo": "Incapacidad médica"},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_crear_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor)

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "novedad", "motivo": "Incapacidad médica"},
        headers=headers,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["tipo"] == "novedad"
    assert cuerpo["estado"] == "pendiente"
    assert cuerpo["idHorarioOrigen"] == horario.idHorario
    assert cuerpo["instructorNombre"]


def test_crear_sobre_horario_de_otro_instructor_da_403(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    otro_instructor = crear_usuario(nombre="Diana")
    horario = _armar_base(db_session, instructor=otro_instructor)
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "novedad", "motivo": "x"},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_crear_horario_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": 9999, "tipo": "novedad", "motivo": "x"},
        headers=headers,
    )

    assert respuesta.status_code == 404


def test_listar_requiere_coordinador_o_administrador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/solicitudes-cambio-horario/", headers=headers)

    assert respuesta.status_code == 403


def test_mias_solo_devuelve_las_del_instructor_autenticado(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor_a, headers_a = autenticar_como("Instructor")
    horario_a = _armar_base(db_session, instructor=instructor_a, idHorario=100)

    instructor_b, headers_b = autenticar_como("Instructor")
    horario_b = Horario(
        idHorario=200, horaInicio=time(10, 0), horaFin=time(12, 0), idJornada=1, idTrimestre=1,
        idAmbiente=1, idInstructor=instructor_b.idUsuario, idFicha=1, idResultado=9,
    )
    db_session.add(horario_b)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=200, idDia=1))
    db_session.commit()

    client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario_a.idHorario, "tipo": "novedad", "motivo": "de A"},
        headers=headers_a,
    )
    client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario_b.idHorario, "tipo": "novedad", "motivo": "de B"},
        headers=headers_b,
    )

    respuesta = client.get("/api/v1/solicitudes-cambio-horario/mias", headers=headers_a)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["motivo"] == "de A"


def test_aprobar_novedad_sin_cambios_no_toca_el_horario(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers_instructor = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor)
    creada = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "novedad", "motivo": "x"},
        headers=headers_instructor,
    ).json()

    _, headers_coord = autenticar_como("Coordinador")
    respuesta = client.put(
        f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/aprobar", json={}, headers=headers_coord
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "aprobada"
    assert cuerpo["fechaResolucion"] is not None


def test_aprobar_cambio_ambiente_sin_cruce_aplica_el_cambio(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers_instructor = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor, idAmbiente=1)
    # Ambiente 2 libre, sin nada programado ahí.
    db_session.add(Ambiente(id=2, numero_ambiente=102, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1))
    db_session.commit()

    creada = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "cambio-ambiente", "motivo": "Ambiente dañado"},
        headers=headers_instructor,
    ).json()

    _, headers_coord = autenticar_como("Coordinador")
    cambios = _payload_cambios_desde(horario, idAmbiente=2)
    respuesta = client.put(
        f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/aprobar",
        json={"cambios": cambios},
        headers=headers_coord,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "aprobada"

    horario_actualizado = client.get(f"/api/v1/horarios/{horario.idHorario}", headers=headers_coord).json()
    assert horario_actualizado["idAmbiente"] == 2


def test_aprobar_con_cruce_da_409_y_deja_la_solicitud_pendiente(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    instructor, headers_instructor = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor, idAmbiente=1, idHorario=100)

    # Ambiente 2 ya ocupado el mismo día/hora por otro horario -- moverse
    # ahí debe chocar.
    db_session.add(Ambiente(id=2, numero_ambiente=102, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1))
    db_session.commit()
    otro_instructor = crear_usuario(nombre="Diana")
    horario_ocupante = Horario(
        idHorario=200, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1, idTrimestre=1,
        idAmbiente=2, idInstructor=otro_instructor.idUsuario, idFicha=1, idResultado=9,
    )
    db_session.add(horario_ocupante)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=200, idDia=1))
    db_session.commit()

    creada = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "cambio-ambiente", "motivo": "x"},
        headers=headers_instructor,
    ).json()

    _, headers_coord = autenticar_como("Coordinador")
    cambios = _payload_cambios_desde(horario, idAmbiente=2)
    respuesta = client.put(
        f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/aprobar",
        json={"cambios": cambios},
        headers=headers_coord,
    )

    assert respuesta.status_code == 409

    # La solicitud sigue pendiente: el cruce bloqueó el cambio.
    pendientes = client.get("/api/v1/solicitudes-cambio-horario/?estado=pendiente", headers=headers_coord).json()
    assert any(s["idSolicitud"] == creada["idSolicitud"] for s in pendientes)


def test_aprobar_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.put("/api/v1/solicitudes-cambio-horario/9999/aprobar", json={}, headers=headers)

    assert respuesta.status_code == 404


def test_aprobar_ya_resuelta_da_400(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers_instructor = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor)
    creada = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "novedad", "motivo": "x"},
        headers=headers_instructor,
    ).json()

    _, headers_coord = autenticar_como("Coordinador")
    client.put(f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/aprobar", json={}, headers=headers_coord)

    respuesta = client.put(
        f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/aprobar", json={}, headers=headers_coord
    )

    assert respuesta.status_code == 400


def test_rechazar_caso_feliz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers_instructor = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor)
    creada = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "permuta", "motivo": "x"},
        headers=headers_instructor,
    ).json()

    _, headers_coord = autenticar_como("Coordinador")
    respuesta = client.put(
        f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/rechazar", headers=headers_coord
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "rechazada"


def test_rechazar_requiere_coordinador_o_administrador(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers_instructor = autenticar_como("Instructor")
    horario = _armar_base(db_session, instructor=instructor)
    creada = client.post(
        "/api/v1/solicitudes-cambio-horario/",
        json={"idHorarioOrigen": horario.idHorario, "tipo": "permuta", "motivo": "x"},
        headers=headers_instructor,
    ).json()

    respuesta = client.put(
        f"/api/v1/solicitudes-cambio-horario/{creada['idSolicitud']}/rechazar", headers=headers_instructor
    )

    assert respuesta.status_code == 403
