"""Integration tests against the disposable PostgreSQL defined beside this file.

Only SIHS_TEST_DATABASE_URL is read. The exact local connection coordinates
are checked before the test suite can create or drop any tables.
"""

import os
import uuid
from datetime import date, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.ambiente import Ambiente
from app.models.competencia_formacion import CompetenciaFormacion
from app.models.coordinacion import Coordinacion
from app.models.dia_semana import DiaSemana
from app.models.especialidad import especialidad_competencia, usuario_especialidad
from app.models.ficha import Ficha
from app.models.horario import Horario, horario_dia
from app.models.horario_guardado import HorarioGuardado
from app.models.jornada import Jornada
from app.models.programa import Programa
from app.models.resultado_aprendizaje import ResultadoAprendizaje
from app.models.rol import Rol
from app.models.sede import Sede
from app.models.trimestre import Trimestre
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.repositories.horario_guardado_repository import HorarioGuardadoRepository

DATABASE_URL_ENV = "SIHS_TEST_DATABASE_URL"
EXPECTED_DATABASE_URL = "postgresql+psycopg://sihs_test:sihs_test_only@127.0.0.1:55440/sihs_test"


@pytest.fixture(scope="module")
def pg_sessions():
    database_url = os.environ.get(DATABASE_URL_ENV)
    if not database_url:
        pytest.skip(f"arranca backend/tests/docker-compose.postgres.yml y define {DATABASE_URL_ENV}")

    parsed_url = make_url(database_url)
    expected_url = make_url(EXPECTED_DATABASE_URL)
    assert parsed_url.drivername == expected_url.drivername, "solo se admite PostgreSQL mediante psycopg"
    assert parsed_url.username == expected_url.username and parsed_url.password == expected_url.password, (
        "la suite solo admite las credenciales locales desechables de docker-compose.postgres.yml"
    )
    assert parsed_url.host == expected_url.host and parsed_url.port == expected_url.port, (
        "la suite solo admite la instancia local del puerto 55440"
    )
    assert parsed_url.database == expected_url.database, "se rechaza cualquier base distinta de sihs_test"

    engine = create_engine(
        database_url,
        connect_args={"client_encoding": "utf8", "prepare_threshold": None},
        pool_pre_ping=True,
    )
    sessions = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

    with engine.connect() as connection:
        assert connection.dialect.name == "postgresql"
        assert connection.scalar(text("SELECT current_database()")) == "sihs_test"

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text(
            "DO $$ BEGIN CREATE TYPE tipo_sede AS ENUM "
            "('principal', 'secundaria', 'alterna'); "
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
        ))
        connection.execute(text(
            "DO $$ BEGIN CREATE TYPE estado_trimestre AS ENUM "
            "('planeado', 'activo', 'finalizado'); "
            "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
        ))
    Base.metadata.create_all(bind=engine)
    try:
        yield sessions
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def pg_client(pg_sessions):
    def override_get_db():
        with pg_sessions() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_repositorio_horario_guardado_persiste_jsonb_y_relacion_usuario(pg_sessions):
    user_id = uuid.uuid4()
    snapshot_id: int
    with pg_sessions() as session:
        usuario = Usuario(
            idUsuario=user_id,
            nombre="Instructor PostgreSQL",
            email=f"{user_id}@example.test",
        )
        session.add(usuario)
        session.flush()
        snapshot = HorarioGuardado(
            idUsuario=user_id,
            ficha="FICHA-PG-E2E",
            bloques=[{"id": "bloque-pg", "tematica": "Persistencia PostgreSQL"}],
            grid=[["bloque-pg", None]],
            idsHorarios=[712],
        )
        creado = HorarioGuardadoRepository.crear(session, snapshot)
        snapshot_id = creado.idHorarioGuardado

    with pg_sessions() as session:
        recuperado = HorarioGuardadoRepository.obtener_por_id(session, snapshot_id)

    assert recuperado is not None
    assert recuperado.ficha == "FICHA-PG-E2E"
    assert recuperado.bloques == [{"id": "bloque-pg", "tematica": "Persistencia PostgreSQL"}]
    assert recuperado.grid == [["bloque-pg", None]]
    assert recuperado.idsHorarios == [712]
    assert recuperado.usuario.email == f"{user_id}@example.test"


def test_endpoint_publica_horario_y_solo_el_instructor_destino_lo_ve(
    pg_sessions, pg_client, fake_supabase
):
    coordinador_id = uuid.uuid4()
    instructor_id = uuid.uuid4()
    token_coordinador = f"pg-coordinator-{uuid.uuid4()}"
    token_instructor = f"pg-instructor-{uuid.uuid4()}"
    hoy = date.today()

    with pg_sessions() as session:
        coordinacion = Coordinacion(nombreCoordinacion=f"Coordinación {uuid.uuid4().hex[:8]}")
        session.add(coordinacion)
        session.flush()
        programa = Programa(
            codigoPrograma=f"PG-{uuid.uuid4().hex[:8]}",
            nombrePrograma="Programa PostgreSQL",
            nivelFormacion="Técnico",
            activo=True,
            idCoordinacion=coordinacion.idCoordinacion,
        )
        trimestre = Trimestre(
            nombre="Trimestre PostgreSQL",
            fechaInicio=hoy - timedelta(days=30),
            fechaFin=hoy + timedelta(days=90),
            estado="activo",
        )
        sede = Sede(nombre="Sede PostgreSQL", direccion="Local", tipo="principal")
        jornada = Jornada(nombreJornada="Mañana")
        dia = DiaSemana(nombreDia="Lunes")
        coordinador = Usuario(
            idUsuario=coordinador_id,
            nombre="Coordinador PostgreSQL",
            email=f"{coordinador_id}@example.test",
        )
        instructor = Usuario(
            idUsuario=instructor_id,
            nombre="Instructor PostgreSQL",
            email=f"{instructor_id}@example.test",
        )
        session.add_all([programa, trimestre, sede, jornada, dia, coordinador, instructor])
        session.flush()

        rol_coordinador = Rol(nombre="Coordinador")
        rol_instructor = Rol(nombre="Instructor")
        session.add_all([rol_coordinador, rol_instructor])
        session.flush()
        session.add_all([
            UsuarioRol(idUsuario=coordinador_id, idRol=rol_coordinador.idRol),
            UsuarioRol(idUsuario=instructor_id, idRol=rol_instructor.idRol),
        ])

        ambiente = Ambiente(
            numero_ambiente=uuid.uuid4().int % 90000 + 10000,
            nombre="Ambiente",
            tipo_ambiente="regular",
            estado_ambiente="disponible",
            sede_id=sede.id,
        )
        ficha = Ficha(
            codigoFicha=f"PG-{uuid.uuid4().hex[:10]}",
            idPrograma=programa.idPrograma,
            idTrimestre=trimestre.idTrimestre,
            idSede=sede.id,
        )
        session.add_all([ambiente, ficha])
        session.flush()

        competencia = CompetenciaFormacion(
            codigo=f"COMP-{uuid.uuid4().hex[:8]}",
            descripcion="Competencia PostgreSQL",
            idPrograma=programa.idPrograma,
        )
        session.add(competencia)
        session.flush()
        resultado = ResultadoAprendizaje(
            codigo=f"RA-{uuid.uuid4().hex[:8]}",
            descripcion="Resultado visible después de publicar",
            idCompetencia=competencia.idCompetencia,
        )
        session.add(resultado)
        session.flush()
        horario = Horario(
            horaInicio=time(8, 0),
            horaFin=time(10, 0),
            idJornada=jornada.idJornada,
            idTrimestre=trimestre.idTrimestre,
            idAmbiente=ambiente.id,
            idInstructor=instructor_id,
            idFicha=ficha.idFicha,
            idResultado=resultado.idResultado,
            activo=True,
            publicado=False,
        )
        session.add(horario)
        session.flush()
        session.execute(
            horario_dia.insert().values(idHorario=horario.idHorario, idDia=dia.idDia)
        )
        horario_id = horario.idHorario
        session.commit()

    fake_supabase(token_coordinador, id=str(coordinador_id), email=f"{coordinador_id}@example.test")
    fake_supabase(token_instructor, id=str(instructor_id), email=f"{instructor_id}@example.test")

    instructor_headers = {"Authorization": f"Bearer {token_instructor}"}
    coordinator_headers = {"Authorization": f"Bearer {token_coordinador}"}

    assert pg_client.get("/api/v1/usuarios/me/horarios", headers=instructor_headers).json() == []
    forbidden = pg_client.patch(
        f"/api/v1/horarios/{horario_id}/estado",
        json={"publicado": True},
        headers=instructor_headers,
    )
    assert forbidden.status_code == 403

    publicado = pg_client.patch(
        f"/api/v1/horarios/{horario_id}/estado",
        json={"publicado": True},
        headers=coordinator_headers,
    )
    assert publicado.status_code == 200
    assert publicado.json()["publicado"] is True

    visible = pg_client.get("/api/v1/usuarios/me/horarios", headers=instructor_headers)
    assert visible.status_code == 200
    assert [item["idHorario"] for item in visible.json()] == [horario_id]
    assert visible.json()[0]["resultadoDescripcion"] == "Resultado visible después de publicar"
