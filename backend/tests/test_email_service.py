import email

import pytest

from app.core.config import settings
from app.services.email_service import EmailService, SmtpNoConfiguradoError


def _cuerpo_texto_plano(mensaje_raw: str) -> str:
    mensaje = email.message_from_string(mensaje_raw)
    parte = mensaje.get_payload(0) if mensaje.is_multipart() else mensaje
    return parte.get_payload(decode=True).decode(parte.get_content_charset() or "utf-8")


class FakeSMTP:
    instancias: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.starttls_llamado = False
        self.login_con: tuple[str, str] | None = None
        self.enviados: list[tuple[str, list[str], str]] = []
        FakeSMTP.instancias.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.starttls_llamado = True

    def login(self, usuario, password):
        self.login_con = (usuario, password)

    def sendmail(self, from_addr, to_addrs, msg):
        self.enviados.append((from_addr, to_addrs, msg))


@pytest.fixture(autouse=True)
def _limpiar_instancias_fake_smtp():
    FakeSMTP.instancias.clear()
    yield
    FakeSMTP.instancias.clear()


def test_falla_explicito_si_smtp_no_esta_configurado(monkeypatch):
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(settings, "smtp_password", "")

    with pytest.raises(SmtpNoConfiguradoError):
        EmailService.enviar_credencial_temporal(
            destinatario_email="alguien@sena.edu.co",
            destinatario_nombre="Alguien",
            password_temporal="clave-temporal-123",
        )


def test_envia_la_contrasena_temporal_en_el_cuerpo_del_correo(monkeypatch):
    monkeypatch.setattr(settings, "smtp_user", "gestion@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")
    monkeypatch.setattr("smtplib.SMTP", FakeSMTP)

    EmailService.enviar_credencial_temporal(
        destinatario_email="mbenitez@sena.edu.co",
        destinatario_nombre="Maritza Benítez",
        password_temporal="tmp-Xy9!23",
    )

    assert len(FakeSMTP.instancias) == 1
    servidor = FakeSMTP.instancias[0]

    assert servidor.starttls_llamado is True
    assert servidor.login_con == ("gestion@gmail.com", "app-password")

    assert len(servidor.enviados) == 1
    from_addr, to_addrs, mensaje_raw = servidor.enviados[0]
    assert from_addr == "gestion@gmail.com"
    assert to_addrs == ["mbenitez@sena.edu.co"]

    cuerpo = _cuerpo_texto_plano(mensaje_raw)
    assert "tmp-Xy9!23" in cuerpo
    assert "48 horas" in cuerpo
