"""SCRUM-112 — CredencialTemporalService.crear_cuenta_con_clave_temporal.
Mockea las llamadas HTTP a la Admin API de Supabase directamente (no hay
capa intermedia que mockear, a diferencia de test_instructor_codigo.py)."""

import uuid

from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services.credencial_temporal_service import CredencialTemporalService


class _RespuestaFalsa:
    def __init__(self, status_code, cuerpo):
        self.status_code = status_code
        self._cuerpo = cuerpo

    def json(self):
        return self._cuerpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_crea_cuenta_nueva_con_clave_temporal_y_asigna_rol(monkeypatch, db_session, crear_rol):
    rol = crear_rol("Aprendiz")
    id_usuario_nuevo = str(uuid.uuid4())

    def fake_post(url, headers=None, json=None, timeout=None):
        assert url.endswith("/auth/v1/admin/users")
        assert json["email"] == "nuevo@example.com"
        assert json["email_confirm"] is True
        return _RespuestaFalsa(201, {"id": id_usuario_nuevo, "email": json["email"]})

    def fake_get(*args, **kwargs):
        raise AssertionError("No debería llamar a GET si POST ya creó la cuenta")

    monkeypatch.setattr("app.services.credencial_temporal_service.httpx.post", fake_post)
    monkeypatch.setattr("app.services.credencial_temporal_service.httpx.get", fake_get)

    resultado = CredencialTemporalService.crear_cuenta_con_clave_temporal(
        db_session, email="nuevo@example.com", nombre="Nuevo Aprendiz", id_rol=rol.idRol
    )

    assert resultado["email"] == "nuevo@example.com"
    assert resultado["idUsuario"] == id_usuario_nuevo
    assert len(resultado["passwordTemporal"]) > 8

    usuario = db_session.get(Usuario, id_usuario_nuevo)
    assert usuario is not None
    assert usuario.debeCambiarClave is True

    tiene_rol = (
        db_session.query(UsuarioRol)
        .filter(UsuarioRol.idUsuario == id_usuario_nuevo, UsuarioRol.idRol == rol.idRol)
        .first()
    )
    assert tiene_rol is not None


def test_reutiliza_cuenta_de_supabase_si_el_correo_ya_existe(monkeypatch, db_session, crear_rol, crear_usuario):
    rol = crear_rol("Aprendiz")
    usuario_existente = crear_usuario(nombre="Ya Registrado", email="existe@example.com")

    def fake_post(*args, **kwargs):
        return _RespuestaFalsa(422, {"msg": "ya existe"})

    def fake_get(url, headers=None, params=None, timeout=None):
        assert url.endswith("/auth/v1/admin/users")
        return _RespuestaFalsa(200, {"users": [{"id": str(usuario_existente.idUsuario), "email": "existe@example.com"}]})

    monkeypatch.setattr("app.services.credencial_temporal_service.httpx.post", fake_post)
    monkeypatch.setattr("app.services.credencial_temporal_service.httpx.get", fake_get)

    resultado = CredencialTemporalService.crear_cuenta_con_clave_temporal(
        db_session, email="existe@example.com", nombre="Ya Registrado", id_rol=rol.idRol
    )

    assert resultado["idUsuario"] == str(usuario_existente.idUsuario)

    # No duplica la fila de Usuario — sigue habiendo una sola.
    assert db_session.query(Usuario).filter(Usuario.email == "existe@example.com").count() == 1

    tiene_rol = (
        db_session.query(UsuarioRol)
        .filter(UsuarioRol.idUsuario == str(usuario_existente.idUsuario), UsuarioRol.idRol == rol.idRol)
        .first()
    )
    assert tiene_rol is not None
