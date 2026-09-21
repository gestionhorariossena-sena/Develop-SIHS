"""SCRUM-120: GET /usuarios/me/horarios/pdf — autoservicio, mismo criterio
de permisos que GET /usuarios/me/horarios (sin exigir rol de gestión)."""

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


def test_pdf_de_mi_horario_no_exige_rol_de_gestion(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    instructor, headers = autenticar_como("Instructor")

    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo",
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(
        id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1,
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, ficha])
    db_session.commit()

    horario = Horario(
        idHorario=1,
        horaInicio=time(7, 0),
        horaFin=time(10, 0),
        idJornada=1,
        idTrimestre=1,
        idAmbiente=1,
        idInstructor=instructor.idUsuario,
        idFicha=1,
        idResultado=1,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=1))
    db_session.commit()

    respuesta = client.get("/api/v1/usuarios/me/horarios/pdf", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "application/pdf"
    assert respuesta.content.startswith(b"%PDF")


def test_pdf_de_mi_horario_sin_horarios_igual_devuelve_pdf_valido(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/usuarios/me/horarios/pdf", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.content.startswith(b"%PDF")
