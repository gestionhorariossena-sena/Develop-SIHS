import uuid

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.models.auditoria import Auditoria
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.services.demo_reset_guard_service import DemoResetGuardService


def _usuario(db, es_admin: bool):
    usuario = Usuario(idUsuario=uuid.uuid4(), nombre="Nicol", email=f"nicol-{uuid.uuid4()}@sena.edu.co")
    if es_admin:
        rol = Rol(nombre="Administrador")
        db.add(rol)
        usuario.roles.append(rol)
    db.add(usuario)
    db.commit()
    return usuario


def _entorno_demo(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "app_env", "demo")
    monkeypatch.setattr(settings, "sihs_demo_project_ref", "proyecto-demo")
    monkeypatch.setattr(settings, "supabase_url", "https://proyecto-demo.supabase.co")


def test_autoriza_admin_solo_en_demo_permitida_y_audita(db_session, monkeypatch):
    _entorno_demo(monkeypatch)
    usuario = _usuario(db_session, es_admin=True)

    DemoResetGuardService.verificar(db_session, usuario)

    auditoria = db_session.query(Auditoria).one()
    assert auditoria.accion == "RESET_DEMO_PREVALIDADO"
    assert auditoria.idUsuario == usuario.idUsuario


@pytest.mark.parametrize(
    "ajuste, mensaje",
    [
        (("demo_mode", False), "DEMO_MODE=true"),
        (("app_env", "production"), "APP_ENV=demo"),
        (("sihs_demo_project_ref", ""), "allow-list"),
        (("supabase_url", "https://otro-proyecto.supabase.co"), "no pertenece"),
    ],
)
def test_rechaza_configuracion_insegura_y_deja_auditoria(db_session, monkeypatch, ajuste, mensaje):
    _entorno_demo(monkeypatch)
    monkeypatch.setattr(settings, ajuste[0], ajuste[1])
    usuario = _usuario(db_session, es_admin=True)

    with pytest.raises(HTTPException, match=mensaje):
        DemoResetGuardService.verificar(db_session, usuario)

    assert db_session.query(Auditoria).one().accion == "RESET_DEMO_RECHAZADO"


def test_rechaza_roles_distintos_de_admin_y_audita(db_session, monkeypatch):
    _entorno_demo(monkeypatch)
    usuario = _usuario(db_session, es_admin=False)

    with pytest.raises(HTTPException, match="Administrador"):
        DemoResetGuardService.verificar(db_session, usuario)

    assert db_session.query(Auditoria).one().accion == "RESET_DEMO_RECHAZADO"
