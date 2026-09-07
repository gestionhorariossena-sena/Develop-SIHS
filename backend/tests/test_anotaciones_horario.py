"""SCRUM-107: anotaciones personales de horario del Aprendiz — notas,
recordatorio y etiqueta sobre un bloque real de horario, solo visibles/
editables por su propio dueño."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.anotacion_horario import AnotacionHorario
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__,
        Programa.__table__,
        Trimestre.__table__,
        Ambiente.__table__,
        Jornada.__table__,
        DiaSemana.__table__,
        Ficha.__table__,
        Sede.__table__,
        CompetenciaFormacion.__table__,
        ResultadoAprendizaje.__table__,
        Horario.__table__,
        horario_dia,
        Usuario.__table__,
        AnotacionHorario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _crear_horario(db_session) -> Horario:
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1,
        codigoPrograma="TEC-01",
        nombrePrograma="Tecnología",
        nivelFormacion="Técnico",
        activo=True,
        idCoordinacion=1,
    )
    trimestre = Trimestre(
        idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo"
    )
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(
        id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1
    )
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)
    competencia = CompetenciaFormacion(idCompetencia=1, codigo="COMP-1", descripcion="Competencia", idPrograma=1)
    resultado = ResultadoAprendizaje(idResultado=1, codigo="RAP-1", descripcion="Resultado", idCompetencia=1)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Instructor", email="instructor@example.com")

    db_session.add_all(
        [coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, ficha, competencia, resultado, instructor]
    )
    db_session.commit()

    horario = Horario(
        idHorario=1,
        horaInicio=time(7, 0),
        horaFin=time(9, 0),
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
    return horario


def test_crear_anotacion_requiere_rol_aprendiz(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _crear_horario(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post(
        "/api/v1/anotaciones-horario/",
        json={"idHorario": 1, "nota": "Traer pendrive", "etiqueta": "Importante"},
        headers=headers,
    )

    assert respuesta.status_code == 403


def test_crear_y_listar_solo_las_propias(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _crear_horario(db_session)
    aprendiz_1, headers_1 = autenticar_como("Aprendiz")
    aprendiz_2, headers_2 = autenticar_como("Aprendiz")

    respuesta_crear = client.post(
        "/api/v1/anotaciones-horario/",
        json={"idHorario": 1, "nota": "Traer pendrive", "etiqueta": "Importante", "recordatorioActivo": True},
        headers=headers_1,
    )
    assert respuesta_crear.status_code == 201
    assert respuesta_crear.json()["idUsuario"] == str(aprendiz_1.idUsuario)

    client.post(
        "/api/v1/anotaciones-horario/",
        json={"idHorario": 1, "nota": "Otra nota", "etiqueta": "Normal"},
        headers=headers_2,
    )

    propias_1 = client.get("/api/v1/anotaciones-horario/mias", headers=headers_1).json()
    propias_2 = client.get("/api/v1/anotaciones-horario/mias", headers=headers_2).json()

    assert len(propias_1) == 1
    assert propias_1[0]["nota"] == "Traer pendrive"
    assert len(propias_2) == 1
    assert propias_2[0]["nota"] == "Otra nota"


def test_editar_la_propia_anotacion(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _crear_horario(db_session)
    _, headers = autenticar_como("Aprendiz")

    creada = client.post(
        "/api/v1/anotaciones-horario/",
        json={"idHorario": 1, "nota": "Nota original", "etiqueta": "Normal"},
        headers=headers,
    ).json()

    respuesta = client.put(
        f"/api/v1/anotaciones-horario/{creada['idAnotacion']}",
        json={"nota": "Nota editada", "etiqueta": "Examen", "recordatorioActivo": True},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["nota"] == "Nota editada"
    assert respuesta.json()["etiqueta"] == "Examen"


def test_no_puede_editar_ni_borrar_la_de_otro_usuario(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _crear_horario(db_session)
    _, headers_dueno = autenticar_como("Aprendiz")
    _, headers_otro = autenticar_como("Aprendiz")

    creada = client.post(
        "/api/v1/anotaciones-horario/",
        json={"idHorario": 1, "nota": "Nota privada", "etiqueta": "Normal"},
        headers=headers_dueno,
    ).json()

    respuesta_editar = client.put(
        f"/api/v1/anotaciones-horario/{creada['idAnotacion']}",
        json={"nota": "hackeada", "etiqueta": "Normal", "recordatorioActivo": False},
        headers=headers_otro,
    )
    respuesta_borrar = client.delete(
        f"/api/v1/anotaciones-horario/{creada['idAnotacion']}",
        headers=headers_otro,
    )

    assert respuesta_editar.status_code == 404
    assert respuesta_borrar.status_code == 404


def test_borrar_la_propia_anotacion(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _crear_horario(db_session)
    _, headers = autenticar_como("Aprendiz")

    creada = client.post(
        "/api/v1/anotaciones-horario/",
        json={"idHorario": 1, "nota": "Nota a borrar", "etiqueta": "Normal"},
        headers=headers,
    ).json()

    respuesta = client.delete(f"/api/v1/anotaciones-horario/{creada['idAnotacion']}", headers=headers)

    assert respuesta.status_code == 204
    assert client.get("/api/v1/anotaciones-horario/mias", headers=headers).json() == []
