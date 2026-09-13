from app.models.notificacion import Notificacion


def _crear_notificacion(db_session, id_usuario, *, tipo="Cambios de Aula & Horario", mensaje="Tu franja cambió de ambiente.", leida=False):
    notificacion = Notificacion(idUsuario=id_usuario, tipo=tipo, mensaje=mensaje, leida=leida)
    db_session.add(notificacion)
    db_session.commit()
    db_session.refresh(notificacion)
    return notificacion


def test_obtener_notificaciones_solo_las_del_usuario_autenticado(client, autenticar_como, crear_usuario, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    otro_usuario = crear_usuario(nombre="Otro")

    _crear_notificacion(db_session, usuario.idUsuario, mensaje="Para mí")
    _crear_notificacion(db_session, otro_usuario.idUsuario, mensaje="Para otro")

    respuesta = client.get("/api/v1/notificaciones/", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["mensaje"] == "Para mí"


def test_marcar_notificacion_leida(client, autenticar_como, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    notificacion = _crear_notificacion(db_session, usuario.idUsuario)

    respuesta = client.patch(f"/api/v1/notificaciones/{notificacion.idNotificacion}/leida", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["leida"] is True


def test_marcar_notificacion_leida_de_otro_usuario_da_404(client, autenticar_como, crear_usuario, db_session):
    _, headers = autenticar_como("Aprendiz")
    otro_usuario = crear_usuario(nombre="Otro")
    notificacion = _crear_notificacion(db_session, otro_usuario.idUsuario)

    respuesta = client.patch(f"/api/v1/notificaciones/{notificacion.idNotificacion}/leida", headers=headers)

    assert respuesta.status_code == 404


def test_marcar_todas_leidas(client, autenticar_como, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    _crear_notificacion(db_session, usuario.idUsuario, mensaje="Una")
    _crear_notificacion(db_session, usuario.idUsuario, mensaje="Dos")
    _crear_notificacion(db_session, usuario.idUsuario, mensaje="Ya leída", leida=True)

    respuesta = client.patch("/api/v1/notificaciones/marcar-todas-leidas", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["cantidad"] == 2

    todas = client.get("/api/v1/notificaciones/", headers=headers).json()
    assert all(n["leida"] for n in todas)
