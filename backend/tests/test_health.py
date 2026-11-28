from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_ok_sin_exponer_credenciales(monkeypatch) -> None:
    from unittest.mock import MagicMock
    from app.api.v1 import health

    conn = MagicMock()
    context = MagicMock()
    context.__enter__.return_value = conn
    fake_engine = MagicMock()
    fake_engine.connect.return_value = context
    monkeypatch.setattr(health, "engine", fake_engine)

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"
    assert "password" not in str(payload).lower()
    conn.execute.assert_called_once()


def test_readiness_falla_si_base_no_responde(monkeypatch) -> None:
    from unittest.mock import MagicMock
    from app.api.v1 import health

    fake_engine = MagicMock()
    fake_engine.connect.side_effect = ConnectionError("fake password should not leak")
    monkeypatch.setattr(health, "engine", fake_engine)

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}
    assert "fake password" not in response.text
