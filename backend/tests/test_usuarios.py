import uuid


def test_me_requiere_autenticacion(client):
    respuesta = client.get("/api/v1/usuarios/me")

    assert respuesta.status_code == 401


def test_me_crea_el_perfil_en_el_primer_login(client, fake_supabase, db_session):
    """Primer request autenticado de un usuario que Supabase ya validó pero
    que todavía no tiene fila en "usuarios" — get_current_user debe crearla."""
    supabase_id = str(uuid.uuid4())
    fake_supabase("token-nuevo", id=supabase_id, email="nuevo@example.com")

    respuesta = client.get(
        "/api/v1/usuarios/me", headers={"Authorization": "Bearer token-nuevo"}
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["idUsuario"] == supabase_id
    assert cuerpo["email"] == "nuevo@example.com"
    assert cuerpo["nombre"] == "nuevo"
    assert cuerpo["estado"] == "activo"
    assert cuerpo["roles"] == []


def test_me_no_duplica_el_perfil_en_logins_siguientes(client, fake_supabase, db_session):
    from app.models.usuario import Usuario

    supabase_id = str(uuid.uuid4())
    fake_supabase("token-repetido", id=supabase_id, email="repetido@example.com")
    headers = {"Authorization": "Bearer token-repetido"}

    client.get("/api/v1/usuarios/me", headers=headers)
    client.get("/api/v1/usuarios/me", headers=headers)

    assert db_session.query(Usuario).count() == 1


def test_me_devuelve_los_roles_del_usuario(client, autenticar_como):
    usuario, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/usuarios/me", headers=headers)

    assert respuesta.status_code == 200
    assert [rol["nombre"] for rol in respuesta.json()["roles"]] == ["Instructor"]


def test_listar_usuarios_permite_coordinador(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get("/api/v1/usuarios/", headers=headers)

    assert respuesta.status_code == 200


def test_listar_usuarios_permite_administrador(client, autenticar_como):
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/usuarios/", headers=headers)

    assert respuesta.status_code == 200


def test_listar_usuarios_rechaza_aprendiz(client, autenticar_como):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/usuarios/", headers=headers)

    assert respuesta.status_code == 403


def test_obtener_usuario_por_id_requiere_admin(client, autenticar_como):
    objetivo, _ = autenticar_como("Aprendiz")
    _, headers_coordinador = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/usuarios/{objetivo.idUsuario}", headers=headers_coordinador)

    assert respuesta.status_code == 403


def test_obtener_usuario_por_id_como_admin(client, autenticar_como):
    objetivo, _ = autenticar_como("Aprendiz")
    _, headers_admin = autenticar_como("Administrador")

    respuesta = client.get(f"/api/v1/usuarios/{objetivo.idUsuario}", headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json()["idUsuario"] == str(objetivo.idUsuario)


def test_obtener_usuario_inexistente_da_404(client, autenticar_como):
    _, headers_admin = autenticar_como("Administrador")

    respuesta = client.get(f"/api/v1/usuarios/{uuid.uuid4()}", headers=headers_admin)

    assert respuesta.status_code == 404
