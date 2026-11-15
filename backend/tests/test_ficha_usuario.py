from datetime import date, time, timedelta

from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.notificacion import Notificacion
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre


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


def test_mi_horario_sin_ficha_vinculada_da_404(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "No tienes una ficha vinculada"


def test_mi_horario_caso_feliz(client, db_session, autenticar_como, crear_usuario, crear_ficha):
    _crear_tablas_horario(db_session)

    ficha = crear_ficha(codigo="2874521")
    instructor = crear_usuario(nombre="Carlos")

    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    db_session.add_all([sede, ambiente, jornada, dia_lunes, resultado])
    db_session.commit()

    horario = Horario(
        idHorario=100, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=ficha.idTrimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.commit()

    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["idHorario"] == 100
    assert cuerpo[0]["instructorNombre"] == "Carlos"
    assert cuerpo[0]["fichaCodigo"] == ficha.codigoFicha
    assert cuerpo[0]["dias"] == [1]


def test_mi_horario_con_idtrimestre_filtra_por_ese_trimestre(
    client, db_session, autenticar_como, crear_usuario, crear_ficha
):
    """Selector de Trimestre de MiHorarioAprendiz.tsx: con `?idTrimestre=`
    se filtra por el trimestre propio de cada Horario, sin importar en
    cuál esté la ficha ahora mismo -- así se puede ver un trimestre
    histórico de la misma ficha."""
    _crear_tablas_horario(db_session)

    ficha = crear_ficha(codigo="2874521")  # vigente: ficha.idTrimestre
    instructor = crear_usuario(nombre="Carlos")

    historico = Trimestre(
        nombre="Trimestre histórico",
        fechaInicio=date.today() - timedelta(days=270),
        fechaFin=date.today() - timedelta(days=180),
        estado="finalizado",
    )
    db_session.add(historico)
    db_session.commit()

    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado_actual = ResultadoAprendizaje(idResultado=9, descripcion="Resultado actual", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    resultado_historico = ResultadoAprendizaje(idResultado=10, descripcion="Resultado histórico", codigo="RA-H", idCompetencia=1, horasAsignadas=10)
    db_session.add_all([sede, ambiente, jornada, dia_lunes, resultado_actual, resultado_historico])
    db_session.commit()

    horario_actual = Horario(
        idHorario=201, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=ficha.idTrimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=9,
    )
    horario_historico = Horario(
        idHorario=202, horaInicio=time(10, 0), horaFin=time(12, 0), idJornada=1,
        idTrimestre=historico.idTrimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=10,
    )
    db_session.add_all([horario_actual, horario_historico])
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=201, idDia=1))
    db_session.execute(horario_dia.insert().values(idHorario=202, idDia=1))
    db_session.commit()

    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    # Pidiendo el trimestre vigente de la ficha -> solo ese horario.
    respuesta_actual = client.get(
        f"/api/v1/ficha-usuario/mi-horario?idTrimestre={ficha.idTrimestre}", headers=headers
    )
    assert respuesta_actual.status_code == 200
    cuerpo_actual = respuesta_actual.json()
    assert len(cuerpo_actual) == 1
    assert cuerpo_actual[0]["idHorario"] == 201

    # Pidiendo el histórico -> solo el otro horario, aunque la ficha
    # siga en su trimestre vigente.
    respuesta_historico = client.get(
        f"/api/v1/ficha-usuario/mi-horario?idTrimestre={historico.idTrimestre}", headers=headers
    )
    assert respuesta_historico.status_code == 200
    cuerpo_historico = respuesta_historico.json()
    assert len(cuerpo_historico) == 1
    assert cuerpo_historico[0]["idHorario"] == 202
    assert cuerpo_historico[0]["idTrimestre"] == historico.idTrimestre


def test_mi_rol_sin_ficha_devuelve_none(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/ficha-usuario/mi-rol", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["rolEnFicha"] is None


def test_mi_rol_devuelve_vocero_cuando_corresponde(client, autenticar_como, crear_ficha, db_session):
    ficha = crear_ficha(codigo="2874521")
    usuario, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    vinculo = db_session.query(FichaUsuario).filter(FichaUsuario.idUsuario == usuario.idUsuario).first()
    vinculo.rolEnFicha = "vocero"
    db_session.commit()

    respuesta = client.get("/api/v1/ficha-usuario/mi-rol", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["rolEnFicha"] == "vocero"


def test_trimestres_lectura_permite_aprendiz(client, autenticar_como):
    """El catálogo de trimestres (nombre/fechas/estado) debe quedar
    visible para el Aprendiz -- lo necesita el selector de Trimestre de
    Mi Horario. Sigue vedado el resto de catálogos (fichas, ambientes...)."""
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/trimestres/", headers=headers)

    assert respuesta.status_code == 200


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
    assert body[0]["ambienteNombre"] == "Ambiente 101"
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
    # H-8: el tipo tiene que ser uno de los cuatro que el panel de la
    # campana sabe pintar. Antes era "Cambios de Aula & Horario", que no
    # es ninguno, así que la notificación llegaba sin icono ni color.
    assert notificacion["tipo"] == "ambiente"
    assert notificacion["entidadRelacionada"] == "horarios"
    assert notificacion["idEntidadRelacionada"] == "1"
    assert "Ambiente" in notificacion["mensaje"]
    assert "Instructor nuevo" in notificacion["mensaje"]

    respuesta_sin_cambio = client.put(
        "/api/v1/horarios/1", json=payload, headers=coordinador_headers
    )
    assert respuesta_sin_cambio.status_code == 200
    assert len(client.get("/api/v1/notificaciones/", headers=aprendiz_headers).json()) == 1


def test_vocero_de_ficha_devuelve_solo_los_marcados(client, db_session, autenticar_como, crear_ficha, crear_usuario):
    ficha = crear_ficha(codigo="2874521")
    vocera, headers = autenticar_como("Aprendiz")
    aprendiz_normal = crear_usuario(nombre="Aprendiz sin rol en ficha")

    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=vocera.idUsuario, rolEnFicha="vocero"))
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz_normal.idUsuario, rolEnFicha=None))
    db_session.commit()

    respuesta = client.get(f"/api/v1/fichas/{ficha.idFicha}/vocero", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["idUsuario"] == str(vocera.idUsuario)
    assert cuerpo[0]["rolEnFicha"] == "vocero"


def test_vocero_de_ficha_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/fichas/9999/vocero", headers=headers)

    assert respuesta.status_code == 404


def test_mi_horario_respeta_publicacion_y_activacion(
    client, db_session, autenticar_como, crear_usuario, crear_ficha
):
    _crear_tablas_horario(db_session)
    ficha = crear_ficha(codigo="2874521")
    instructor = crear_usuario(nombre="Carlos")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    db_session.add_all([sede, ambiente, jornada, dia, resultado])
    db_session.commit()
    horario = Horario(
        idHorario=100, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=ficha.idTrimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=9, publicado=False, activo=True,
    )
    db_session.add(horario)
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.commit()
    _, headers = autenticar_como("Aprendiz")
    client.post("/api/v1/ficha-usuario/vincular", json={"codigoFicha": ficha.codigoFicha}, headers=headers)

    def ids_visibles():
        respuesta = client.get("/api/v1/ficha-usuario/mi-horario", headers=headers)
        assert respuesta.status_code == 200
        return [fila["idHorario"] for fila in respuesta.json()]

    assert ids_visibles() == []
    horario.publicado = True
    db_session.commit()
    assert ids_visibles() == [100]
    horario.publicado = False
    db_session.commit()
    assert ids_visibles() == []
    horario.publicado = True
    horario.activo = False
    db_session.commit()
    assert ids_visibles() == []
