from datetime import time

from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.notificacion import Notificacion
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede


def _crear_tablas_horario(db_session):
    from app.core.database import Base

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Ambiente.__table__,
            Sede.__table__,
            Jornada.__table__,
            DiaSemana.__table__,
            ResultadoAprendizaje.__table__,
            Horario.__table__,
            horario_dia,
            Notificacion.__table__,
        ],
    )


def test_vincular_requiere_aprendiz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Instructor")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 403


def test_vincular_caso_feliz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["idFicha"] == ficha.idFicha
    assert cuerpo["codigoFicha"] == ficha.codigoFicha


def test_vincular_ficha_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": "0000000"}, headers=headers
    )

    assert respuesta.status_code == 404


def test_vincular_usuario_ya_vinculado_da_400(client, autenticar_como, crear_ficha):
    ficha_1 = crear_ficha(codigo="2874521")
    ficha_2 = crear_ficha(codigo="3068356")
    _, headers = autenticar_como("Aprendiz")

    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha_1.codigoFicha}, headers=headers)
    respuesta = client.post(
        "/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha_2.codigoFicha}, headers=headers
    )

    assert respuesta.status_code == 400


def test_mi_ficha_requiere_aprendiz(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 403


def test_mi_ficha_caso_feliz(client, autenticar_como, crear_ficha):
    ficha = crear_ficha(codigo="2874521")
    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["idFicha"] == ficha.idFicha


def test_mi_ficha_sin_vincular_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-ficha", headers=headers)

    assert respuesta.status_code == 404


def test_mi_horario_requiere_aprendiz(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 403


def test_mi_horario_sin_vincular_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "No tienes una ficha vinculada"


def test_mi_horario_devuelve_horario_enriquecido_de_la_ficha(
    client, db_session, autenticar_como, crear_ficha
):
    _crear_tablas_horario(db_session)
    ficha = crear_ficha(codigo="2874521")
    aprendiz, headers = autenticar_como("Aprendiz")
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz.idUsuario))

    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(
        id=1,
        numero_ambiente=101,
        nombre="Ambiente",
        tipo_ambiente="regular",
        estado_ambiente="disponible",
        sede_id=sede.id,
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(
        idResultado=1,
        codigo="RA-1",
        descripcion="Resultado de prueba",
        idCompetencia=1,
        horasAsignadas=10,
    )
    db_session.add_all([sede, ambiente, jornada, dia, resultado])
    db_session.commit()

    horario = Horario(
        idHorario=1,
        horaInicio=time(7, 0),
        horaFin=time(9, 0),
        idJornada=jornada.idJornada,
        idTrimestre=ficha.idTrimestre,
        idAmbiente=ambiente.id,
        idInstructor=aprendiz.idUsuario,
        idFicha=ficha.idFicha,
        idResultado=resultado.idResultado,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=dia.idDia))
    db_session.commit()

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 200
    body = respuesta.json()
    assert len(body) == 1
    assert body[0]["idFicha"] == ficha.idFicha
    assert body[0]["dias"] == [1]
    assert body[0]["fichaCodigo"] == ficha.codigoFicha
    assert body[0]["ambienteNombre"] == "Ambiente"
    assert body[0]["resultadoCodigo"] == "RA-1"
    assert body[0]["resultadoDescripcion"] == "Resultado de prueba"


def test_actualizar_horario_notifica_al_aprendiz_si_cambia_ambiente_o_instructor(
    client, db_session, autenticar_como, crear_ficha, crear_usuario
):
    _crear_tablas_horario(db_session)
    ficha = crear_ficha(codigo="2874521")
    aprendiz, aprendiz_headers = autenticar_como("Aprendiz")
    _, coordinador_headers = autenticar_como("Coordinador")
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz.idUsuario))

    instructor_anterior = crear_usuario(nombre="Instructor anterior")
    instructor_nuevo = crear_usuario(nombre="Instructor nuevo")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente_anterior = Ambiente(
        id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular",
        estado_ambiente="disponible", sede_id=sede.id,
    )
    ambiente_nuevo = Ambiente(
        id=2, numero_ambiente=102, nombre="Ambiente", tipo_ambiente="regular",
        estado_ambiente="disponible", sede_id=sede.id,
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(
        idResultado=1, codigo="RA-1", descripcion="Resultado de prueba",
        idCompetencia=1, horasAsignadas=10,
    )
    db_session.add_all([
        sede, ambiente_anterior, ambiente_nuevo, jornada, dia, resultado,
    ])
    db_session.commit()

    horario = Horario(
        idHorario=1, horaInicio=time(7, 0), horaFin=time(9, 0),
        idJornada=jornada.idJornada, idTrimestre=ficha.idTrimestre,
        idAmbiente=ambiente_anterior.id, idInstructor=instructor_anterior.idUsuario,
        idFicha=ficha.idFicha, idResultado=resultado.idResultado,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=dia.idDia))
    db_session.commit()

    payload = {
        "horaInicio": "07:00:00", "horaFin": "09:00:00", "idJornada": 1,
        "idTrimestre": ficha.idTrimestre, "idAmbiente": ambiente_nuevo.id,
        "idInstructor": str(instructor_nuevo.idUsuario), "idFicha": ficha.idFicha,
        "idResultado": resultado.idResultado, "dias": [1],
    }
    respuesta = client.put("/api/v1/horarios/1", json=payload, headers=coordinador_headers)

    assert respuesta.status_code == 200
    notificaciones = client.get("/api/v1/notificaciones/", headers=aprendiz_headers)
    assert notificaciones.status_code == 200
    assert len(notificaciones.json()) == 1
    notificacion = notificaciones.json()[0]
    assert notificacion["tipo"] == "Cambios de Aula & Horario"
    assert notificacion["entidadRelacionada"] == "horarios"
    assert notificacion["idEntidadRelacionada"] == "1"
    assert "Ambiente" in notificacion["mensaje"]
    assert "Instructor nuevo" in notificacion["mensaje"]

    respuesta_sin_cambio = client.put(
        "/api/v1/horarios/1", json=payload, headers=coordinador_headers
    )
    assert respuesta_sin_cambio.status_code == 200
    assert len(client.get("/api/v1/notificaciones/", headers=aprendiz_headers).json()) == 1
