"""Correo SMTP de demo: solo APP_ENV=demo y puerto local sin TLS."""
from app.core.config import settings
from app.services.email_service import EmailService


def test_demo_local_permite_smtp_sin_credenciales(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "demo")
    monkeypatch.setattr(settings, "smtp_host", "host.docker.internal")
    monkeypatch.setattr(settings, "smtp_port", 54325)
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(settings, "smtp_password", "")
    assert EmailService.correo_demo_local()
    assert EmailService.smtp_configurado()


def test_fuera_de_demo_requiere_credenciales(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "smtp_host", "host.docker.internal")
    monkeypatch.setattr(settings, "smtp_port", 54325)
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(settings, "smtp_password", "")
    assert not EmailService.correo_demo_local()
    assert not EmailService.smtp_configurado()


def test_demo_no_permite_host_remoto_sin_credenciales(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "demo")
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_port", 54325)
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(settings, "smtp_password", "")
    assert not EmailService.correo_demo_local()
    assert not EmailService.smtp_configurado()
