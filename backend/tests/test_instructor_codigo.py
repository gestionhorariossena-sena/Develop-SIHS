from fastapi.testclient import TestClient

from app.core.supabase_auth import require_admin_o_coordinador
from app.main import app

client = TestClient(app)


def test_generar_codigo_instructor_route(monkeypatch):
    """La ruta usa require_admin_o_coordinador, no require_admin — hay que
    overridear la dependencia que la ruta realmente declara, si no FastAPI
    ignora el override y cae en el checker real (que rechaza sin token)."""

    def fake_generar(*args, **kwargs):
        return {"codigo": "INS-AB12CD", "idUsuario": "11111111-1111-1111-1111-111111111111"}

    monkeypatch.setattr("app.api.v1.usuarios.UsuarioService.generar_codigo_instructor", fake_generar)
    app.dependency_overrides[require_admin_o_coordinador] = lambda: {"id": "admin-1"}

    response = client.post(
        "/api/v1/usuarios/instructor/codigo/generar",
        json={"idUsuario": "11111111-1111-1111-1111-111111111111"},
    )

    assert response.status_code == 200
    assert response.json()["codigo"] == "INS-AB12CD"

    app.dependency_overrides.clear()


def test_validar_codigo_instructor_route(monkeypatch):
    """Esta ruta es pública (sin Depends de auth) porque el registro la usa
    antes de que exista sesión — no hace falta overridear ninguna dependencia."""

    def fake_validar(*args, **kwargs):
        return {"valido": True, "codigo": "INS-AB12CD", "idUsuario": "11111111-1111-1111-1111-111111111111"}

    monkeypatch.setattr("app.api.v1.usuarios.UsuarioService.validar_codigo_instructor", fake_validar)

    response = client.post(
        "/api/v1/usuarios/instructor/codigo/validar",
        json={"codigo": "INS-AB12CD"},
    )

    assert response.status_code == 200
    assert response.json()["valido"] is True

    app.dependency_overrides.clear()
