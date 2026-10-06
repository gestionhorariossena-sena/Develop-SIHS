def test_listar_roles_requiere_autenticacion(client):
    respuesta = client.get("/api/v1/roles/")

    assert respuesta.status_code == 401


def test_listar_roles_rechaza_token_invalido(client, fake_supabase):
    """Sin `fake_supabase` como parámetro el monkeypatch no se activa y este
    test termina golpeando el Supabase real — en CI eso da 503, no 401."""
    respuesta = client.get(
        "/api/v1/roles/", headers={"Authorization": "Bearer token-que-no-existe"}
    )

    assert respuesta.status_code == 401


def test_listar_roles_rechaza_no_admin(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/roles/", headers=headers)

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "No autorizado"


def test_crear_rol_como_admin(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.post("/api/v1/roles/", json={"nombre": "Instructor"}, headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Instructor"
    assert "idRol" in cuerpo


def test_listar_roles_como_admin_incluye_los_creados(client, autenticar_como, crear_rol):
    crear_rol("Coordinador")
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/roles/", headers=headers)

    assert respuesta.status_code == 200
    nombres = {rol["nombre"] for rol in respuesta.json()}
    assert {"Coordinador", "Administrador"} <= nombres


def test_obtener_rol_por_id(client, autenticar_como, crear_rol):
    rol = crear_rol("Instructor")
    _, headers = autenticar_como("Administrador")

    respuesta = client.get(f"/api/v1/roles/{rol.idRol}", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Instructor"


def test_obtener_rol_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/roles/9999", headers=headers)

    assert respuesta.status_code == 404


def test_actualizar_rol(client, autenticar_como, crear_rol):
    rol = crear_rol("Instructor")
    _, headers = autenticar_como("Administrador")

    respuesta = client.put(
        f"/api/v1/roles/{rol.idRol}", json={"nombre": "Instructor Senior"}, headers=headers
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Instructor Senior"


def test_actualizar_rol_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.put("/api/v1/roles/9999", json={"nombre": "Lo que sea"}, headers=headers)

    assert respuesta.status_code == 404


def test_eliminar_rol(client, autenticar_como, crear_rol):
    rol = crear_rol("Instructor")
    _, headers = autenticar_como("Administrador")

    respuesta = client.delete(f"/api/v1/roles/{rol.idRol}", headers=headers)

    assert respuesta.status_code == 200
    assert client.get(f"/api/v1/roles/{rol.idRol}", headers=headers).status_code == 404


def test_eliminar_rol_asignado_da_409_y_conserva_asignacion(
    client, autenticar_como, crear_rol, crear_usuario
):
    """T-10: la BD real usa ON DELETE CASCADE en usuario_rol.idRol.
    La protección debe ocurrir ANTES del DELETE para no perder asignaciones."""
    rol = crear_rol("Rol temporal")
    usuario = crear_usuario(nombre="Usuario con rol", roles=[rol])
    _, headers = autenticar_como("Administrador")

    respuesta = client.delete(f"/api/v1/roles/{rol.idRol}", headers=headers)

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == "No se puede eliminar un rol que tiene usuarios asignados."
    assert client.get(f"/api/v1/roles/{rol.idRol}", headers=headers).status_code == 200

    roles_usuario = client.get(
        f"/api/v1/usuario-rol/usuario/{usuario.idUsuario}", headers=headers
    )
    assert roles_usuario.status_code == 200
    assert any(item["idRol"] == rol.idRol for item in roles_usuario.json())


def test_eliminar_rol_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.delete("/api/v1/roles/9999", headers=headers)

    assert respuesta.status_code == 404


def test_eliminar_rol_administrador_esta_protegido(client, autenticar_como, crear_rol):
    """T-13: "Administrador" está hardcodeado en varios servicios -- borrar
    el rol del catálogo dejaría el sistema sin nadie que pueda
    gestionarlo."""
    _, headers = autenticar_como("Administrador")
    rol_admin = crear_rol("Administrador")

    respuesta = client.delete(f"/api/v1/roles/{rol_admin.idRol}", headers=headers)

    assert respuesta.status_code == 400
    assert client.get(f"/api/v1/roles/{rol_admin.idRol}", headers=headers).status_code == 200


def test_renombrar_rol_administrador_esta_protegido(client, autenticar_como, crear_rol):
    _, headers = autenticar_como("Administrador")
    rol_admin = crear_rol("Administrador")

    respuesta = client.put(
        f"/api/v1/roles/{rol_admin.idRol}", json={"nombre": "Superadmin"}, headers=headers
    )

    assert respuesta.status_code == 400
    assert client.get(f"/api/v1/roles/{rol_admin.idRol}", headers=headers).json()["nombre"] == "Administrador"
