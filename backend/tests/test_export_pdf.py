from datetime import time

from app.core.database import Base
from app.models.ambiente import Ambiente
from app.models.dia_semana import DiaSemana
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede


def _crear_tablas_extra(db_session):
    tablas = [
        Sede.__table__,
        Ambiente.__table__,
        Jornada.__table__,
        DiaSemana.__table__,
        ResultadoAprendizaje.__table__,
        Horario.__table__,
        horario_dia,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _armar_horario(db_session, *, instructor, ficha):
    # coordinación/programa/trimestre ya los crea el fixture crear_ficha
    # (conftest.py) -- acá solo se agrega lo que le falta a esa ficha para
    # tener un horario real: sede, ambiente, jornada, día y resultado.
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)

    db_session.add_all([sede, ambiente, jornada, dia_lunes, resultado])
    db_session.commit()

    horario = Horario(
        idHorario=100, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1,
        idTrimestre=ficha.idTrimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=ficha.idFicha, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=100, idDia=1))
    db_session.commit()
    return horario


def test_descargar_horario_pdf_caso_feliz(client, db_session, autenticar_como, crear_usuario, crear_ficha):
    _crear_tablas_extra(db_session)
    instructor = crear_usuario(nombre="Carlos")
    ficha = crear_ficha(codigo="2874521")
    horario = _armar_horario(db_session, instructor=instructor, ficha=ficha)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get(f"/api/v1/horarios/{horario.idHorario}/pdf", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "application/pdf"
    assert respuesta.content.startswith(b"%PDF")


def test_descargar_horario_pdf_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/horarios/9999/pdf", headers=headers)

    assert respuesta.status_code == 404


def test_descargar_horario_pdf_no_requiere_rol_de_gestion(client, db_session, autenticar_como, crear_usuario, crear_ficha):
    """Mismo criterio que GET /fichas/{id}/vocero: cualquier usuario
    autenticado puede descargar, no solo Coordinador/Administrador."""
    _crear_tablas_extra(db_session)
    instructor = crear_usuario(nombre="Carlos")
    ficha = crear_ficha(codigo="2874521")
    horario = _armar_horario(db_session, instructor=instructor, ficha=ficha)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get(f"/api/v1/horarios/{horario.idHorario}/pdf", headers=headers)

    assert respuesta.status_code == 200


def test_descargar_ficha_pdf_incluye_horario_y_nomina(client, db_session, autenticar_como, crear_usuario, crear_ficha):
    _crear_tablas_extra(db_session)
    ficha = crear_ficha(codigo="2874521")
    instructor = crear_usuario(nombre="Carlos")
    _armar_horario(db_session, instructor=instructor, ficha=ficha)

    aprendiz = crear_usuario(nombre="Sara")
    db_session.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=aprendiz.idUsuario, rolEnFicha="vocero"))
    db_session.commit()

    _, headers = autenticar_como("Aprendiz")
    respuesta = client.get(f"/api/v1/fichas/{ficha.idFicha}/pdf", headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "application/pdf"
    assert respuesta.content.startswith(b"%PDF")


def test_descargar_ficha_pdf_inexistente_da_404(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get("/api/v1/fichas/9999/pdf", headers=headers)

    assert respuesta.status_code == 404
