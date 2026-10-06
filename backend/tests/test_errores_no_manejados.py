"""Un error del servidor tiene que llegar al navegador COMO error del
servidor. Sin el handler global de app/main.py, Starlette responde sin
pasar por CORSMiddleware y el navegador convierte eso en un TypeError de
red: la pantalla decía "No se pudo conectar con el servidor. Revisa tu
conexión" para un 500 que sí ocurrió (encontrado en vivo el 2026-09-24
con la tabla especialidad_competencia sin migrar)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@app.get("/api/v1/_prueba-error-no-manejado", include_in_schema=False)
def _explota():
    raise RuntimeError("algo se rompió adentro")


def test_error_no_manejado_responde_500_con_json_y_cors():
    # raise_server_exceptions=False para que el cliente se comporte como
    # un navegador real (recibir la respuesta) y no re-lance la excepción.
    cliente = TestClient(app, raise_server_exceptions=False)

    respuesta = cliente.get(
        "/api/v1/_prueba-error-no-manejado",
        headers={"Origin": "http://localhost:5173"},
    )

    assert respuesta.status_code == 500
    assert respuesta.json() == {"detail": "El servidor tuvo un problema procesando esta solicitud."}
    # Lo que de verdad importa: sin este header el navegador reporta
    # "no se pudo conectar" en vez del 500.
    assert respuesta.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_el_traceback_no_viaja_al_navegador():
    cliente = TestClient(app, raise_server_exceptions=False)

    respuesta = cliente.get("/api/v1/_prueba-error-no-manejado")

    assert "algo se rompió adentro" not in respuesta.text
    assert "Traceback" not in respuesta.text


@pytest.mark.parametrize(
    "origen",
    [
        "https://proyectosihs.vercel.app",
        "https://proyectosihs-git-chat-fix-pr-106-role-delete-guard-sihs.vercel.app",
    ],
)
def test_cors_acepta_produccion_y_previews_del_proyecto_vercel(origen):
    cliente = TestClient(app)

    respuesta = cliente.get("/api/v1/health", headers={"Origin": origen})

    assert respuesta.status_code == 200
    assert respuesta.headers.get("access-control-allow-origin") == origen


def test_cors_no_abre_cualquier_proyecto_vercel():
    cliente = TestClient(app)

    respuesta = cliente.get(
        "/api/v1/health",
        headers={"Origin": "https://otro-proyecto.vercel.app"},
    )

    assert respuesta.status_code == 200
    assert "access-control-allow-origin" not in respuesta.headers
