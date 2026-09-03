"""Bug reportado 2026-09-02: borrar un "horario completo" (horarios_
guardados, el snapshot que arma NuevoHorario.tsx) no borraba las clases
reales correspondientes en `horarios` — quedaban huérfanas y el instructor
seguía "ocupado" para cruces aunque su horario ya no apareciera en el
historial. Las dos tablas no tenían ningún vínculo. Ahora el snapshot
guarda `idsHorarios` (los ids reales creados en el mismo guardado) y
borrarlo borra también esas clases."""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.horario_guardado import HorarioGuardado
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario


def _crear_tablas_extra(db_session):
    from app.core.database import Base

    tablas = [
        Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
        Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__,
        ResultadoAprendizaje.__table__, Horario.__table__, horario_dia, Usuario.__table__,
        HorarioGuardado.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def _poblar(db_session):
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Tecnología")
    programa = Programa(idPrograma=1, codigoPrograma="TEC-01", nombrePrograma="Tecnología", nivelFormacion="Técnico", activo=True, idCoordinacion=1)
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    sede = Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal")
    ambiente = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    jornada = Jornada(idJornada=1, nombreJornada="Mañana")
    dia_lunes = DiaSemana(idDia=1, nombreDia="Lunes")
    resultado = ResultadoAprendizaje(idResultado=9, descripcion="Resultado A", codigo="RA-9", idCompetencia=1, horasAsignadas=10)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Carlos López", email="carlos.guardado@example.com", tipoContrato="planta")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([coordinacion, programa, trimestre, sede, ambiente, jornada, dia_lunes, resultado, instructor, ficha])
    db_session.commit()

    horario = Horario(
        idHorario=500, horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1, idTrimestre=1,
        idAmbiente=ambiente.id, idInstructor=instructor.idUsuario, idFicha=ficha.idFicha, idResultado=resultado.idResultado,
    )
    db_session.add(horario)
    db_session.commit()
    db_session.execute(horario_dia.insert().values(idHorario=500, idDia=1))
    db_session.commit()

    return {"idHorario": horario.idHorario, "idInstructor": instructor.idUsuario}


def test_borrar_horario_completo_borra_tambien_la_clase_real_vinculada(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    payload = {
        "ficha": "FICHA-001", "aprendices": "30", "horasTrimestre": "20",
        "fechaInicio": None, "fechaFin": None,
        "bloques": [{"id": "b1", "tematica": "Tema", "instructor": "Carlos López", "ficha": "FICHA-001", "ambiente": "Ambiente"}],
        "grid": [["b1"]],
        "idsHorarios": [catalogos["idHorario"]],
    }
    creado = client.post("/api/v1/horarios-guardados/", json=payload, headers=headers)
    assert creado.status_code == 200
    id_guardado = creado.json()["idHorarioGuardado"]

    respuesta = client.delete(f"/api/v1/horarios-guardados/{id_guardado}", headers=headers)

    assert respuesta.status_code == 200
    assert db_session.query(HorarioGuardado).count() == 0
    # Antes del fix esta clase quedaba huérfana — el instructor seguía
    # "ocupado" para cruces aunque el horario completo ya no apareciera.
    assert db_session.query(Horario).filter(Horario.idHorario == catalogos["idHorario"]).first() is None


def test_borrar_horario_completo_sin_idshorarios_no_falla_ni_borra_otras_clases(client, db_session, autenticar_como):
    """Snapshots creados antes de este fix (o sin idsHorarios por lo que
    sea) siguen borrándose sin romper — solo no pueden liberar la clase
    real, porque no hay forma de saber cuál era."""
    _crear_tablas_extra(db_session)
    catalogos = _poblar(db_session)
    _, headers = autenticar_como("Coordinador")

    payload = {
        "ficha": "FICHA-001", "aprendices": "30", "horasTrimestre": "20",
        "fechaInicio": None, "fechaFin": None,
        "bloques": [{"id": "b1", "tematica": "Tema", "instructor": "Carlos López", "ficha": "FICHA-001", "ambiente": "Ambiente"}],
        "grid": [["b1"]],
    }
    creado = client.post("/api/v1/horarios-guardados/", json=payload, headers=headers)
    id_guardado = creado.json()["idHorarioGuardado"]

    respuesta = client.delete(f"/api/v1/horarios-guardados/{id_guardado}", headers=headers)

    assert respuesta.status_code == 200
    assert db_session.query(HorarioGuardado).count() == 0
    assert db_session.query(Horario).filter(Horario.idHorario == catalogos["idHorario"]).first() is not None


def test_listar_horarios_guardados_con_idshorarios_null_no_da_500(client, db_session, autenticar_como):
    """Bug reportado 2026-09-02, segunda vuelta: snapshots creados ANTES
    de que existiera la columna `idsHorarios` quedan con NULL en la BD
    real (no `[]` — el default de Pydantic solo aplica cuando el cliente
    omite el campo al crear, no a filas insertadas por fuera de la API).
    GET /horarios-guardados/ tumbaba TODO el listado con
    ResponseValidationError apenas topaba una fila así — en Historial de
    horarios esto se veía como "solo cargan los horarios individuales,
    nunca los completos"."""
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    usuario, headers = autenticar_como("Coordinador")

    guardado_legado = HorarioGuardado(
        idUsuario=usuario.idUsuario,
        ficha="FICHA-VIEJA",
        bloques=[{"id": "b1", "tematica": "Tema", "instructor": "Carlos López", "ficha": "FICHA-VIEJA", "ambiente": "Ambiente"}],
        grid=[["b1"]],
        # Sin idsHorarios: queda NULL en la BD, como cualquier fila creada
        # antes de que este campo existiera.
    )
    db_session.add(guardado_legado)
    db_session.commit()

    respuesta = client.get("/api/v1/horarios-guardados/", headers=headers)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["idsHorarios"] == []


def test_instructor_no_puede_ver_el_historial_de_horarios_de_otros(client, db_session, autenticar_como):
    """Reportado 2026-09-03: un Instructor podía pedir GET
    /horarios-guardados/ directo (sin pasar por el sidebar) y ver los
    snapshots de TODOS los instructores — esta ruta solo chequeaba
    autenticación, no rol. Es una herramienta de coordinación; el
    Instructor ve su propio horario vigente vía /usuarios/me/horarios."""
    _crear_tablas_extra(db_session)
    _poblar(db_session)
    _, headers = autenticar_como("Instructor")

    respuesta = client.get("/api/v1/horarios-guardados/", headers=headers)

    assert respuesta.status_code == 403
