"""Semana 5 — Nicol: tests de dobles sobre el puerto externo TransporteCorreo.

Los dobles reemplazan únicamente SMTP; el formateo y la validación del
EmailService son código real. No accedemos a la red ni a credenciales reales.
"""
import email
import smtplib
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.services.email_service import EmailService, SmtpNoConfiguradoError


def _configurar_smtp_falso(monkeypatch):
    monkeypatch.setattr(settings, "smtp_user", "gestion@example.test")
    monkeypatch.setattr(settings, "smtp_password", "secreto-solo-test")
    monkeypatch.setattr(settings, "smtp_from_nombre", "SIHS Pruebas")


def _texto(mensaje_crudo):
    mensaje = email.message_from_string(mensaje_crudo)
    parte = mensaje.get_payload(0) if mensaje.is_multipart() else mensaje
    return parte.get_payload(decode=True).decode(parte.get_content_charset() or "utf-8")


def test_credencial_usa_spy_y_entrega_mensaje_con_contrato_real(monkeypatch):
    # SPY/MOCK del puerto TransporteCorreo: verifica llamada, destinatario y MIME,
    # sin simular la lógica de composición del mensaje.
    _configurar_smtp_falso(monkeypatch)
    transporte = Mock(spec=["enviar"])
    monkeypatch.setattr(EmailService, "_crear_transporte", staticmethod(lambda: transporte))

    resultado = EmailService.enviar_credencial_temporal(
        destinatario_email="aprendiz@example.test",
        destinatario_nombre="María Prueba",
        password_temporal="temporal-s5-123",
    )

    assert resultado is None
    transporte.enviar.assert_called_once()
    kwargs = transporte.enviar.call_args.kwargs
    assert kwargs["remitente"] == "gestion@example.test"
    assert kwargs["destinatario"] == "aprendiz@example.test"
    mensaje = email.message_from_string(kwargs["mensaje"])
    assert mensaje["To"] == "aprendiz@example.test"
    assert "credencial temporal" in str(mensaje["Subject"]).lower()
    texto = _texto(kwargs["mensaje"])
    assert "María Prueba" in texto
    assert "temporal-s5-123" in texto
    assert "48 horas" in texto


def test_sin_configuracion_no_usa_el_transporte(monkeypatch):
    # MOCK estricto: confirma ausencia de interacciones con dependencia externa.
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(settings, "smtp_password", "")
    transporte = Mock(spec=["enviar"])
    fabrica = Mock(return_value=transporte)
    monkeypatch.setattr(EmailService, "_crear_transporte", staticmethod(fabrica))

    with pytest.raises(SmtpNoConfiguradoError, match="SMTP_USER/SMTP_PASSWORD"):
        EmailService.enviar_credencial_temporal(
            destinatario_email="aprendiz@example.test",
            destinatario_nombre="Aprendiz",
            password_temporal="solo-test",
        )

    fabrica.assert_not_called()
    transporte.enviar.assert_not_called()


def test_error_de_transporte_se_propaga_y_no_se_silencia(monkeypatch):
    # STUB fallido + SPY: reproduce la caída de SMTP y exige error observable.
    _configurar_smtp_falso(monkeypatch)
    transporte = Mock(spec=["enviar"])
    transporte.enviar.side_effect = smtplib.SMTPServerDisconnected("Servidor SMTP caído")
    monkeypatch.setattr(EmailService, "_crear_transporte", staticmethod(lambda: transporte))

    with pytest.raises(smtplib.SMTPServerDisconnected, match="Servidor SMTP caído"):
        EmailService.enviar_credencial_temporal(
            destinatario_email="aprendiz@example.test",
            destinatario_nombre="Aprendiz",
            password_temporal="solo-test",
        )

    transporte.enviar.assert_called_once()


def test_rechazo_de_solicitud_envia_motivo_mediante_fake(monkeypatch):
    # FAKE en memoria: estado observable de correos entregados y sin SMTP real.
    _configurar_smtp_falso(monkeypatch)

    class FakeTransporte:
        def __init__(self):
            self.entregados = []

        def enviar(self, *, remitente, destinatario, mensaje):
            self.entregados.append({
                "remitente": remitente, "destinatario": destinatario, "mensaje": mensaje
            })

    fake = FakeTransporte()
    monkeypatch.setattr(EmailService, "_crear_transporte", staticmethod(lambda: fake))

    resultado = EmailService.enviar_rechazo_solicitud(
        destinatario_email="rechazado@example.test",
        destinatario_nombre="Ana Prueba",
        motivo_rechazo="Documento incompleto",
    )

    assert resultado is None
    assert len(fake.entregados) == 1
    enviado = fake.entregados[0]
    assert enviado["destinatario"] == "rechazado@example.test"
    assert enviado["remitente"] == "gestion@example.test"
    assert "Ana Prueba" in _texto(enviado["mensaje"])
    assert "Documento incompleto" in _texto(enviado["mensaje"])
