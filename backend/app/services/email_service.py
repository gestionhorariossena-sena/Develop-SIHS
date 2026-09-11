import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

HORAS_VALIDEZ_CREDENCIAL_TEMPORAL = 48


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
            f"Esta contraseña es válida por {HORAS_VALIDEZ_CREDENCIAL_TEMPORAL} horas "
            "y deberás cambiarla por una propia al iniciar sesión por primera vez.\n\n"
            "Si no reconoces esta solicitud, ignora este correo.\n\n"
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
