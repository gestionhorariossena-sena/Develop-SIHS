from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from sqlalchemy.exc import SQLAlchemyError

from app.services.worker_publicacion_service import consultar_disponibilidad


def _db_con_senal(ultima_senal):
    fila = Mock(ultimaSenal=ultima_senal)
    db = Mock()
    db.execute.return_value.scalar_one_or_none.return_value = fila
    return db


def test_senal_en_el_limite_de_30_segundos_sigue_habilitando_worker():
    ahora = datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc)
    db = _db_con_senal(ahora - timedelta(seconds=30))

    resultado = consultar_disponibilidad(db, ahora=ahora)

    assert resultado == {
        "habilitado": True,
        "ultimaSenal": ahora - timedelta(seconds=30),
        "segundosDesdeSenal": 30,
        "motivo": None,
    }


def test_senal_futura_se_interpreta_como_reciente_sin_edad_negativa():
    ahora = datetime(2026, 11, 2, 15, 0, tzinfo=timezone.utc)
    senal_futura = (ahora + timedelta(seconds=5)).replace(tzinfo=None)
    db = _db_con_senal(senal_futura)

    resultado = consultar_disponibilidad(db, ahora=ahora)

    assert resultado["habilitado"] is True
    assert resultado["ultimaSenal"] == senal_futura.replace(tzinfo=timezone.utc)
    assert resultado["segundosDesdeSenal"] == 0
    assert resultado["motivo"] is None


def test_error_de_base_de_datos_desactiva_worker_y_revierte_transaccion():
    db = Mock()
    db.execute.side_effect = SQLAlchemyError("fallo de consulta")

    resultado = consultar_disponibilidad(db, ahora=datetime.now(timezone.utc))

    assert resultado == {
        "habilitado": False,
        "ultimaSenal": None,
        "segundosDesdeSenal": None,
        "motivo": "No se pudo consultar la señal de disponibilidad del worker.",
    }
    db.rollback.assert_called_once_with()
