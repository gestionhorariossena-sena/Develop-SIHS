from datetime import date, time
import uuid

import pytest
from fastapi import HTTPException

from app.models.ambiente import Ambiente
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario
from app.models.asistencia import Asistencia
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.usuario import Usuario
from app.services.eliminacion_segura_service import EliminacionSeguraService


def _instructor(db):
    rol = Rol(nombre="Instructor")
    usuario = Usuario(idUsuario=uuid.uuid4(), nombre="Ana", email=f"ana-{uuid.uuid4()}@demo.test")
    usuario.roles.append(rol)
    db.add(usuario)
    db.commit()
    return usuario


def _ficha(db, id_ficha=1):
    ficha = Ficha(idFicha=id_ficha, codigoFicha=f"F-{id_ficha}", idPrograma=1, idTrimestre=1)
    db.add(ficha)
    db.commit()
    return ficha


def _ambiente(db, id_ambiente=1):
    sede = Sede(nombre="Sede principal")
    db.add(sede)
    db.commit()
    ambiente = Ambiente(id=id_ambiente, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", sede_id=sede.id)
    db.add(ambiente)
    db.commit()
    return ambiente


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


def test_tipo_no_soportado_devuelve_404(db_session):
    with pytest.raises(HTTPException) as error:
        EliminacionSeguraService.analizar(db_session, "programa", "1")

    assert error.value.status_code == 404


def test_entidad_no_encontrada_devuelve_404(db_session):
    with pytest.raises(HTTPException) as error:
        EliminacionSeguraService.analizar(db_session, "ficha", "999")

    assert error.value.status_code == 404


def test_instructor_sin_rol_instructor_devuelve_409(db_session):
    usuario = Usuario(idUsuario=uuid.uuid4(), nombre="Pedro", email=f"pedro-{uuid.uuid4()}@demo.test")
    usuario.roles.append(Rol(nombre="Aprendiz"))
    db_session.add(usuario)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        EliminacionSeguraService.analizar(db_session, "instructor", str(usuario.idUsuario))

    assert error.value.status_code == 409


def test_aprendiz_sin_rol_aprendiz_devuelve_409(db_session):
    usuario = Usuario(idUsuario=uuid.uuid4(), nombre="Luis", email=f"luis-{uuid.uuid4()}@demo.test")
    usuario.roles.append(Rol(nombre="Instructor"))
    db_session.add(usuario)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        EliminacionSeguraService.analizar(db_session, "aprendiz", str(usuario.idUsuario))

    assert error.value.status_code == 409


def test_ficha_sin_horarios_cuenta_sus_vinculos_y_permite_eliminar(db_session):
    ficha = _ficha(db_session)
    aprendiz = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos", email=f"carlos-{uuid.uuid4()}@demo.test")
    db_session.add(aprendiz)
    db_session.commit()
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz.idUsuario))
    db_session.commit()

    resultado = EliminacionSeguraService.analizar(db_session, "ficha", str(ficha.idFicha))

    assert resultado["accion"] == "eliminar_entidad"
    assert resultado["dependencias"]["vinculosFicha"] == 1


def test_ambiente_sin_horarios_no_tiene_vinculos_y_permite_eliminar(db_session):
    ambiente = _ambiente(db_session)

    resultado = EliminacionSeguraService.analizar(db_session, "ambiente", str(ambiente.id))

    assert resultado["accion"] == "eliminar_entidad"
    assert resultado["dependencias"]["vinculosFicha"] == 0


def test_eliminar_ficha_sin_dependencias_borra_la_entidad_y_sus_vinculos(db_session):
    ficha = _ficha(db_session)
    aprendiz = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos", email=f"carlos-{uuid.uuid4()}@demo.test")
    db_session.add(aprendiz)
    db_session.commit()
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz.idUsuario))
    db_session.commit()

    resultado = EliminacionSeguraService.eliminar(db_session, "ficha", str(ficha.idFicha))

    assert resultado["accion"] == "eliminado"
    assert resultado["horariosEliminados"] == 0
    assert db_session.get(Ficha, ficha.idFicha) is None
    assert db_session.query(FichaUsuario).filter(FichaUsuario.idFicha == ficha.idFicha).count() == 0


def test_eliminar_instructor_con_borradores_borra_horarios_vinculos_y_al_instructor(db_session):
    instructor = _instructor(db_session)
    ficha = _ficha(db_session)
    db_session.add(Horario(idHorario=102, horaInicio=time(8), horaFin=time(10), idJornada=1, idTrimestre=1, idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=ficha.idFicha, idResultado=1, publicado=False, activo=True))
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=instructor.idUsuario))
    db_session.commit()

    resultado = EliminacionSeguraService.eliminar(db_session, "instructor", str(instructor.idUsuario))

    assert resultado["accion"] == "eliminado"
    assert resultado["horariosEliminados"] == 1
    assert db_session.get(Usuario, instructor.idUsuario) is None
    assert db_session.get(Horario, 102) is None
    assert db_session.query(FichaUsuario).filter(FichaUsuario.idUsuario == instructor.idUsuario).count() == 0
