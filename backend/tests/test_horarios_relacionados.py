"""SCRUM-46/47/48: GET /usuarios/{id}/horarios, /fichas/{id}/horarios y
/ambientes/{id}/horarios — alimentan el drawer de relacionados
(Instructores.tsx/Fichas.tsx, épica D del backlog "Nuevo alcance")."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base
    from app.models.resultado_aprendizaje import ResultadoAprendizaje

    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Sede.__table__,
        Ambiente.__table__,
        Jornada.__table__,
        DiaSemana.__table__,
        Ficha.__table__,
        ResultadoAprendizaje.__table__,
        Horario.__table__,
        horario_dia,
        Usuario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5),
        fechaFin=date(2026, 4, 30), estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(
        id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular",
        estado_ambiente="disponible", sede_id=1,
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos Lopez", email="carlos.rel@example.com")

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, ficha, instructor])
    db_session.commit()

    horario = Horario(
        idHorario=1, horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1,
        idTrimestre=1, idAmbiente=ambiente.id, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=1,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=1))
    db_session.commit()

    return {"idAmbiente": ambiente.id, "idFicha": ficha.idFicha, "idInstructor": instructor.idUsuario}


def test_horarios_por_instructor(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/usuarios/{catalogos['idInstructor']}/horarios", headers=headers)

    assert respuesta.status_code == 200
    horarios = respuesta.json()
    assert len(horarios) == 1
    assert horarios[0]["idFicha"] == catalogos["idFicha"]


def test_horarios_por_instructor_404_si_no_existe(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/usuarios/{uuid.uuid4()}/horarios", headers=headers)

    assert respuesta.status_code == 404


def test_horarios_por_ficha(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/fichas/{catalogos['idFicha']}/horarios", headers=headers)

    assert respuesta.status_code == 200
    horarios = respuesta.json()
    assert len(horarios) == 1
    assert horarios[0]["idInstructor"] == str(catalogos["idInstructor"])


def test_horarios_por_ficha_404_si_no_existe(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get("/api/v1/fichas/9999/horarios", headers=headers)

    assert respuesta.status_code == 404


def test_horarios_por_ambiente(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/ambientes/{catalogos['idAmbiente']}/horarios", headers=headers)

    assert respuesta.status_code == 200
    horarios = respuesta.json()
    assert len(horarios) == 1
    assert horarios[0]["idFicha"] == catalogos["idFicha"]


def test_horarios_por_ambiente_404_si_no_existe(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get("/api/v1/ambientes/9999/horarios", headers=headers)

    assert respuesta.status_code == 404


def test_horarios_relacionados_requieren_rol_lectura_catalogo(client, db_session, autenticar_como):
    """Instructor/Aprendiz no tienen `require_lectura_catalogo` — 403, no 200."""
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/fichas/{catalogos['idFicha']}/horarios", headers=headers)

    assert respuesta.status_code == 403
