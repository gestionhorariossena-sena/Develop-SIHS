"""Corrección de la lista de chequeo del V Trimestre (hoja GRUPO 1,
2026-09-04): "el instructor no se puede asignar a cualquier RA, se deben
revisar sus fortalezas para dicha asignación".

Lo que se verifica acá es tanto que la validación AVISE cuando el
instructor no tiene la fortaleza, como —igual de importante— que no diga
nada mientras coordinación no haya clasificado la competencia: la tabla
`especialidad_competencia` nace vacía y programar tiene que seguir
funcionando exactamente igual que antes hasta que alguien la llene.
"""

import uuid
from datetime import date, time

from app.models.ambiente import Ambiente
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.especialidad import Especialidad
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


def _sembrar(db_session):
    """Catálogo mínimo: un programa con una competencia ("Bases de datos")
    y un resultado suyo, dos especialidades, y un instructor sin ninguna."""
    db_session.add_all([
        Coordinacion(idCoordinacion=1, nombreCoordinacion="Teleinformática"),
        Programa(
            idPrograma=1, codigoPrograma="ADSO-01", nombrePrograma="ADSO",
            nivelFormacion="Tecnólogo", activo=True, idCoordinacion=1,
        ),
        Trimestre(
            idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5),
            fechaFin=date(2026, 4, 30), estado="activo",
        ),
        Sede(id=1, nombre="Sede Norte", direccion="Calle 1", tipo="principal"),
        Ambiente(
            id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular",
            estado_ambiente="disponible", sede_id=1,
        ),
        Jornada(idJornada=1, nombreJornada="Mañana"),
        DiaSemana(idDia=1, nombreDia="Lunes"),
        CompetenciaFormacion(
            idCompetencia=1, codigo="220501046", descripcion="Gestionar bases de datos",
            idPrograma=1,
        ),
        ResultadoAprendizaje(
            idResultado=9, codigo="RA-9", descripcion="Modelar el esquema",
            idCompetencia=1, horasAsignadas=60, numeroFase=2,
        ),
        Especialidad(idEspecialidad=1, nombre="Bases de datos", activo=True),
        Especialidad(idEspecialidad=2, nombre="Redes", activo=True),
        Ficha(idFicha=1, codigoFicha="2831190", idPrograma=1, idTrimestre=1),
    ])
    instructor = Usuario(
        idUsuario=uuid.uuid4(), nombre="Carlos López",
        email="carlos@example.com", tipoContrato="planta",
    )
    db_session.add(instructor)
    db_session.commit()
    return instructor


def _payload(instructor):
    return {
        "idJornada": 1,
        "idTrimestre": 1,
        "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario),
        "idFicha": 1,
        "idResultado": 9,
        "horaInicio": "08:00:00",
        "horaFin": "10:00:00",
        "dias": [1],
    }


def test_sin_clasificar_la_competencia_no_dice_nada(client, db_session, autenticar_como):
    """El caso de hoy: nadie mapeó especialidades todavía. Programar tiene
    que seguir siendo exactamente igual que antes de la corrección."""
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _sembrar(db_session)

    respuesta = client.post(
        "/api/v1/horarios/validar",
        json={**_payload(instructor), "excluirIdHorario": None},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["puedeGuardar"] is True


def test_avisa_cuando_el_instructor_no_tiene_la_fortaleza(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _sembrar(db_session)

    competencia = db_session.get(CompetenciaFormacion, 1)
    competencia.especialidades = [db_session.get(Especialidad, 1)]  # Bases de datos
    instructor.especialidades = [db_session.get(Especialidad, 2)]  # solo Redes
    db_session.commit()

    respuesta = client.post(
        "/api/v1/horarios/validar",
        json={**_payload(instructor), "excluirIdHorario": None},
        headers=headers,
    )

    assert respuesta.status_code == 409
    conflictos = respuesta.json()["conflictos"]
    fortaleza = [c for c in conflictos if c["tipo"] == "fortaleza_instructor"]
    assert len(fortaleza) == 1
    assert "Bases de datos" in fortaleza[0]["mensaje"]
    assert "RA-9" in fortaleza[0]["mensaje"]


def test_no_avisa_cuando_el_instructor_si_tiene_la_fortaleza(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _sembrar(db_session)

    competencia = db_session.get(CompetenciaFormacion, 1)
    especialidad_bd = db_session.get(Especialidad, 1)
    competencia.especialidades = [especialidad_bd]
    instructor.especialidades = [especialidad_bd, db_session.get(Especialidad, 2)]
    db_session.commit()

    respuesta = client.post(
        "/api/v1/horarios/validar",
        json={**_payload(instructor), "excluirIdHorario": None},
        headers=headers,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["puedeGuardar"] is True


def test_es_un_aviso_forzable_no_un_bloqueo(client, db_session, autenticar_como):
    """Igual que RF-011: sin `forzar` no guarda, con `forzar` sí — la
    fortaleza es criterio de gestión, no un imposible físico."""
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")
    instructor = _sembrar(db_session)

    competencia = db_session.get(CompetenciaFormacion, 1)
    competencia.especialidades = [db_session.get(Especialidad, 1)]
    instructor.especialidades = [db_session.get(Especialidad, 2)]
    db_session.commit()

    sin_forzar = client.post("/api/v1/horarios/", json=_payload(instructor), headers=headers)
    assert sin_forzar.status_code == 409

    forzado = client.post(
        "/api/v1/horarios/", json={**_payload(instructor), "forzar": True}, headers=headers
    )
    assert forzado.status_code == 201
