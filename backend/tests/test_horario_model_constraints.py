from datetime import time
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.horario import Horario


def _horario(hora_inicio: time, hora_fin: time) -> Horario:
    return Horario(
        idHorario=1,
        horaInicio=hora_inicio,
        horaFin=hora_fin,
        idJornada=1,
        idTrimestre=1,
        idAmbiente=1,
        idInstructor=uuid4(),
        idFicha=1,
        idResultado=1,
    )


def test_modelo_acepta_horario_cuando_fin_es_posterior(db_session):
    db_session.add(_horario(time(6, 0), time(6, 1)))

    db_session.commit()

    assert db_session.query(Horario).count() == 1


@pytest.mark.parametrize(
    ("hora_inicio", "hora_fin"),
    [
        (time(6, 0), time(6, 0)),
        (time(9, 0), time(8, 59)),
    ],
    ids=["horas-iguales", "fin-anterior-al-inicio"],
)
def test_modelo_rechaza_horario_si_fin_no_es_posterior(
    db_session, hora_inicio: time, hora_fin: time
):
    db_session.add(_horario(hora_inicio, hora_fin))

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()
    assert db_session.query(Horario).count() == 0
