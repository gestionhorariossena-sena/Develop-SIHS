"""Robustness integration tests; require an explicitly isolated local PG URL.

Set SIHS_ISOLATED_PG_URL to a disposable PostgreSQL database whose socket is
under /tmp, whose name is sihs_phase2_test, and which has Alembic at head.
Never falls back to DATABASE_URL or a project .env file.
"""
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.models.ambiente import Ambiente
from app.models.auditoria import Auditoria
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario, horario_dia
from app.models.jornada import Jornada
from app.models.notificacion import Notificacion
from app.models.programa import Programa
from app.models.publicacion_programada import PublicacionProgramada, PublicacionProgramadaHorario
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services import publicacion_programada_service as service
from app.services.horario_service import HorarioService, PublicacionProgramadaPendienteError

URL_ENV = "SIHS_ISOLATED_PG_URL"
_url_text = os.environ.get(URL_ENV)
pytestmark = pytest.mark.skipif(not _url_text, reason=f"requiere {URL_ENV} con PostgreSQL desechable")
BOGOTA = ZoneInfo("America/Bogota")


@pytest.fixture(scope="module")
def pg_sessions():
    if not _url_text:
        pytest.skip(f"requiere {URL_ENV}")
    url = make_url(_url_text)
    assert url.drivername == "postgresql+psycopg", "solo se admite PostgreSQL con psycopg"
    assert not url.password, "la base aislada debe conectarse por socket local sin password"
    assert url.database == "sihs_phase2_test", "base inesperada: se rechaza cualquier nombre distinto"
    assert url.host in (None, "") and url.query.get("host") == "/tmp", "solo se admite socket dentro de /tmp"
    assert str(url.query.get("port")) == "55439", "puerto del clúster temporal inesperado"
    engine = create_engine(url, connect_args={"prepare_threshold": None}, pool_pre_ping=True)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT current_database()")) == "sihs_phase2_test"
        data_dir = connection.scalar(text("SELECT current_setting('data_directory')"))
        assert data_dir == "/tmp/sihs-pg-phase2-data", "el clúster no coincide con el temporal del test"
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "f7b812a4d091"
    sessions = sessionmaker(engine, expire_on_commit=False)
    yield sessions, engine
    engine.dispose()


def _seed(sessions, bloques=2):
    coordinator_id, instructor_id, learner_id = uuid4(), uuid4(), uuid4()
    with sessions() as db:
        db.execute(text("INSERT INTO auth.users (id) VALUES (:id)"), [{"id": str(x)} for x in (
            coordinator_id, instructor_id, learner_id
        )])
        suffix = uuid4().hex
        coordinacion = Coordinacion(nombreCoordinacion=f"Test {suffix}")
        db.add(coordinacion)
        db.flush()
        programa = Programa(
            codigoPrograma=f"T{suffix[:10]}", nombrePrograma=f"Programa {suffix}",
            nivelFormacion="Tecnólogo", idCoordinacion=coordinacion.idCoordinacion,
        )
        trimestre = Trimestre(
            nombre="P2", fechaInicio=datetime(2026, 1, 1).date(),
            fechaFin=datetime(2026, 3, 31).date(), estado="activo",
        )
        sede = Sede(nombre=f"Sede {suffix}", direccion="local", tipo="principal")
        jornada = Jornada(nombreJornada="Mañana")
        dia = DiaSemana(nombreDia=f"D{suffix[:8]}")
        coordinator = Usuario(idUsuario=coordinator_id, nombre="Coordinator", email=f"c-{suffix}@example.test")
        instructor = Usuario(idUsuario=instructor_id, nombre="Instructor", email=f"i-{suffix}@example.test")
        learner = Usuario(idUsuario=learner_id, nombre="Learner", email=f"l-{suffix}@example.test")
        db.add_all([programa, trimestre, sede, jornada, dia, coordinator, instructor, learner])
        rol_aprendiz = db.query(Rol).filter(Rol.nombre == "Aprendiz").first()
        if rol_aprendiz is None:
            rol_aprendiz = Rol(nombre="Aprendiz")
            db.add(rol_aprendiz)
        db.flush()
        db.add(UsuarioRol(idUsuario=learner_id, idRol=rol_aprendiz.idRol))
        ambiente = Ambiente(
            numero_ambiente=int(suffix[:5], 16) % 99999 + 1, nombre="Ambiente",
            tipo_ambiente="regular", estado_ambiente="disponible", sede_id=sede.id,
        )
        ficha = Ficha(
            codigoFicha=f"F-{suffix}", idPrograma=programa.idPrograma,
            idTrimestre=trimestre.idTrimestre, idSede=sede.id,
        )
        db.add_all([ambiente, ficha])
        db.flush()
        competencia = CompetenciaFormacion(
            codigo=f"C-{suffix}", descripcion="Integración test", idPrograma=programa.idPrograma,
        )
        db.add(competencia)
        db.flush()
        resultados = []
        for index in range(bloques):
            resultado = ResultadoAprendizaje(
                codigo=f"R-{suffix}-{index}", descripcion="Resultado para integración",
                idCompetencia=competencia.idCompetencia,
            )
            db.add(resultado)
            resultados.append(resultado)
        db.add(FichaUsuario(idFicha=ficha.idFicha, idUsuario=learner_id))
        db.flush()
        horarios = []
        for index, resultado in enumerate(resultados):
            horario = Horario(
                horaInicio=datetime.strptime(f"{8 + index:02}:00", "%H:%M").time(),
                horaFin=datetime.strptime(f"{9 + index:02}:00", "%H:%M").time(),
                idJornada=jornada.idJornada, idTrimestre=trimestre.idTrimestre,
                idAmbiente=ambiente.id, idInstructor=instructor_id, idFicha=ficha.idFicha,
                idResultado=resultado.idResultado, activo=True, publicado=False,
            )
            db.add(horario)
            db.flush()
            db.execute(horario_dia.insert().values(idHorario=horario.idHorario, idDia=dia.idDia))
            horarios.append(horario)
        db.commit()
        return {
            "coordinator": coordinator_id, "instructor": instructor_id, "learner": learner_id,
            "trimestre": trimestre.idTrimestre, "dia": dia.idDia,
            "horarios": [h.idHorario for h in horarios],
        }


def _schedule(sessions, seed):
    with sessions() as db:
        coordinator = db.get(Usuario, seed["coordinator"])
        local = (datetime.now(BOGOTA) + timedelta(minutes=10)).replace(tzinfo=None)
        publication = service.programar(
            db, id_trimestre=seed["trimestre"], ids_horarios=seed["horarios"],
            fecha_local=local, responsable=coordinator,
        )
        publication_id = publication.idPublicacion
        publication.fechaEjecucion = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
        return publication_id


def test_dos_workers_compiten_y_solo_confirman_una_publicacion(pg_sessions):
    sessions, _ = pg_sessions
    seed = _seed(sessions)
    publication_id = _schedule(sessions, seed)
    start = threading.Barrier(2)

    def run_worker():
        start.wait(timeout=5)
        with sessions() as db:
            return service.ejecutar(db, publication_id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: run_worker(), range(2)))
    assert sorted(results) == [False, True]
    with sessions() as db:
        assert db.get(PublicacionProgramada, publication_id).estado == "publicada"
        assert all(db.get(Horario, item).publicado for item in seed["horarios"])
        assert db.scalar(select(Auditoria.idAuditoria).where(
            Auditoria.entidad == "publicaciones_programadas",
            Auditoria.idEntidad == str(publication_id),
            Auditoria.accion == "PUBLICACION_PROGRAMADA_EXITOSA",
        ).limit(2).order_by(Auditoria.idAuditoria.desc()).offset(1)) is None
        avisos = db.execute(select(Notificacion).where(
            Notificacion.idUsuario.in_([seed["coordinator"], seed["instructor"], seed["learner"]]),
            Notificacion.entidadRelacionada.in_(["publicaciones_programadas", "fichas"]),
        )).scalars().all()
        assert len(avisos) == 3  # coordinación, instructor y aprendiz: un aviso cada uno


def test_reintento_tras_caida_antes_del_commit_reintenta_sin_parcialidades(pg_sessions, monkeypatch):
    sessions, _ = pg_sessions
    seed = _seed(sessions)
    publication_id = _schedule(sessions, seed)
    db = sessions()
    monkeypatch.setattr(db, "commit", lambda: (_ for _ in ()).throw(SystemExit("simulated process death")))
    with pytest.raises(SystemExit, match="simulated process death"):
        service.ejecutar(db, publication_id)
    db.close()  # desconectar el backend revierte la transacción abierta
    with sessions() as verify:
        assert verify.get(PublicacionProgramada, publication_id).estado == "pendiente"
        assert not any(verify.get(Horario, item).publicado for item in seed["horarios"])
        assert not verify.execute(select(Notificacion).where(
            Notificacion.idUsuario.in_([seed["coordinator"], seed["instructor"], seed["learner"]]),
        )).scalars().all()
    with sessions() as retry:
        assert service.ejecutar(retry, publication_id) is True


def test_reintento_tras_commit_con_respuesta_perdida_no_duplica_efectos(pg_sessions):
    sessions, _ = pg_sessions
    seed = _seed(sessions)
    publication_id = _schedule(sessions, seed)

    def worker_loses_ack():
        with sessions() as db:
            assert service.ejecutar(db, publication_id) is True
        raise SystemExit("simulated lost acknowledgement after commit")

    with pytest.raises(SystemExit, match="lost acknowledgement"):
        worker_loses_ack()
    with sessions() as retry:
        assert service.ejecutar(retry, publication_id) is False
    with sessions() as verify:
        assert verify.get(PublicacionProgramada, publication_id).estado == "publicada"
        assert len(verify.execute(select(Notificacion).where(
            Notificacion.idUsuario.in_([seed["coordinator"], seed["instructor"], seed["learner"]]),
        )).scalars().all()) == 3


@pytest.mark.parametrize("accion", ["cancelar", "reprogramar"])
def test_cancelacion_y_reprogramacion_esperan_a_worker_y_respetan_estado_final(
    pg_sessions, monkeypatch, accion
):
    sessions, engine = pg_sessions
    seed = _seed(sessions)
    publication_id = _schedule(sessions, seed)
    worker_entro_validacion = threading.Event()
    liberar_worker = threading.Event()
    accion_intenta_lock = threading.Event()
    original_validar = service._validar_conjunto

    def pausa_con_lock(db, horarios):
        worker_entro_validacion.set()
        assert liberar_worker.wait(timeout=10)
        return original_validar(db, horarios)

    monkeypatch.setattr(service, "_validar_conjunto", pausa_con_lock)

    def observar_sql(conn, cursor, statement, parameters, context, executemany):
        if threading.current_thread().name == "action-lock" and "FOR UPDATE" in statement.upper() and "PUBLICACIONES_PROGRAMADAS" in statement.upper():
            accion_intenta_lock.set()

    event.listen(engine, "before_cursor_execute", observar_sql)

    def run_worker():
        threading.current_thread().name = "publication-worker"
        with sessions() as db:
            return service.ejecutar(db, publication_id)

    def run_action():
        threading.current_thread().name = "action-lock"
        with sessions() as db:
            row = db.get(PublicacionProgramada, publication_id)
            if accion == "cancelar":
                return service.cancelar(db, row, db.get(Usuario, seed["coordinator"]))
            fecha = (datetime.now(BOGOTA) + timedelta(hours=1)).replace(tzinfo=None)
            return service.reprogramar(
                db, row, id_trimestre=seed["trimestre"], ids_horarios=seed["horarios"],
                fecha_local=fecha, responsable=db.get(Usuario, seed["coordinator"]),
            )

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            worker = pool.submit(run_worker)
            assert worker_entro_validacion.wait(timeout=10)
            action = pool.submit(run_action)
            assert accion_intenta_lock.wait(timeout=10)
            liberar_worker.set()
            assert worker.result(timeout=10) is True
            with pytest.raises(service.PublicacionProgramadaError, match="Solo se pueden"):
                action.result(timeout=10)
    finally:
        liberar_worker.set()
        event.remove(engine, "before_cursor_execute", observar_sql)
    with sessions() as db:
        assert db.get(PublicacionProgramada, publication_id).estado == "publicada"


def test_edicion_despues_de_aprobar_invalida_y_no_publica_version_antigua(pg_sessions):
    sessions, _ = pg_sessions
    seed = _seed(sessions, bloques=1)
    publication_id = _schedule(sessions, seed)
    with sessions() as db:
        horario = db.get(Horario, seed["horarios"][0])
        data = type("HorarioEdit", (), {
            "horaInicio": datetime.strptime("07:00", "%H:%M").time(),
            "horaFin": datetime.strptime("08:00", "%H:%M").time(),
            "idJornada": horario.idJornada, "idTrimestre": horario.idTrimestre,
            "idAmbiente": horario.idAmbiente, "idInstructor": horario.idInstructor,
            "idFicha": horario.idFicha, "idResultado": horario.idResultado,
            "dias": [seed["dia"]],
        })()
        HorarioService.actualizar(db, horario.idHorario, data)
    with sessions() as db:
        assert db.get(PublicacionProgramada, publication_id).estado == "revision_requerida"
        with pytest.raises(PublicacionProgramadaPendienteError):
            HorarioService.cambiar_estado(db, seed["horarios"][0], publicado=True)
        assert service.ejecutar(db, publication_id) is False
        assert db.get(Horario, seed["horarios"][0]).publicado is False


def test_delete_activo_requiere_cancelar_y_delete_historico_conserva_referencia(pg_sessions):
    sessions, _ = pg_sessions
    seed = _seed(sessions, bloques=1)
    publication_id = _schedule(sessions, seed)
    schedule_id = seed["horarios"][0]
    with sessions() as db:
        with pytest.raises(PublicacionProgramadaPendienteError, match="Cancela o reprograma"):
            HorarioService.eliminar(db, schedule_id)
        db.rollback()
    with sessions() as db:
        publication = db.get(PublicacionProgramada, publication_id)
        service.cancelar(db, publication, db.get(Usuario, seed["coordinator"]))
    with sessions() as db:
        assert HorarioService.eliminar(db, schedule_id) is True
    with sessions() as db:
        relation = db.execute(select(PublicacionProgramadaHorario).where(
            PublicacionProgramadaHorario.idPublicacion == publication_id,
            PublicacionProgramadaHorario.revision == 1,
        )).scalar_one()
        assert relation.idHorario is None
        assert relation.idHorarioReferencia == schedule_id
        assert service.ids_de_horarios(db, publication_id) == [schedule_id]
