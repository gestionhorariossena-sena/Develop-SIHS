import smtplib
from typing import Protocol
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


class SmtpNoConfiguradoError(RuntimeError):
    """SMTP_USER/SMTP_PASSWORD todavía no están en el .env — ver
    _Docs/Documentación general/DECISION_ENVIO_CREDENCIAL_TEMPORAL.md."""


class TransporteCorreo(Protocol):
    """Puerto del proyecto: el servicio depende del contrato, no de smtplib."""

    def enviar(self, *, remitente: str, destinatario: str, mensaje: str) -> None: ...


class TransporteSMTP:
    """Adaptador real SMTP; los tests del servicio sustituyen este borde."""

    def enviar(self, *, remitente: str, destinatario: str, mensaje: str) -> None:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as servidor:
            servidor.starttls()
            servidor.login(settings.smtp_user, settings.smtp_password)
            servidor.sendmail(remitente, [destinatario], mensaje)


class EmailService:
    @staticmethod
    def correo_demo_local() -> bool:
        """Solo el contenedor demo puede enviar a SMTP local sin TLS/login."""
        return (
            settings.app_env == "demo"
            and (
                (settings.smtp_host == "mailpit" and settings.smtp_port == 1025)
                or (settings.smtp_host == "host.docker.internal" and settings.smtp_port == 54325)
            )
        )

    @staticmethod
    def smtp_configurado() -> bool:
        return EmailService.correo_demo_local() or bool(settings.smtp_user and settings.smtp_password)

    """Punto único de envío de correo transaccional propio del backend (no
    confundir con los correos nativos de Supabase Auth, ej. recuperación de
    contraseña, que van por otra vía). Ver la decisión de arquitectura en
    _Docs/Documentación general/DECISION_ENVIO_CREDENCIAL_TEMPORAL.md.

    El endpoint de aprobación de solicitudes de acceso (otro ticket del
    mismo Epic SCRUM-96) debe invocar este servicio en vez de armar el
    correo inline."""

    @staticmethod
    def _crear_transporte() -> TransporteCorreo:
        """Punto de inyección: permite probar sin SMTP real."""
        return TransporteSMTP()

    @staticmethod
    def enviar_credencial_temporal(*, destinatario_email: str, destinatario_nombre: str, password_temporal: str) -> None:
        asunto = "Tu acceso a SIHS SENA — credencial temporal"
        cuerpo = (
            f"Hola {destinatario_nombre},\n\n"
            "Tu solicitud de acceso al Sistema Integrado de Horarios (SIHS) fue "
            "aprobada. Estas son tus credenciales temporales:\n\n"
            f"  Usuario (correo): {destinatario_email}\n"
            f"  Contraseña temporal: {password_temporal}\n\n"
            "Deberás cambiar esta contraseña por una propia al iniciar sesión por primera vez.\n\n"
            "Si no reconoces esta solicitud, ignora este correo.\n\n"
            "— SIHS SENA, Gestión de Horarios"
        )

        EmailService._enviar(destinatario_email, asunto, cuerpo)

    @staticmethod
    def enviar_alta_instructor(*, destinatario_email: str, destinatario_nombre: str, password_temporal: str) -> None:
        """Invitación por gestión; no presupone que el docente solicitó acceso."""
        asunto = "Tu cuenta de instructor en SIHS"
        acceso = f"Accede a {settings.frontend_url.rstrip('/')}/login\n" if settings.frontend_url else "Ingresa al portal SIHS de tu centro.\n"
        cuerpo = (
            f"Hola {destinatario_nombre},\n\n"
            "Coordinación académica ha creado tu cuenta de instructor en SIHS.\n"
            f"Usuario: {destinatario_email}\n"
            f"Contraseña temporal: {password_temporal}\n\n"
            f"{acceso}"
            "Al iniciar sesión deberás cambiar la contraseña temporal por una propia.\n"
            "No compartas estas credenciales. Si no reconoces esta invitación, contacta a coordinación.\n\n"
            "SIHS SENA — Gestión de Horarios"
        )
        EmailService._enviar(destinatario_email, asunto, cuerpo)

    @staticmethod
    def enviar_alta_aprendiz(
        *, destinatario_email: str, destinatario_nombre: str,
        password_temporal: str, codigo_ficha: str,
    ) -> None:
        """Invitación administrativa con cambio de clave obligatorio."""
        asunto = "Tu cuenta de aprendiz en SIHS"
        acceso = (
            f"Ingresa a {settings.frontend_url.rstrip('/')}/login\n"
            if settings.frontend_url else "Ingresa al portal SIHS de tu centro.\n"
        )
        mensaje = (
            f"Hola {destinatario_nombre},\n\n"
            "Coordinación ha creado tu cuenta de aprendiz en SIHS.\n"
            f"Ficha vinculada: {codigo_ficha}\n"
            f"Usuario: {destinatario_email}\n"
            f"Contraseña temporal: {password_temporal}\n\n"
            f"{acceso}"
            "Debes cambiar la contraseña al iniciar sesión por primera vez.\n"
            "Si no reconoces esta invitación, contacta a coordinación.\n\n"
            "SIHS SENA — Gestión de Horarios"
        )
        EmailService._enviar(destinatario_email, asunto, mensaje)

    @staticmethod
    def enviar_rechazo_solicitud(*, destinatario_email: str, destinatario_nombre: str, motivo_rechazo: str) -> None:
        asunto = "Tu solicitud de acceso a SIHS SENA no fue aprobada"
        cuerpo = (
            f"Hola {destinatario_nombre},\n\n"
            "Tu solicitud de acceso al Sistema Integrado de Horarios (SIHS) fue "
            "revisada y no fue aprobada.\n\n"
            f"Motivo: {motivo_rechazo}\n\n"
            "Si consideras que esto es un error o quieres corregir tu solicitud, "
            "puedes volver a solicitarla desde el portal público de registro.\n\n"
            "— SIHS SENA, Gestión de Horarios"
        )

        EmailService._enviar(destinatario_email, asunto, cuerpo)

    @staticmethod
    def _enviar(destinatario_email: str, asunto: str, cuerpo_texto_plano: str) -> None:
        if not EmailService.smtp_configurado():
            raise SmtpNoConfiguradoError("No se ha configurado SMTP para invitaciones.")

        mensaje = MIMEMultipart()
        remitente = settings.smtp_user or "sihs-demo@localhost.test"
        mensaje["From"] = f"{settings.smtp_from_nombre} <{remitente}>"
        mensaje["To"] = destinatario_email
        mensaje["Subject"] = asunto
        mensaje.attach(MIMEText(cuerpo_texto_plano, "plain", "utf-8"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as servidor:
            if not EmailService.correo_demo_local():
                servidor.starttls()
                servidor.login(settings.smtp_user, settings.smtp_password)
            servidor.sendmail(remitente, [destinatario_email], mensaje.as_string())
