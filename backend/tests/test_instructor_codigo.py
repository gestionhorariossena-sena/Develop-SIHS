from fastapi.testclient import TestClient

from app.core.supabase_auth import require_admin
from app.main import app

client = TestClient(app)


def test_generar_codigo_instructor_route(monkeypatch):
    def fake_generar(*args, **kwargs):
        return {"codigo": "INS-AB12CD", "idUsuario": "11111111-1111-1111-1111-111111111111"}

    monkeypatch.setattr("app.api.v1.usuarios.UsuarioService.generar_codigo_instructor", fake_generar)
    app.dependency_overrides[require_admin] = lambda: {"id": "admin-1"}

    response = client.post(
        "/api/v1/usuarios/instructor/codigo/generar",
        json={"idUsuario": "11111111-1111-1111-1111-111111111111"},
    )

    assert response.status_code == 200
    assert response.json()["codigo"] == "INS-AB12CD"

    app.dependency_overrides.clear()


def test_validar_codigo_instructor_route(monkeypatch):
    def fake_validar(*args, **kwargs):
        return {"valido": True, "codigo": "INS-AB12CD", "idUsuario": "11111111-1111-1111-1111-111111111111"}

    monkeypatch.setattr("app.api.v1.usuarios.UsuarioService.validar_codigo_instructor", fake_validar)
    app.dependency_overrides[require_admin] = lambda: {"id": "admin-1"}

    response = client.post(
        "/api/v1/usuarios/instructor/codigo/validar",
        json={"codigo": "INS-AB12CD"},
    )

    assert response.status_code == 200
    assert response.json()["valido"] is True

    app.dependency_overrides.clear()
