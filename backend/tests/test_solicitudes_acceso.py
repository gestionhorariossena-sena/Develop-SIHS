"""H-3 — endpoints /solicitudes-acceso.

El alta de personas sin cuenta estaba partida al medio: el registro y el
Panel de Administración llamaban a estos cuatro endpoints y recibían 404
porque el router nunca se escribió. Acá se cubre el recorrido entero,
desde la solicitud pública hasta la cuenta creada con su rol.

La Admin API de Supabase se mockea igual que en
test_credencial_temporal_service.py — ningún test toca Supabase real.
"""

import uuid

import pytest

from app.models.solicitud_acceso import SolicitudAcceso
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


@pytest.fixture()
def tabla_solicitudes(db_session):
    """SolicitudAcceso no está en las tablas que crea conftest (ese set es
    el mínimo compartido), así que cada test que la necesita la crea."""
    from app.core.database import Base

    Base.metadata.create_all(bind=db_session.bind, tables=[SolicitudAcceso.__table__])


class _RespuestaFalsa:
    def __init__(self, status_code, cuerpo):
        self.status_code = status_code
        self._cuerpo = cuerpo

    def json(self):
        return self._cuerpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


@pytest.fixture()
def supabase_admin_falso(monkeypatch):
    """Hace que crear la cuenta en Supabase funcione y devuelve el id que
    usó, para poder comprobar el perfil creado."""
    creados = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        id_nuevo = str(uuid.uuid4())
        creados[json["email"]] = {"id": id_nuevo, "password": json["password"]}
        return _RespuestaFalsa(201, {"id": id_nuevo, "email": json["email"]})

    monkeypatch.setattr("app.services.credencial_temporal_service.httpx.post", fake_post)
    return creados


def _solicitar(client, *, email="lina@sena.edu.co", nombre="Lina Rojas", motivo="Soy la coordinadora del área"):
    return client.post(
        "/api/v1/solicitudes-acceso/",
        json={"nombre": nombre, "email": email, "numeroDocumento": "1098765432", "motivo": motivo},
    )


def test_solicitar_acceso_no_exige_sesion(client, crear_rol, tabla_solicitudes):
    crear_rol("Coordinador")

    respuesta = _solicitar(client)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "pendiente"
    assert cuerpo["email"] == "lina@sena.edu.co"
    # El formulario público no tiene selector de rol: pide Coordinador.
    assert cuerpo["rolSolicitado"]["nombre"] == "Coordinador"


def test_no_se_puede_pedir_acceso_dos_veces_con_el_mismo_correo(client, crear_rol, tabla_solicitudes):
    crear_rol("Coordinador")
    _solicitar(client)

    respuesta = _solicitar(client)

    assert respuesta.status_code == 409
    assert "pendiente" in respuesta.json()["detail"]


def test_no_se_puede_pedir_acceso_con_un_correo_que_ya_tiene_cuenta(
    client, crear_rol, crear_usuario, tabla_solicitudes
):
    crear_rol("Coordinador")
    usuario = crear_usuario(nombre="Ya Existe", email="lina@sena.edu.co")

    respuesta = _solicitar(client, email=usuario.email)

    assert respuesta.status_code == 409


def test_listar_solicitudes_es_solo_de_administrador(client, autenticar_como, crear_rol, tabla_solicitudes):
    crear_rol("Coordinador")
    _, headers = autenticar_como("Coordinador")

    assert client.get("/api/v1/solicitudes-acceso/", headers=headers).status_code == 403


def test_el_administrador_ve_la_cola_y_puede_filtrar_por_estado(
    client, autenticar_como, crear_rol, tabla_solicitudes
):
    crear_rol("Coordinador")
    _solicitar(client)
    _, headers = autenticar_como("Administrador")

    todas = client.get("/api/v1/solicitudes-acceso/", headers=headers)
    assert todas.status_code == 200
    assert len(todas.json()) == 1

    aprobadas = client.get("/api/v1/solicitudes-acceso/?estado=aprobada", headers=headers)
    assert aprobadas.json() == []


def test_aprobar_crea_la_cuenta_con_su_rol_y_devuelve_la_clave(
    client, autenticar_como, crear_rol, db_session, tabla_solicitudes, supabase_admin_falso
):
    rol_coordinador = crear_rol("Coordinador")
    id_solicitud = _solicitar(client).json()["idSolicitud"]
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        f"/api/v1/solicitudes-acceso/{id_solicitud}/aprobar",
        json={"idRol": rol_coordinador.idRol},
        headers=headers,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["solicitud"]["estado"] == "aprobada"
    assert cuerpo["solicitud"]["fechaResolucion"] is not None
    assert cuerpo["email"] == "lina@sena.edu.co"
    assert cuerpo["passwordTemporal"]
    # H-15: el correo todavía no sale, y el cliente tiene que poder saberlo.
    assert cuerpo["correoEnviado"] is False

    id_creado = supabase_admin_falso["lina@sena.edu.co"]["id"]
    usuario = db_session.get(Usuario, id_creado)
    assert usuario is not None
    assert usuario.debeCambiarClave is True
    assert (
        db_session.query(UsuarioRol)
        .filter(UsuarioRol.idUsuario == usuario.idUsuario, UsuarioRol.idRol == rol_coordinador.idRol)
        .first()
        is not None
    )


def test_aprobar_con_otro_rol_registra_el_rol_otorgado(
    client, autenticar_como, crear_rol, db_session, tabla_solicitudes, supabase_admin_falso
):
    """El panel deja cambiar el rol antes de aprobar: lo que queda en la
    solicitud tiene que ser lo que de verdad se otorgó."""
    crear_rol("Coordinador")
    rol_instructor = crear_rol("Instructor")
    id_solicitud = _solicitar(client).json()["idSolicitud"]
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        f"/api/v1/solicitudes-acceso/{id_solicitud}/aprobar",
        json={"idRol": rol_instructor.idRol},
        headers=headers,
    )

    assert respuesta.json()["solicitud"]["rolSolicitado"]["nombre"] == "Instructor"


def test_rechazar_guarda_el_motivo(client, autenticar_como, crear_rol, tabla_solicitudes):
    crear_rol("Coordinador")
    id_solicitud = _solicitar(client).json()["idSolicitud"]
    _, headers = autenticar_como("Administrador")

    respuesta = client.post(
        f"/api/v1/solicitudes-acceso/{id_solicitud}/rechazar",
        json={"motivoRechazo": "Solicitud duplicada"},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "rechazada"
    assert respuesta.json()["motivoRechazo"] == "Solicitud duplicada"


def test_no_se_puede_resolver_dos_veces(
    client, autenticar_como, crear_rol, tabla_solicitudes, supabase_admin_falso
):
    """Dos administradores con el panel abierto: el segundo se entera en
    vez de pisar la decisión del primero."""
    rol = crear_rol("Coordinador")
    id_solicitud = _solicitar(client).json()["idSolicitud"]
    _, headers = autenticar_como("Administrador")

    client.post(f"/api/v1/solicitudes-acceso/{id_solicitud}/aprobar", json={"idRol": rol.idRol}, headers=headers)
    segunda = client.post(
        f"/api/v1/solicitudes-acceso/{id_solicitud}/rechazar",
        json={"motivoRechazo": "Ya no"},
        headers=headers,
    )

    assert segunda.status_code == 409


def test_si_supabase_falla_la_solicitud_sigue_pendiente(
    client, autenticar_como, crear_rol, monkeypatch, db_session, tabla_solicitudes
):
    rol = crear_rol("Coordinador")
    id_solicitud = _solicitar(client).json()["idSolicitud"]
    _, headers = autenticar_como("Administrador")

    def fake_post(*args, **kwargs):
        raise RuntimeError("Supabase caído")

    monkeypatch.setattr("app.services.credencial_temporal_service.httpx.post", fake_post)

    respuesta = client.post(
        f"/api/v1/solicitudes-acceso/{id_solicitud}/aprobar", json={"idRol": rol.idRol}, headers=headers
    )

    assert respuesta.status_code == 503
    assert db_session.get(SolicitudAcceso, id_solicitud).estado == "pendiente"


def test_aprobar_una_solicitud_inexistente_es_404(client, autenticar_como, crear_rol, tabla_solicitudes):
    rol = crear_rol("Coordinador")
    _, headers = autenticar_como("Administrador")

    respuesta = client.post("/api/v1/solicitudes-acceso/999/aprobar", json={"idRol": rol.idRol}, headers=headers)

    assert respuesta.status_code == 404
