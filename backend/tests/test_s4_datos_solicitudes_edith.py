"""Semana 4 — Edith: ángulo BD / datos y reglas sobre
/api/v1/solicitudes-acceso (backend/app/api/v1/solicitudes_acceso.py).

Reto: >=4 escenarios NUEVOS, no repetidos de test_solicitudes_acceso.py
(ya cubre: 201 básico, rol inexistente -> 404, mismo payload duplicado ->
400, requiere-admin en listar, filtro por "rechazada", reintento tras
resolución). Estos cuatro se enfocan en lo que ese archivo no comprueba:
el contrato completo de respuesta, que el dedupe es por correo (no por
correo+rol), que "estado=pendiente" no mezcla otros estados, y que un
estado inválido no llega a tocar el servicio/BD.
"""

from datetime import datetime, timezone

from app.services import solicitud_acceso_service
from app.services.solicitud_acceso_service import SolicitudAccesoService


def _payload_solicitud(**overrides):
    payload = {
        "nombre": "Camila Torres Ruiz",
        "email": "ctorres@sena.edu.co",
        "numeroDocumento": "1098765432",
        "motivo": "Necesito gestionar los horarios de mi coordinación.",
    }
    payload.update(overrides)
    return payload


def test_crear_devuelve_el_contrato_completo_de_solicitudaccesoresponse(client, monkeypatch):
    """Aísla el servicio (no toca BD real ni Supabase) para comprobar que
    el router entrega TODOS los campos del contrato que consume el
    frontend (SolicitudAccesoResponse en app/schemas/solicitud_acceso.py),
    no solo los 2-3 que ya revisa test_publico_sin_auth -- y el
    Content-Type real de la respuesta."""
    respuesta_servicio = {
        "idSolicitud": 501,
        "nombre": "Camila Torres Ruiz",
        "email": "ctorres@sena.edu.co",
        "numeroDocumento": "1098765432",
        "idRolSolicitado": 7,
        "rolSolicitado": "Coordinador",
        "motivo": "Necesito gestionar los horarios de mi coordinación.",
        "estado": "pendiente",
        "motivoRechazo": None,
        "fechaSolicitud": datetime(2026, 11, 1, 8, 0, tzinfo=timezone.utc),
        "fechaResolucion": None,
        "idAdminResolvio": None,
    }
    monkeypatch.setattr(SolicitudAccesoService, "crear", staticmethod(lambda db, data: respuesta_servicio))

    respuesta = client.post("/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=7))

    assert respuesta.status_code == 201
    assert respuesta.headers["content-type"] == "application/json"
    cuerpo = respuesta.json()
    assert set(cuerpo.keys()) == {
        "idSolicitud",
        "nombre",
        "email",
        "numeroDocumento",
        "idRolSolicitado",
        "rolSolicitado",
        "motivo",
        "estado",
        "motivoRechazo",
        "fechaSolicitud",
        "fechaResolucion",
        "idAdminResolvio",
    }
    assert cuerpo["idSolicitud"] == 501
    assert cuerpo["rolSolicitado"] == "Coordinador"
    assert cuerpo["fechaResolucion"] is None
    assert cuerpo["idAdminResolvio"] is None


def test_email_duplicado_bloquea_aunque_cambie_el_rol_solicitado(client, crear_rol):
    """La regla real (SolicitudAccesoRepository.obtener_pendiente_por_email)
    dedupe por correo solamente. A diferencia de
    test_email_duplicado_pendiente_da_400 (mismo payload repetido), acá se
    pide un ROL DISTINTO la segunda vez para confirmar que lo que bloquea
    es el correo, no la combinación correo+rol."""
    rol_coordinador = crear_rol("Coordinador")
    rol_instructor = crear_rol("Instructor")

    primera = client.post(
        "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol_coordinador.idRol)
    )
    assert primera.status_code == 201

    segunda = client.post(
        "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol_instructor.idRol)
    )

    assert segunda.status_code == 400
    assert segunda.json()["detail"] == "Ya existe una solicitud pendiente con ese correo"


def test_filtro_estado_pendiente_no_mezcla_aprobadas_ni_rechazadas(
    client, crear_rol, autenticar_como, monkeypatch
):
    """test_filtra_por_estado (ya existente) solo prueba el filtro
    "rechazada" con una sola solicitud de cada lado. Acá se mezclan los
    TRES estados a la vez para comprobar que pedir "pendiente" no deja
    pasar ni la aprobada ni la rechazada."""
    rol = crear_rol("Instructor")
    monkeypatch.setattr(
        solicitud_acceso_service,
        "crear_o_recuperar_usuario_supabase",
        lambda email, password: ({"id": "11111111-1111-1111-1111-111111111111", "email": email}, True),
    )
    monkeypatch.setattr(
        solicitud_acceso_service.EmailService, "enviar_credencial_temporal", staticmethod(lambda **kwargs: None)
    )
    _, headers = autenticar_como("Administrador")

    pendiente = client.post(
        "/api/v1/solicitudes-acceso/",
        json=_payload_solicitud(idRolSolicitado=rol.idRol, email="pendiente@sena.edu.co"),
    ).json()
    a_aprobar = client.post(
        "/api/v1/solicitudes-acceso/",
        json=_payload_solicitud(idRolSolicitado=rol.idRol, email="aprobada@sena.edu.co"),
    ).json()
    a_rechazar = client.post(
        "/api/v1/solicitudes-acceso/",
        json=_payload_solicitud(idRolSolicitado=rol.idRol, email="rechazada@sena.edu.co"),
    ).json()

    client.post(
        f"/api/v1/solicitudes-acceso/{a_aprobar['idSolicitud']}/aprobar",
        json={"idRol": rol.idRol},
        headers=headers,
    )
    client.post(
        f"/api/v1/solicitudes-acceso/{a_rechazar['idSolicitud']}/rechazar",
        json={"motivoRechazo": "No aplica"},
        headers=headers,
    )

    respuesta = client.get("/api/v1/solicitudes-acceso/?estado=pendiente", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert [s["idSolicitud"] for s in cuerpo] == [pendiente["idSolicitud"]]
    assert all(s["estado"] == "pendiente" for s in cuerpo)


def test_estado_invalido_da_422_sin_llamar_al_servicio(client, autenticar_como, monkeypatch):
    """"estado" es un Enum (EstadoSolicitudAcceso) -- un valor que no está
    en pendiente/aprobada/rechazada debe quedarse en la validación de
    FastAPI antes de tocar el servicio. Se prueba literalmente que
    SolicitudAccesoService.listar nunca se invoca: si FastAPI dejara pasar
    el valor inválido hasta el servicio, este monkeypatch lo revienta."""

    def _listar_no_deberia_llamarse(db, estado=None):
        raise AssertionError("No debía consultarse el servicio/BD con un estado inválido")

    monkeypatch.setattr(SolicitudAccesoService, "listar", staticmethod(_listar_no_deberia_llamarse))
    _, headers = autenticar_como("Administrador")

    respuesta = client.get("/api/v1/solicitudes-acceso/?estado=archivada", headers=headers)

    assert respuesta.status_code == 422
    assert respuesta.headers["content-type"] == "application/json"
    detalle = respuesta.json()["detail"]
    assert isinstance(detalle, list)
    assert any(error["loc"][-1] == "estado" for error in detalle)
