import uuid


def test_asignar_rol_requiere_admin(client, autenticar_como, crear_usuario, crear_rol):
    objetivo = crear_usuario(nombre="Pedro")
    rol = crear_rol("Instructor")
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/usuario-rol/asignar",
        json={"idUsuario": str(objetivo.idUsuario), "idRol": rol.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_asignar_rol_exitoso(client, autenticar_como, crear_usuario, crear_rol):
    objetivo = crear_usuario(nombre="Pedro")
    rol = crear_rol("Instructor")
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/usuario-rol/asignar",
        json={"idUsuario": str(objetivo.idUsuario), "idRol": rol.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 200

    consulta = client.get(f"/api/v1/usuario-rol/usuario/{objetivo.idUsuario}", headers=headers)
    assert [r["nombre"] for r in consulta.json()] == ["Instructor"]


def test_asignar_rol_usuario_inexistente_da_404(client, autenticar_como, crear_rol):
    rol = crear_rol("Instructor")
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/usuario-rol/asignar",
        json={"idUsuario": str(uuid.uuid4()), "idRol": rol.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 404


def test_asignar_rol_inexistente_da_404(client, autenticar_como, crear_usuario):
    objetivo = crear_usuario(nombre="Pedro")
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/usuario-rol/asignar",
        json={"idUsuario": str(objetivo.idUsuario), "idRol": 9999},
        headers=headers,
    )

    assert respuesta.status_code == 404


def test_asignar_rol_repetido_da_400(client, autenticar_como, crear_usuario, crear_rol):
    rol = crear_rol("Instructor")
    objetivo = crear_usuario(nombre="Pedro", roles=[rol])
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        "/api/v1/usuario-rol/asignar",
        json={"idUsuario": str(objetivo.idUsuario), "idRol": rol.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 400


def test_remover_rol_exitoso(client, autenticar_como, crear_usuario, crear_rol):
    rol = crear_rol("Instructor")
    objetivo = crear_usuario(nombre="Pedro", roles=[rol])
    _, headers = autenticar_como("Administrador")

    respuesta = client.request(
        "DELETE",
        "/api/v1/usuario-rol/remover",
        json={"idUsuario": str(objetivo.idUsuario), "idRol": rol.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 200

    consulta = client.get(f"/api/v1/usuario-rol/usuario/{objetivo.idUsuario}", headers=headers)
    assert consulta.json() == []


def test_remover_rol_inexistente_da_404(client, autenticar_como, crear_usuario, crear_rol):
    rol = crear_rol("Instructor")
    objetivo = crear_usuario(nombre="Pedro")
    _, headers = autenticar_como("Administrador")

    respuesta = client.request(
        "DELETE",
        "/api/v1/usuario-rol/remover",
        json={"idUsuario": str(objetivo.idUsuario), "idRol": rol.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 404


def test_obtener_roles_de_usuario_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.get(f"/api/v1/usuario-rol/usuario/{uuid.uuid4()}", headers=headers)

    assert respuesta.status_code == 404


def test_obtener_roles_de_usuario_rechaza_no_admin(client, autenticar_como, crear_usuario):
    objetivo = crear_usuario(nombre="Pedro")
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/usuario-rol/usuario/{objetivo.idUsuario}", headers=headers)

    assert respuesta.status_code == 403
