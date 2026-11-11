"""Semana 4 · Nicol: contrato HTTP/JSON de notificaciones consumido por React.

Ejecutar: python -m pytest -q tests/test_s4_contrato_notificaciones_nicol.py
TestClient usa SQLite en memoria y autenticación Supabase simulada (conftest).
"""
from datetime import datetime
from uuid import UUID

from app.models.notificacion import Notificacion


RUTA = "/api/v1/notificaciones"
CAMPOS_FRONTEND = {
    "idNotificacion",
    "idUsuario",
    "tipo",
    "mensaje",
    "leida",
    "fechaCreacion",
    "entidadRelacionada",
    "idEntidadRelacionada",
}


def _notificacion(db_session, usuario, *, mensaje, leida=False, tipo="sistema"):
    entidad = Notificacion(
        idUsuario=usuario.idUsuario,
        tipo=tipo,
        mensaje=mensaje,
        leida=leida,
        entidadRelacionada=None,
        idEntidadRelacionada=None,
    )
    db_session.add(entidad)
    db_session.commit()
    db_session.refresh(entidad)
    return entidad


def test_lista_expone_contrato_json_exacto_para_react(client, autenticar_como, db_session):
    usuario, headers = autenticar_como("Aprendiz")
    creada = _notificacion(db_session, usuario, mensaje="Cambio de aula", tipo="horario")

    respuesta = client.get(f"{RUTA}/", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("application/json")
    assert isinstance(respuesta.json(), list)
    assert len(respuesta.json()) == 1
    item = respuesta.json()[0]
    assert set(item) == CAMPOS_FRONTEND
    assert item["idNotificacion"] == creada.idNotificacion
    assert UUID(item["idUsuario"]) == usuario.idUsuario
    assert item["tipo"] == "horario"
    assert item["mensaje"] == "Cambio de aula"
    assert item["leida"] is False
    assert datetime.fromisoformat(item["fechaCreacion"])
    assert item["entidadRelacionada"] is None
    assert item["idEntidadRelacionada"] is None


def test_conteo_no_leidas_es_numero_json_y_excluye_leidas_y_otros_usuarios(
    client, autenticar_como, crear_usuario, db_session
):
    usuario, headers = autenticar_como("Aprendiz")
    otro = crear_usuario(nombre="Otra persona")
    _notificacion(db_session, usuario, mensaje="Primera")
    _notificacion(db_session, usuario, mensaje="Segunda")
    _notificacion(db_session, usuario, mensaje="Ya leída", leida=True)
    _notificacion(db_session, otro, mensaje="No me pertenece")

    respuesta = client.get(f"{RUTA}/conteo-no-leidas", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("application/json")
    assert respuesta.json() == {"noLeidas": 2}
    assert type(respuesta.json()["noLeidas"]) is int


def test_patch_devuelve_objeto_completo_para_actualizar_panel(
    client, autenticar_como, db_session
):
    usuario, headers = autenticar_como("Aprendiz")
    creada = _notificacion(db_session, usuario, mensaje="Horario actualizado", tipo="horario")

    respuesta = client.patch(f"{RUTA}/{creada.idNotificacion}/leida", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("application/json")
    item = respuesta.json()
    assert set(item) == CAMPOS_FRONTEND
    assert item["idNotificacion"] == creada.idNotificacion
    assert item["mensaje"] == "Horario actualizado"
    assert item["tipo"] == "horario"
    assert item["leida"] is True
    assert datetime.fromisoformat(item["fechaCreacion"])
    db_session.refresh(creada)
    assert creada.leida is True


def test_patch_id_inexistente_devuelve_404_sin_detalles_internos(
    client, autenticar_como
):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.patch(f"{RUTA}/987654321/leida", headers=headers)

    assert respuesta.status_code == 404
    assert respuesta.headers["content-type"].startswith("application/json")
    assert respuesta.json() == {"detail": "Notificación no encontrada"}
    texto = respuesta.text.lower()
    assert all(termino not in texto for termino in ("traceback", "sqlalchemy", "select ", "postgresql"))


def test_filtro_solo_no_leidas_no_filtra_en_el_frontend(
    client, autenticar_como, db_session
):
    usuario, headers = autenticar_como("Aprendiz")
    _notificacion(db_session, usuario, mensaje="Ya vista", leida=True)
    _notificacion(db_session, usuario, mensaje="Pendiente A")
    _notificacion(db_session, usuario, mensaje="Pendiente B")

    respuesta = client.get(f"{RUTA}/?solo_no_leidas=true", headers=headers)

    assert respuesta.status_code == 200
    mensajes = {item["mensaje"] for item in respuesta.json()}
    assert mensajes == {"Pendiente A", "Pendiente B"}
    assert all(item["leida"] is False for item in respuesta.json())


def test_limite_invalido_usa_error_422_json_sin_consultar_datos(
    client, autenticar_como
):
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get(f"{RUTA}/?limite=0", headers=headers)

    assert respuesta.status_code == 422
    assert respuesta.headers["content-type"].startswith("application/json")
    assert isinstance(respuesta.json()["detail"], list)
    assert respuesta.json()["detail"][0]["loc"][-1] == "limite"
