import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


class SmtpNoConfiguradoError(RuntimeError):
    """SMTP_USER/SMTP_PASSWORD todavía no están en el .env — ver
    _Docs/Documentación general/DECISION_ENVIO_CREDENCIAL_TEMPORAL.md."""


class EmailService:
    """Punto único de envío de correo transaccional propio del backend (no
    confundir con los correos nativos de Supabase Auth, ej. recuperación de
    contraseña, que van por otra vía). Ver la decisión de arquitectura en
    _Docs/Documentación general/DECISION_ENVIO_CREDENCIAL_TEMPORAL.md.

    El endpoint de aprobación de solicitudes de acceso (otro ticket del
    mismo Epic SCRUM-96) debe invocar este servicio en vez de armar el
    correo inline."""

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
            if settings.frontend_url else "Ingresa al portal SIHS de tu centro.\\n"
        )
        mensaje = (
            f"Hola {destinatario_nombre},\\n\\n"
            "Coordinación ha creado tu cuenta de aprendiz en SIHS.\\n"
            f"Ficha vinculada: {codigo_ficha}\\n"
            f"Usuario: {destinatario_email}\\n"
            f"Contraseña temporal: {password_temporal}\\n\\n"
            f"{acceso}"
            "Debes cambiar la contraseña al iniciar sesión por primera vez.\\n"
            "Si no reconoces esta invitación, contacta a coordinación.\\n\\n"
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
        if not settings.smtp_user or not settings.smtp_password:
            raise SmtpNoConfiguradoError(
                "SMTP_USER/SMTP_PASSWORD no configurados — no se puede enviar correo todavía "
                "(depende del ticket de recuperación de contraseña, mismo Epic)."
            )

        mensaje = MIMEMultipart()
        mensaje["From"] = f"{settings.smtp_from_nombre} <{settings.smtp_user}>"
        mensaje["To"] = destinatario_email
        mensaje["Subject"] = asunto
        mensaje.attach(MIMEText(cuerpo_texto_plano, "plain", "utf-8"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as servidor:
            servidor.starttls()
            servidor.login(settings.smtp_user, settings.smtp_password)
            servidor.sendmail(settings.smtp_user, [destinatario_email], mensaje.as_string())
