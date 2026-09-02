"""GET /usuarios/{id}/carga-semanal — backlog "Nuevo alcance" épica B,
tarea 14. Alimenta la sección "Carga semanal" del drawer de instructor
en Instructores.tsx (épica D, tarea 26)."""

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


def test_carga_semanal_requiere_lectura_catalogo(client, autenticar_como, crear_usuario):
    objetivo = crear_usuario(nombre="Sergio")
    _, headers = autenticar_como("Aprendiz")

    respuesta = client.get(f"/api/v1/usuarios/{objetivo.idUsuario}/carga-semanal", headers=headers)

    assert respuesta.status_code == 403


def test_carga_semanal_usuario_inexistente_da_404(client, autenticar_como):
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/usuarios/{uuid.uuid4()}/carga-semanal", headers=headers)

    assert respuesta.status_code == 404


def test_carga_semanal_sin_tipo_contrato_no_calcula_maximo(client, db_session, autenticar_como, crear_usuario):
    _crear_tablas_extra(db_session)
    objetivo = crear_usuario(nombre="SinContrato")
    _, headers = autenticar_como("Coordinador")

    respuesta = client.get(f"/api/v1/usuarios/{objetivo.idUsuario}/carga-semanal", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["horasAsignadas"] == 0
    assert cuerpo["horasMaximas"] is None
    assert cuerpo["tipoContrato"] is None


def test_carga_semanal_suma_horas_de_todos_los_horarios_del_instructor(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)

    _, headers = autenticar_como("Coordinador")

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
    dia_martes = DiaSemana(idDia=2, nombreDia="Martes")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    instructor_planta = Usuario(
        idUsuario=uuid.uuid4(), nombre="Sergio Planta", email="sergio@example.com", tipoContrato="planta"
    )

    db_session.add_all(
        [coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, dia_martes, ficha, instructor_planta]
    )
    db_session.commit()

    # 3h el lunes + 3h el martes = 6h/semana asignadas.
    horario_1 = Horario(
        idHorario=1,
        horaInicio=time(7, 0),
        horaFin=time(10, 0),
        idJornada=1,
        idTrimestre=1,
        idAmbiente=1,
        idInstructor=instructor_planta.idUsuario,
        idFicha=1,
        idResultado=1,
    )
    db_session.add(horario_1)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=1))
    db_session.execute(horario_dia.insert().values(idHorario=1, idDia=2))
    db_session.commit()

    respuesta = client.get(f"/api/v1/usuarios/{instructor_planta.idUsuario}/carga-semanal", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["horasAsignadas"] == 6
    assert cuerpo["horasMaximas"] == 32
    assert cuerpo["tipoContrato"] == "planta"
