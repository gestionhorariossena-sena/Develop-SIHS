"""Corrección 2026-09-12: RF-011 tenía una tercera regla ("no repetir
centro de formación en jornadas continuas del mismo día") que
contradecía directamente un hallazgo real de entrevista -- un
instructor programado el martes en la mañana en Zona Franca y el
martes en la tarde en Fontibón, mismo día, dos sedes, jornadas
adyacentes (ver REGLAS_DE_NEGOCIO_CONOCIDAS.md). Se quitó la regla; este
test reproduce exactamente ese caso real y confirma que ya no bloquea."""

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
        Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
        Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__,
        ResultadoAprendizaje.__table__, Horario.__table__, horario_dia, Usuario.__table__,
    ]
    Base.metadata.create_all(bind=db_session.bind, tables=tablas)


def test_instructor_manana_una_sede_tarde_otra_sede_mismo_dia_ya_no_choca(db_session, client, autenticar_como):
    _crear_tablas_extra(db_session)
    coordinacion = Coordinacion(idCoordinacion=1, nombreCoordinacion="Logística")
    programa = Programa(idPrograma=1, codigoPrograma="LOG-01", nombrePrograma="Logística", activo=True, idCoordinacion=1)
    trimestre = Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo")
    sede_zona_franca = Sede(id=1, nombre="Zona Franca", direccion="Km 1", tipo="alterna")
    sede_fontibon = Sede(id=2, nombre="Fontibón", direccion="Cra 2", tipo="principal")
    ambiente_zf = Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1)
    ambiente_fontibon = Ambiente(id=2, numero_ambiente=102, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=2)
    jornada_manana = Jornada(idJornada=1, nombreJornada="Mañana")
    jornada_tarde = Jornada(idJornada=2, nombreJornada="Tarde")
    dia_martes = DiaSemana(idDia=2, nombreDia="Martes")
    resultado_1 = ResultadoAprendizaje(idResultado=1, descripcion="Resultado 1", codigo="RA-1", idCompetencia=1)
    resultado_2 = ResultadoAprendizaje(idResultado=2, descripcion="Resultado 2", codigo="RA-2", idCompetencia=1)
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Instructor Logística", email="log@example.com", tipoContrato="contratista")
    ficha = Ficha(idFicha=1, codigoFicha="FICHA-001", idPrograma=1, idTrimestre=1)

    db_session.add_all([
        coordinacion, programa, trimestre, sede_zona_franca, sede_fontibon,
        ambiente_zf, ambiente_fontibon, jornada_manana, jornada_tarde, dia_martes,
        resultado_1, resultado_2, instructor, ficha,
    ])
    db_session.commit()

    _, headers = autenticar_como("Coordinador")

    # Martes en la mañana, Zona Franca.
    payload_manana = {
        "idJornada": jornada_manana.idJornada, "idTrimestre": 1, "idAmbiente": ambiente_zf.id,
        "idInstructor": str(instructor.idUsuario), "idFicha": ficha.idFicha, "idResultado": resultado_1.idResultado,
        "horaInicio": "07:00:00", "horaFin": "09:00:00", "dias": [dia_martes.idDia],
    }
    respuesta_manana = client.post("/api/v1/horarios/", json=payload_manana, headers=headers)
    assert respuesta_manana.status_code == 201

    # Mismo martes, en la tarde, en OTRA sede -- caso real de la entrevista.
    payload_tarde = {
        "idJornada": jornada_tarde.idJornada, "idTrimestre": 1, "idAmbiente": ambiente_fontibon.id,
        "idInstructor": str(instructor.idUsuario), "idFicha": ficha.idFicha, "idResultado": resultado_2.idResultado,
        "horaInicio": "13:00:00", "horaFin": "15:00:00", "dias": [dia_martes.idDia],
    }
    respuesta_tarde = client.post("/api/v1/horarios/", json=payload_tarde, headers=headers)

    assert respuesta_tarde.status_code == 201
    assert db_session.query(Horario).count() == 2
