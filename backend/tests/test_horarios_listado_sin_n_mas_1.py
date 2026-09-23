"""Regresión: GET /horarios/ construía la respuesta de cada horario
llamando a HorarioRepository.obtener_dias(db, id) + accediendo a
horario.instructor/.ficha/.ambiente/.resultado (lazy-load) UNO POR UNO --
con el catálogo real (130+ horarios) eso tardaba 47s medido en vivo el
2026-09-14 contra Supabase, dejando "Horarios completos" con timeout
permanente en el frontend (el mensaje "La respuesta del servidor tardó
demasiado" no mentía: de verdad tardaba). El fix (selectinload +
obtener_dias_por_horarios en bloque) baja el costo de O(horarios) queries
a O(1) sin importar cuántos horarios haya -- este test lo prueba contando
las queries SQL reales ejecutadas, no solo verificando que la respuesta
sea correcta (eso ya lo cubren otros tests de horarios)."""

import uuid
from datetime import date, time

from sqlalchemy import event

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

    Base.metadata.create_all(
        bind=db_session.bind,
        tables=[
            Coordinacion.__table__, Programa.__table__, Trimestre.__table__, Sede.__table__,
            Ambiente.__table__, Jornada.__table__, DiaSemana.__table__, Ficha.__table__,
            ResultadoAprendizaje.__table__, Horario.__table__, horario_dia, Usuario.__table__,
        ],
    )


class _ContadorQueries:
    def __init__(self, engine):
        self.total = 0
        self._engine = engine

    def __enter__(self):
        event.listen(self._engine, "before_cursor_execute", self._contar)
        return self

    def __exit__(self, *exc_info):
        event.remove(self._engine, "before_cursor_execute", self._contar)

    def _contar(self, conn, cursor, statement, parameters, context, executemany):
        self.total += 1


def test_listar_horarios_no_hace_una_query_por_horario(client, db_session, autenticar_como):
    _crear_tablas_extra(db_session)
    _, headers = autenticar_como("Coordinador")

    db_session.add(Coordinacion(idCoordinacion=1, nombreCoordinacion="Demo"))
    db_session.add(Programa(idPrograma=1, codigoPrograma="P1", nombrePrograma="ADSO", activo=True, idCoordinacion=1))
    db_session.add(Trimestre(idTrimestre=1, nombre="2026-1", fechaInicio=date(2026, 1, 5), fechaFin=date(2026, 4, 30), estado="activo"))
    db_session.add(Sede(id=1, nombre="Sede Demo", direccion="Calle 1", tipo="principal"))
    db_session.add(Ambiente(id=1, numero_ambiente=101, nombre="Ambiente", tipo_ambiente="regular", estado_ambiente="disponible", sede_id=1))
    db_session.add(Jornada(idJornada=1, nombreJornada="Mañana"))
    db_session.add(DiaSemana(idDia=1, nombreDia="Lunes"))
    db_session.add(ResultadoAprendizaje(idResultado=1, descripcion="Resultado", codigo="RA-1", idCompetencia=1, horasAsignadas=10))
    instructor = Usuario(idUsuario=uuid.uuid4(), nombre="Ana", email="ana@demo.sihs", tipoContrato="planta")
    db_session.add(instructor)
    db_session.commit()

    # 20 fichas, cada una con su propio horario -- suficiente para que un
    # N+1 real (1 query por horario) sea muchísimo más que las ~4-5
    # queries que el fix necesita sin importar cuántos horarios haya.
    for i in range(20):
        db_session.add(Ficha(idFicha=i + 1, codigoFicha=f"F{i}", idPrograma=1, idTrimestre=1, idSede=1))
    db_session.commit()

    for i in range(20):
        horario = Horario(
            horaInicio=time(7, 0), horaFin=time(9, 0), idJornada=1, idTrimestre=1,
            idAmbiente=1, idInstructor=instructor.idUsuario, idFicha=i + 1, idResultado=1,
        )
        db_session.add(horario)
        db_session.flush()
        db_session.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=1))
    db_session.commit()

    with _ContadorQueries(db_session.bind) as contador:
        respuesta = client.get("/api/v1/horarios/", headers=headers)

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 20
    # El número exacto no importa tanto como el ORDEN DE MAGNITUD: debe
    # ser una constante chica (query base + selectinload×4 + bulk-days),
    # no escalar con la cantidad de horarios -- 20 horarios con un N+1
    # real habrían disparado 100+ queries (5 por horario).
    assert contador.total < 15, (
        f"{contador.total} queries para 20 horarios -- sugiere que volvió el problema N+1 "
        "(HorarioRepository.obtener_todos/obtener_dias_por_horarios)"
    )
