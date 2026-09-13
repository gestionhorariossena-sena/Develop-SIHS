import uuid

from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services import solicitud_acceso_service


def _payload_solicitud(**overrides):
    payload = {
        "nombre": "Maritza Benítez Cardona",
        "email": "mbenitez@sena.edu.co",
        "numeroDocumento": "52849120",
        "motivo": "Requiero acceso de administración para asignación de ambientes.",
    }
    payload.update(overrides)
    return payload


def _usuario_supabase_fake(id_usuario=None, email="mbenitez@sena.edu.co"):
    return {"id": str(id_usuario or uuid.uuid4()), "email": email}


class TestCrearSolicitud:
    def test_publico_sin_auth(self, client, crear_rol):
        rol = crear_rol("Coordinador")

        respuesta = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        )

        assert respuesta.status_code == 201
        cuerpo = respuesta.json()
        assert cuerpo["email"] == "mbenitez@sena.edu.co"
        assert cuerpo["rolSolicitado"] == "Coordinador"
        assert cuerpo["estado"] == "pendiente"

    def test_rol_inexistente_da_404(self, client):
        respuesta = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=99999)
        )

        assert respuesta.status_code == 404

    def test_email_duplicado_pendiente_da_400(self, client, crear_rol):
        rol = crear_rol("Coordinador")
        payload = _payload_solicitud(idRolSolicitado=rol.idRol)

        client.post("/api/v1/solicitudes-acceso/", json=payload)
        respuesta = client.post("/api/v1/solicitudes-acceso/", json=payload)

        assert respuesta.status_code == 400

    def test_permite_reintentar_si_la_anterior_ya_fue_resuelta(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Coordinador")
        payload = _payload_solicitud(idRolSolicitado=rol.idRol)

        primera = client.post("/api/v1/solicitudes-acceso/", json=payload).json()
        _, headers_admin = autenticar_como("Administrador")
        client.post(
            f"/api/v1/solicitudes-acceso/{primera['idSolicitud']}/rechazar",
            json={"motivoRechazo": "Correo no institucional"},
            headers=headers_admin,
        )

        respuesta = client.post("/api/v1/solicitudes-acceso/", json=payload)

        assert respuesta.status_code == 201


class TestListarSolicitudes:
    def test_requiere_admin(self, client, autenticar_como):
        _, headers = autenticar_como("Coordinador")

        respuesta = client.get("/api/v1/solicitudes-acceso/", headers=headers)

        assert respuesta.status_code == 403

    def test_sin_filtro_devuelve_todas(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Instructor")
        client.post("/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol, email="a@sena.edu.co"))
        client.post("/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol, email="b@sena.edu.co"))
        _, headers = autenticar_como("Administrador")

        respuesta = client.get("/api/v1/solicitudes-acceso/", headers=headers)

        assert respuesta.status_code == 200
        assert len(respuesta.json()) == 2

    def test_filtra_por_estado(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Instructor")
        client.post("/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol, email="a@sena.edu.co"))
        pendiente = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol, email="b@sena.edu.co")
        ).json()
        _, headers = autenticar_como("Administrador")
        client.post(
            f"/api/v1/solicitudes-acceso/{pendiente['idSolicitud']}/rechazar",
            json={"motivoRechazo": "Duplicada"},
            headers=headers,
        )

        respuesta = client.get("/api/v1/solicitudes-acceso/?estado=rechazada", headers=headers)

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert len(cuerpo) == 1
        assert cuerpo[0]["idSolicitud"] == pendiente["idSolicitud"]


class TestAprobarSolicitud:
    def test_requiere_admin(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Coordinador")

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": rol.idRol},
            headers=headers,
        )

        assert respuesta.status_code == 403

    def test_solicitud_inexistente_da_404(self, client, autenticar_como, crear_rol):
        rol = crear_rol("Coordinador")
        _, headers = autenticar_como("Administrador")

        respuesta = client.post(
            "/api/v1/solicitudes-acceso/99999/aprobar", json={"idRol": rol.idRol}, headers=headers
        )

        assert respuesta.status_code == 404

    def test_rol_a_otorgar_inexistente_da_404(self, client, crear_rol, autenticar_como, monkeypatch):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Administrador")
        monkeypatch.setattr(
            solicitud_acceso_service,
            "crear_o_recuperar_usuario_supabase",
            lambda email, password: (_usuario_supabase_fake(email=email), True),
        )

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": 99999},
            headers=headers,
        )

        assert respuesta.status_code == 404

    def test_solicitud_ya_resuelta_da_400(self, client, crear_rol, autenticar_como, monkeypatch):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Administrador")
        monkeypatch.setattr(
            solicitud_acceso_service,
            "crear_o_recuperar_usuario_supabase",
            lambda email, password: (_usuario_supabase_fake(email=email), True),
        )
        client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": rol.idRol},
            headers=headers,
        )

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": rol.idRol},
            headers=headers,
        )

        assert respuesta.status_code == 400

    def test_flujo_completo_crea_usuario_asigna_rol_y_envia_credencial(
        self, client, crear_rol, autenticar_como, db_session, monkeypatch
    ):
        rol_solicitado = crear_rol("Coordinador")
        rol_otorgado = crear_rol("Administrador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/",
            json=_payload_solicitud(idRolSolicitado=rol_solicitado.idRol, email="mbenitez@sena.edu.co"),
        ).json()
        admin, headers = autenticar_como("Administrador")

        id_usuario_nuevo = uuid.uuid4()
        monkeypatch.setattr(
            solicitud_acceso_service,
            "crear_o_recuperar_usuario_supabase",
            lambda email, password: (_usuario_supabase_fake(id_usuario_nuevo, email), True),
        )

        llamadas_email = []
        monkeypatch.setattr(
            solicitud_acceso_service.EmailService,
            "enviar_credencial_temporal",
            staticmethod(lambda **kwargs: llamadas_email.append(kwargs)),
        )

        # El endpoint puede otorgar un rol distinto al solicitado (el
        # mockup lo permite vía selector) -- se otorga Administrador
        # aunque se solicitó Coordinador.
        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": rol_otorgado.idRol},
            headers=headers,
        )

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["estado"] == "aprobada"
        assert cuerpo["rolSolicitado"] == "Coordinador"
        assert cuerpo["idAdminResolvio"] == str(admin.idUsuario)
        assert cuerpo["fechaResolucion"] is not None

        usuario_creado = db_session.get(Usuario, id_usuario_nuevo)
        assert usuario_creado is not None
        assert usuario_creado.email == "mbenitez@sena.edu.co"
        assert usuario_creado.debe_cambiar_clave is True

        vinculo = (
            db_session.query(UsuarioRol)
            .filter(UsuarioRol.idUsuario == id_usuario_nuevo, UsuarioRol.idRol == rol_otorgado.idRol)
            .first()
        )
        assert vinculo is not None

        assert len(llamadas_email) == 1
        assert llamadas_email[0]["destinatario_email"] == "mbenitez@sena.edu.co"
        assert "password_temporal" in llamadas_email[0]

    def test_reutiliza_usuario_existente_sin_duplicarlo(
        self, client, crear_rol, crear_usuario, autenticar_como, db_session, monkeypatch
    ):
        rol = crear_rol("Instructor")
        usuario_existente = crear_usuario(nombre="Ya Existía", email="yaexistia@sena.edu.co")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/",
            json=_payload_solicitud(idRolSolicitado=rol.idRol, email="yaexistia@sena.edu.co"),
        ).json()
        _, headers = autenticar_como("Administrador")

        monkeypatch.setattr(
            solicitud_acceso_service,
            "crear_o_recuperar_usuario_supabase",
            lambda email, password: (_usuario_supabase_fake(usuario_existente.idUsuario, email), False),
        )
        monkeypatch.setattr(
            solicitud_acceso_service.EmailService, "enviar_credencial_temporal", staticmethod(lambda **kwargs: None)
        )

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": rol.idRol},
            headers=headers,
        )

        assert respuesta.status_code == 200

        total_usuarios = db_session.query(Usuario).filter(Usuario.idUsuario == usuario_existente.idUsuario).count()
        assert total_usuarios == 1
        db_session.refresh(usuario_existente)
        assert usuario_existente.nombre == "Ya Existía"
        assert usuario_existente.debe_cambiar_clave is True

    def test_no_bloquea_la_aprobacion_si_smtp_no_esta_configurado(
        self, client, crear_rol, autenticar_como, monkeypatch
    ):
        """EmailService real (sin mockear): sin SMTP_USER/SMTP_PASSWORD en
        .env, lanza SmtpNoConfiguradoError -- el endpoint no debe fallar
        por eso, la cuenta y el rol ya quedaron creados."""
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Administrador")

        from app.core.config import settings

        monkeypatch.setattr(settings, "smtp_user", "")
        monkeypatch.setattr(settings, "smtp_password", "")
        monkeypatch.setattr(
            solicitud_acceso_service,
            "crear_o_recuperar_usuario_supabase",
            lambda email, password: (_usuario_supabase_fake(email=email), True),
        )

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/aprobar",
            json={"idRol": rol.idRol},
            headers=headers,
        )

        assert respuesta.status_code == 200
        assert respuesta.json()["estado"] == "aprobada"


class TestRechazarSolicitud:
    def test_requiere_admin(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Coordinador")

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/rechazar",
            json={"motivoRechazo": "No aplica"},
            headers=headers,
        )

        assert respuesta.status_code == 403

    def test_motivo_obligatorio(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Administrador")

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/rechazar",
            json={"motivoRechazo": ""},
            headers=headers,
        )

        assert respuesta.status_code == 422

    def test_flujo_completo(self, client, crear_rol, autenticar_como, monkeypatch):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        admin, headers = autenticar_como("Administrador")

        llamadas_email = []
        monkeypatch.setattr(
            solicitud_acceso_service.EmailService,
            "enviar_rechazo_solicitud",
            staticmethod(lambda **kwargs: llamadas_email.append(kwargs)),
        )

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/rechazar",
            json={"motivoRechazo": "Correo no coincide con dominio institucional"},
            headers=headers,
        )

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["estado"] == "rechazada"
        assert cuerpo["motivoRechazo"] == "Correo no coincide con dominio institucional"
        assert cuerpo["idAdminResolvio"] == str(admin.idUsuario)

        assert len(llamadas_email) == 1
        assert llamadas_email[0]["motivo_rechazo"] == "Correo no coincide con dominio institucional"

    def test_solicitud_ya_resuelta_da_400(self, client, crear_rol, autenticar_como):
        rol = crear_rol("Coordinador")
        solicitud = client.post(
            "/api/v1/solicitudes-acceso/", json=_payload_solicitud(idRolSolicitado=rol.idRol)
        ).json()
        _, headers = autenticar_como("Administrador")
        client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/rechazar",
            json={"motivoRechazo": "Primer rechazo"},
            headers=headers,
        )

        respuesta = client.post(
            f"/api/v1/solicitudes-acceso/{solicitud['idSolicitud']}/rechazar",
            json={"motivoRechazo": "Segundo intento"},
            headers=headers,
        )

        assert respuesta.status_code == 400
