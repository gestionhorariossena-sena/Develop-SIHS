"""Contrato de creación: permitir borradores sin romper clientes antiguos."""
from datetime import time
from uuid import uuid4

from app.schemas.horario import HorarioCreate


def _datos():
    return {
        "horaInicio": time(6, 15),
        "horaFin": time(9, 0),
        "idJornada": 1,
        "idTrimestre": 2,
        "idAmbiente": 1,
        "idInstructor": uuid4(),
        "idFicha": 1,
        "idResultado": 1,
        "dias": [1],
    }


def test_crear_horario_acepta_borrador_explicito():
    data = HorarioCreate.model_validate({**_datos(), "publicado": False})
    assert data.publicado is False


def test_crear_horario_mantiene_compatibilidad_sin_publicado():
    data = HorarioCreate.model_validate(_datos())
    assert data.publicado is True
