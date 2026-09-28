"""Expectativas para aislar validaciones manuales por período académico.

Estas pruebas documentan el comportamiento acordado, pero se marcan xfail
mientras HorarioRepository y HorarioService todavía comparan todos los
horarios activos sin limitar por idTrimestre. Al implementar la corrección,
quitar los marcadores xfail: deben pasar sin cambiar sus aserciones.
"""

import uuid
from datetime import date, time

import pytest

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


def _crear_tablas(db_session):
    from app.core.database import Base

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Coordinacion.__table__, Programa.__table__, Trimestre.__table__,
            Sede.__table__, Ambiente.__table__, Jornada.__table__,
            DiaSemana.__table__, Ficha.__table__, ResultadoAprendizaje.__table__,
            Usuario.__table__, Horario.__table__, horario_dia,
        ],
    )


def _preparar_dos_trimestres(db_session, *, tipo_contrato=None):
    _crear_tablas(db_session)
    db_session.add_all([
        Coordinacion(idCoordinacion=1, nombreCoordinacion="Coordinación de prueba"),
        Programa(
            idPrograma=1, codigoPrograma="PRUEBA-01", nombrePrograma="Programa de prueba",
            nivelFormacion="Técnico", activo=True, idCoordinacion=1,
        ),
        Trimestre(
            idTrimestre=1, nombre="Periodo A", fechaInicio=date(2026, 1, 1),
            fechaFin=date(2026, 3, 31), estado="finalizado",
        ),
        Trimestre(
            idTrimestre=2, nombre="Periodo B", fechaInicio=date(2026, 4, 1),
            fechaFin=date(2026, 6, 30), estado="activo",
        ),
        Sede(id=1, nombre="Sede de prueba", direccion="Dirección de prueba", tipo="principal"),
        Ambiente(
            id=1, numero_ambiente=101, nombre="Ambiente de prueba", tipo_ambiente="regular",
            estado_ambiente="disponible", sede_id=1,
        ),
        Jornada(idJornada=1, nombreJornada="Mañana"),
        DiaSemana(idDia=1, nombreDia="Lunes"),
        DiaSemana(idDia=2, nombreDia="Martes"),
        DiaSemana(idDia=3, nombreDia="Miércoles"),
        DiaSemana(idDia=4, nombreDia="Jueves"),
        ResultadoAprendizaje(
            idResultado=1, descripcion="Resultado de prueba", codigo="RA-PRUEBA",
            idCompetencia=1, horasAsignadas=10,
        ),
        Ficha(idFicha=1, codigoFicha="FICHA-PER-A", idPrograma=1, idTrimestre=1),
        Ficha(idFicha=2, codigoFicha="FICHA-PER-B", idPrograma=1, idTrimestre=2),
    ])
    instructor = Usuario(
        idUsuario=uuid.uuid4(), nombre="Instructor de prueba", email="instructor-periodo@example.test",
        tipoContrato=tipo_contrato,
    )
    db_session.add(instructor)
    db_session.commit()
    return instructor


def _guardar_horario(db_session, *, id_horario, id_trimestre, id_ficha, instructor, inicio, fin, dias):
    horario = Horario(
        idHorario=id_horario, horaInicio=inicio, horaFin=fin, idJornada=1,
        idTrimestre=id_trimestre, idAmbiente=1, idInstructor=instructor.idUsuario,
        idFicha=id_ficha, idResultado=1,
    )
    db_session.add(horario)
    db_session.commit()
    for dia in dias:
        db_session.execute(horario_dia.insert().values(idHorario=id_horario, idDia=dia))
    db_session.commit()


def _payload_periodo_b(instructor):
    return {
        "idJornada": 1, "idTrimestre": 2, "idAmbiente": 1,
        "idInstructor": str(instructor.idUsuario), "idFicha": 2, "idResultado": 1,
        "horaInicio": "08:00:00", "horaFin": "10:00:00", "dias": [1],
        "excluirIdHorario": None,
    }


@pytest.mark.xfail(strict=True, reason="Pendiente: buscar_solape y resultado repetido deben filtrar por idTrimestre")
def test_validacion_manual_permite_mismo_recurso_y_resultado_en_otro_periodo(client, db_session, autenticar_como):
    instructor = _preparar_dos_trimestres(db_session)
    _guardar_horario(
        db_session, id_horario=1, id_trimestre=1, id_ficha=1, instructor=instructor,
        inicio=time(8, 0), fin=time(10, 0), dias=[1],
    )
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post("/api/v1/horarios/validar", json=_payload_periodo_b(instructor), headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["puedeGuardar"] is True


@pytest.mark.xfail(strict=True, reason="Pendiente: RF-011 debe calcular horas solo para idTrimestre")
def test_tope_semanal_no_acumula_horas_de_otro_periodo(client, db_session, autenticar_como):
    instructor = _preparar_dos_trimestres(db_session, tipo_contrato="planta")
    _guardar_horario(
        db_session, id_horario=1, id_trimestre=1, id_ficha=1, instructor=instructor,
        inicio=time(8, 0), fin=time(16, 0), dias=[1, 2, 3, 4],
    )
    _, headers = autenticar_como("Coordinador")

    respuesta = client.post("/api/v1/horarios/validar", json=_payload_periodo_b(instructor), headers=headers)

    assert respuesta.status_code == 200
    assert respuesta.json()["puedeGuardar"] is True
