"""H-2: el código de ficha que el aprendiz escribe al registrarse queda
guardado en la metadata de Supabase Auth. Hasta el 2026-09-24 nadie lo
leía, así que la persona daba el dato y la app se lo volvía a pedir.

Acá se cubre el primer request autenticado — el único momento en que
get_current_user crea la fila de perfil y puede aprovechar esa metadata.
"""

import uuid

from app.models.ficha_usuario import FichaUsuario
from app.models.usuario import Usuario


def _primer_login(client, fake_supabase, crear_rol, db_session, metadata: dict):
    """Simula a alguien que se registró y entra por primera vez: existe en
    Supabase Auth pero todavía no tiene fila en "usuarios"."""
    id_auth = str(uuid.uuid4())
    token = f"token-{uuid.uuid4()}"
    fake_supabase(token, id=id_auth, email="nuevo@sena.edu.co", user_metadata=metadata)

    headers = {"Authorization": f"Bearer {token}"}
    respuesta = client.get("/api/v1/usuarios/me", headers=headers)
    assert respuesta.status_code == 200

    usuario = db_session.get(Usuario, id_auth)
    assert usuario is not None
    return usuario, headers


def test_el_codigo_de_ficha_del_registro_crea_el_vinculo(client, fake_supabase, crear_rol, crear_ficha, db_session):
    ficha = crear_ficha(codigo="3171618")

    usuario, _ = _primer_login(
        client,
        fake_supabase,
        crear_rol,
        db_session,
        {"numero_documento": "1000900010", "rol_solicitado": "Aprendiz", "codigo_ficha": "3171618"},
    )

    vinculo = db_session.get(FichaUsuario, {"idFicha": ficha.idFicha, "idUsuario": usuario.idUsuario})
    assert vinculo is not None


def test_un_codigo_de_ficha_inexistente_no_impide_entrar(client, fake_supabase, crear_rol, db_session):
    """Camino de rescate: el login funciona igual y la persona queda sin
    vínculo, para hacerlo a mano desde "Mi horario" (H-1)."""
    usuario, _ = _primer_login(
        client,
        fake_supabase,
        crear_rol,
        db_session,
        {"rol_solicitado": "Aprendiz", "codigo_ficha": "0000000"},
    )

    assert db_session.query(FichaUsuario).filter(FichaUsuario.idUsuario == usuario.idUsuario).count() == 0


def test_sin_codigo_de_ficha_no_pasa_nada(client, fake_supabase, crear_rol, db_session):
    usuario, _ = _primer_login(
        client,
        fake_supabase,
        crear_rol,
        db_session,
        {"rol_solicitado": "Instructor", "codigo_instructor": "ABC123"},
    )

    assert db_session.query(FichaUsuario).filter(FichaUsuario.idUsuario == usuario.idUsuario).count() == 0
