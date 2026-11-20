from datetime import date, time
import uuid

import pytest
from fastapi import HTTPException

from app.models.horario import Horario
from app.models.asistencia import Asistencia
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.services.eliminacion_segura_service import EliminacionSeguraService


def _instructor(db):
    rol = Rol(nombre="Instructor")
    usuario = Usuario(idUsuario=uuid.uuid4(), nombre="Ana", email=f"ana-{uuid.uuid4()}@demo.test")
    usuario.roles.append(rol)
    db.add(usuario)
    db.commit()
    return usuario


def test_previsualiza_borrador_como_eliminable(db_session):
    instructor = _instructor(db_session)
    db_session.add(Horario(idHorario=99, horaInicio=time(8), horaFin=time(10), idJornada=1, idTrimestre=1, idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=1, idResultado=1, publicado=False, activo=True))
    db_session.commit()

    resultado = EliminacionSeguraService.analizar(db_session, "instructor", str(instructor.idUsuario))

    assert resultado["accion"] == "eliminar_borradores_y_entidad"
    assert resultado["dependencias"]["horariosBorrador"] == 1


def test_bloquea_historial_publicado(db_session):
    instructor = _instructor(db_session)
    db_session.add(Horario(idHorario=100, horaInicio=time(8), horaFin=time(10), idJornada=1, idTrimestre=1, idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=1, idResultado=1, publicado=True, activo=True))
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        EliminacionSeguraService.eliminar(db_session, "instructor", str(instructor.idUsuario))

    assert error.value.status_code == 409


def test_bloquea_borrador_con_asistencia(db_session):
    instructor = _instructor(db_session)
    db_session.add(Horario(idHorario=101, horaInicio=time(8), horaFin=time(10), idJornada=1, idTrimestre=1, idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=1, idResultado=1, publicado=False, activo=True))
    db_session.add(Asistencia(idHorario=101, idUsuarioAprendiz=uuid.uuid4(), fechaSesion=date(2026, 11, 20), estado="presente"))
    db_session.commit()

    resultado = EliminacionSeguraService.analizar(db_session, "instructor", str(instructor.idUsuario))

    assert resultado["accion"] == "bloqueado"
    assert resultado["dependencias"]["asistencias"] == 1
