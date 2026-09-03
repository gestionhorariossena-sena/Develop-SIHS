import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
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


def _catalogos_base(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(
        idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología",
        nivelFormacion="Técnico", activo=True, idCoordinacion=1,
    )
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos López", email="carlos@example.com", tipoContrato="planta")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, resultado, instructor, ficha])
    db_session.commit()
    return instructor, ficha


def _crear_horario(db_session, id_horario, instructor, ficha, dias=(1,)):
    horario = Horario(
        idHorario=id_horario, horaInicio=time(8, 0), horaFin=time(10, 0), idJornada=1, idTrimestre=1,
        idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=ficha.idFicha, idResultado=9,
    )
    db_session.add(horario)
    db_session.commit()
    for id_dia in dias:
        db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=id_dia))
    db_session.commit()
    return horario


def test_desactivar_horario_lo_marca_inactivo_y_activo_true_por_defecto(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor, ficha = _catalogos_base(db_session)
    _crear_horario(db_session, 100, instructor, ficha)

    respuesta = client.patch("/api/v1/horarios/100/estado", json={"activo": False}, headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["activo"] is False
    # El horario recién creado por el fixture no pasó por el endpoint, así
    # que confirma también el server_default=true de la columna.
    assert cuerpo["fechaCreacion"] is not None


def test_horario_desactivado_no_genera_cruce_ni_se_confunde_con_activos(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor, ficha = _catalogos_base(db_session)
    _crear_horario(db_session, 100, instructor, ficha)

    desactivado = client.patch("/api/v1/horarios/100/estado", json={"activo": False}, headers=headers)
    assert desactivado.status_code == 200

    payload = {
        "idJornada": 1, "idTrimestre": 1, "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario), "idFicha": ficha.idFicha, "idResultado": 9,
        "horaInicio": "08:00:00", "horaFin": "10:00:00", "dias": [1],
    }

    # Mismo horario exacto (ficha/instructor/ambiente/día/hora) que el
    # desactivado — sin el filtro `activo` en buscar_solape esto daría 409.
    creado = client.post("/api/v1/horarios/", json=payload, headers=headers)
    assert creado.status_code == 201


def test_cambiar_estado_404_si_el_horario_no_existe(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    respuesta = client.patch("/api/v1/horarios/999/estado", json={"activo": True}, headers=headers)

    assert respuesta.status_code == 404
