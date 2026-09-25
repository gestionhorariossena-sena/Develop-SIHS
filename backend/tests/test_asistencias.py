"""Registro de asistencia por sesión.

Lo que se fija acá es el reparto de permisos, que es la razón de ser del
módulo: la asistencia la certifica el instructor que dictó ESA clase, y el
aprendiz solo puede leer la suya.
"""

import uuid
from datetime import date, time, timedelta

import pytest

from app.models.ambiente import Ambiente
from app.models.asistencia import Asistencia
from app.models.auditoria import Auditoria
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas(db_session):
    from app.core.database import Base

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
            Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__,
            ResultadoAprendizaje.__table__, Horario.__table__, horario_dia,
            Usuario.__table__, Asistencia.__table__,
        ],
    )


def _catalogos(db_session):
    db_session.add_all([
        Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología"),
        Programa(idPrograma=1, codigoPrograma="ADSO", nombrePrograma="ADSO", nivelFormacion="Tecnólogo", activo=True, idCoordinacion=1),
        Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 12, 30), estado="activo"),
        Sede(id=1, nombre="Calle 52", direccion="Calle 52", tipo="principal"),
        Ambiente(id=1, numero_ambiente=101, nombre="Laboratorio 302", tipo_ambiente="especial", estado_ambiente="disponible", sede_id=1),
        Jornada(idJornada=1, nombreJornada="Mañana"),
        DiaSemana(idDia=1, nombreDia="Lunes"),
        ResultadoAprendizaje(idResultado=9, descripcion="Arquitectura de software", codigo="RA-9", idCompetencia=1, horasAsignadas=10),
        Ficha(idFicha=1, codigoFicha="3171618", idPrograma=1, idTrimestre=1),
    ])
    db_session.commit()


def _horario_del(db_session, instructor, id_horario=100, id_dia=1):
    horario = Horario(
        idHorario=id_horario, horaInicio=time(11, 0), horaFin=time(13, 0), idJornada=1,
        idTrimestre=1, idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=1, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=id_dia))
    db_session.commit()
    return horario


def _matricular(db_session, crear_usuario, crear_rol, nombre="Sara Rodríguez", documento="1023456789"):
    aprendiz = crear_usuario(nombre=nombre, roles=[crear_rol("Aprendiz")])
    aprendiz.numeroDocumento = documento
    db_session.add(FichaUsuario(idFicha=1, idUsuario=aprendiz.idUsuario))
    db_session.commit()
    return aprendiz


def _lunes_pasado() -> date:
    hoy = date.today()
    return hoy - timedelta(days=(hoy.isoweekday() - 1) % 7 or 7)


@pytest.fixture()
def escenario(client, db_session, autenticar_como, crear_usuario, crear_rol):
    _crear_tablas(db_session)
    _catalogos(db_session)
    instructor, headers = autenticar_como("Instructor")
    horario = _horario_del(db_session, instructor)
    aprendiz = _matricular(db_session, crear_usuario, crear_rol)
    return {
        "instructor": instructor, "headers": headers, "horario": horario,
        "aprendiz": aprendiz, "fecha": _lunes_pasado().isoformat(),
    }


def test_la_nomina_sale_de_los_aprendices_vinculados_a_la_ficha(client, escenario):
    respuesta = client.get(
        f"/api/v1/asistencias/sesion?idHorario=100&fecha={escenario['fecha']}",
        headers=escenario["headers"],
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["fichaCodigo"] == "3171618"
    assert len(cuerpo["aprendices"]) == 1
    # Sin marcar todavía: `null` no es lo mismo que "ausente".
    assert cuerpo["aprendices"][0]["estado"] is None
    assert cuerpo["registradaEn"] is None


def test_el_instructor_pasa_lista_y_queda_registrada(client, db_session, escenario):
    respuesta = client.post(
        "/api/v1/asistencias/sesion",
        json={
            "idHorario": 100,
            "fechaSesion": escenario["fecha"],
            "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "presente"}],
        },
        headers=escenario["headers"],
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["eraPrimeraVez"] is True

    guardada = db_session.query(Asistencia).one()
    assert guardada.estado == "presente"
    assert guardada.fechaSesion.isoformat() == escenario["fecha"]
    # Marcar presente deja la hora en que se le marcó presencia.
    assert guardada.horaMarcacion is not None


def test_volver_a_pasar_lista_corrige_en_vez_de_duplicar(client, db_session, escenario):
    cuerpo = {
        "idHorario": 100,
        "fechaSesion": escenario["fecha"],
        "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "ausente"}],
    }
    client.post("/api/v1/asistencias/sesion", json=cuerpo, headers=escenario["headers"])

    cuerpo["marcas"][0]["estado"] = "presente"
    segunda = client.post("/api/v1/asistencias/sesion", json=cuerpo, headers=escenario["headers"])

    assert segunda.status_code == 200
    assert segunda.json()["corregidas"] == 1
    assert db_session.query(Asistencia).count() == 1
    assert db_session.query(Asistencia).one().estado == "presente"


def test_la_correccion_queda_auditada(client, db_session, escenario):
    cuerpo = {
        "idHorario": 100,
        "fechaSesion": escenario["fecha"],
        "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "ausente"}],
    }
    client.post("/api/v1/asistencias/sesion", json=cuerpo, headers=escenario["headers"])
    cuerpo["marcas"][0]["estado"] = "presente"
    client.post("/api/v1/asistencias/sesion", json=cuerpo, headers=escenario["headers"])

    acciones = [a.accion for a in db_session.query(Auditoria).all()]
    assert "REGISTRAR_ASISTENCIA" in acciones
    assert "CORREGIR_ASISTENCIA" in acciones


def test_un_instructor_no_pasa_lista_de_la_clase_de_otro(client, db_session, autenticar_como, escenario):
    _, headers_otro = autenticar_como("Instructor")

    respuesta = client.get(
        f"/api/v1/asistencias/sesion?idHorario=100&fecha={escenario['fecha']}", headers=headers_otro
    )
    assert respuesta.status_code == 404

    envio = client.post(
        "/api/v1/asistencias/sesion",
        json={
            "idHorario": 100,
            "fechaSesion": escenario["fecha"],
            "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "presente"}],
        },
        headers=headers_otro,
    )
    assert envio.status_code == 404
    assert db_session.query(Asistencia).count() == 0


def test_un_aprendiz_no_puede_registrar_asistencia(client, autenticar_como, escenario):
    _, headers_aprendiz = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/asistencias/sesion",
        json={"idHorario": 100, "fechaSesion": escenario["fecha"], "marcas": []},
        headers=headers_aprendiz,
    )

    assert respuesta.status_code == 403


def test_no_se_puede_marcar_a_alguien_de_otra_ficha(client, db_session, crear_usuario, crear_rol, escenario):
    ajeno = crear_usuario(nombre="De otra ficha", roles=[crear_rol("Aprendiz")])

    respuesta = client.post(
        "/api/v1/asistencias/sesion",
        json={
            "idHorario": 100,
            "fechaSesion": escenario["fecha"],
            "marcas": [{"idUsuarioAprendiz": str(ajeno.idUsuario), "estado": "presente"}],
        },
        headers=escenario["headers"],
    )

    assert respuesta.status_code == 422
    assert "no están matriculadas" in respuesta.json()["detail"]


def test_no_se_pasa_lista_de_un_dia_en_que_esa_clase_no_se_dicta(client, escenario):
    # El horario es de lunes (idDia=1); se manda un martes.
    martes = (_lunes_pasado() + timedelta(days=1)).isoformat()

    respuesta = client.post(
        "/api/v1/asistencias/sesion",
        json={
            "idHorario": 100,
            "fechaSesion": martes,
            "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "presente"}],
        },
        headers=escenario["headers"],
    )

    assert respuesta.status_code == 422
    assert "día de la semana" in respuesta.json()["detail"]


def test_no_se_pasa_lista_de_una_clase_futura(client, escenario):
    proximo_lunes = (_lunes_pasado() + timedelta(days=7)).isoformat()

    respuesta = client.post(
        "/api/v1/asistencias/sesion",
        json={
            "idHorario": 100,
            "fechaSesion": proximo_lunes,
            "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "presente"}],
        },
        headers=escenario["headers"],
    )

    assert respuesta.status_code == 422


def test_el_aprendiz_ve_su_historial_con_el_detalle_de_cada_sesion(
    client, db_session, autenticar_como, fake_supabase, escenario
):
    client.post(
        "/api/v1/asistencias/sesion",
        json={
            "idHorario": 100,
            "fechaSesion": escenario["fecha"],
            "marcas": [{"idUsuarioAprendiz": str(escenario["aprendiz"].idUsuario), "estado": "presente"}],
        },
        headers=escenario["headers"],
    )

    # El aprendiz entra con SU sesión.
    token = f"token-{uuid.uuid4()}"
    fake_supabase(token, id=str(escenario["aprendiz"].idUsuario), email=escenario["aprendiz"].email)
    respuesta = client.get("/api/v1/asistencias/mias", headers={"Authorization": f"Bearer {token}"})

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["resumen"]["presente"] == 1
    assert cuerpo["resumen"]["porcentaje"] == 100.0
    assert cuerpo["sesiones"][0]["resultadoDescripcion"] == "Arquitectura de software"
    assert cuerpo["sesiones"][0]["ambienteNombre"] == "Laboratorio 302"


def test_la_excusa_no_cuenta_contra_el_porcentaje(client, db_session, crear_usuario, crear_rol, autenticar_como, fake_supabase, escenario):
    """Reglamento del aprendiz: una falta con excusa se descuenta del total,
    no se cuenta como inasistencia."""
    aprendiz = escenario["aprendiz"]
    otro_lunes = (_lunes_pasado() - timedelta(days=7)).isoformat()

    for fecha, estado in ((escenario["fecha"], "presente"), (otro_lunes, "excusa")):
        client.post(
            "/api/v1/asistencias/sesion",
            json={
                "idHorario": 100,
                "fechaSesion": fecha,
                "marcas": [{"idUsuarioAprendiz": str(aprendiz.idUsuario), "estado": estado}],
            },
            headers=escenario["headers"],
        )

    token = f"token-{uuid.uuid4()}"
    fake_supabase(token, id=str(aprendiz.idUsuario), email=aprendiz.email)
    resumen = client.get("/api/v1/asistencias/mias", headers={"Authorization": f"Bearer {token}"}).json()["resumen"]

    assert resumen["registradas"] == 2
    assert resumen["excusa"] == 1
    # 1 presente sobre 1 computable: la excusa no baja el porcentaje.
    assert resumen["porcentaje"] == 100.0


def test_un_instructor_no_puede_leer_la_asistencia_de_un_aprendiz(client, escenario):
    respuesta = client.get("/api/v1/asistencias/mias", headers=escenario["headers"])

    assert respuesta.status_code == 403
