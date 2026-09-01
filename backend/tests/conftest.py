import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, types
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.dialects.sqlite import dialect as SQLiteDialect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.auditoria import Auditoria
from app.models.ficha import Ficha
from app.models.ficha_usuario import FichaUsuario
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


class _UUIDComoTextoParaSQLite(types.TypeDecorator):
    """Los modelos usan postgresql.UUID(as_uuid=True), que en Postgres real
    acepta tanto uuid.UUID como str (Postgres hace el cast). El tipo
    genérico de SQLAlchemy que emula UUID sobre SQLite es más estricto y
    solo acepta uuid.UUID — pero Supabase Auth siempre entrega el id como
    string (viene de un JSON). Este shim solo aplica al dialecto SQLite de
    los tests, nunca a producción."""

    impl = types.CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(value)


SQLiteDialect.colspecs = {**SQLiteDialect.colspecs, PostgresUUID: _UUIDComoTextoParaSQLite}


@pytest.fixture()
def db_session():
    """Base de datos SQLite en memoria, una por test — nunca toca Supabase."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Solo las tablas que los tests necesitan: crear TODO Base.metadata
    # falla en SQLite porque otros módulos (ej. horarios_guardados) usan
    # tipos específicos de Postgres (JSONB) que SQLite no sabe compilar.
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Usuario.__table__,
            Rol.__table__,
            UsuarioRol.__table__,
            Auditoria.__table__,
            Ficha.__table__,
            FichaUsuario.__table__,
        ],
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def fake_supabase(monkeypatch):
    """Simula GET {supabase_url}/auth/v1/user sin pegarle a Supabase real.

    Uso: fake_supabase(token, id="<uuid>", email="x@mail.com") registra qué
    debe responder Supabase para ese token; cualquier otro token no
    registrado se comporta como un token inválido/expirado (401).
    """
    usuarios_por_token: dict[str, dict] = {}

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload

        def json(self) -> dict:
            return self._payload

    def fake_get(url, headers=None, timeout=None):
        token = (headers or {}).get("Authorization", "").removeprefix("Bearer ")
        datos = usuarios_por_token.get(token)

        if datos is None:
            return FakeResponse(401, {"error": "invalid_token"})

        return FakeResponse(200, datos)

    monkeypatch.setattr("app.core.supabase_auth.httpx.get", fake_get)

    def registrar(token: str, *, id: str, email: str) -> None:
        usuarios_por_token[token] = {"id": id, "email": email}

    return registrar


@pytest.fixture()
def crear_rol(db_session):
    def _crear(nombre: str = "Administrador") -> Rol:
        existente = db_session.query(Rol).filter(Rol.nombre == nombre).first()

        if existente:
            return existente

        rol = Rol(nombre=nombre)
        db_session.add(rol)
        db_session.commit()
        db_session.refresh(rol)
        return rol

    return _crear


@pytest.fixture()
def crear_usuario(db_session):
    def _crear(*, nombre: str = "Ana", email: str | None = None, roles: list[Rol] | None = None) -> Usuario:
        usuario = Usuario(
            idUsuario=uuid.uuid4(),
            nombre=nombre,
            email=email or f"{nombre.lower()}-{uuid.uuid4().hex[:8]}@example.com",
        )
        db_session.add(usuario)
        db_session.commit()

        for rol in roles or []:
            db_session.add(UsuarioRol(idUsuario=usuario.idUsuario, idRol=rol.idRol))

        db_session.commit()
        db_session.refresh(usuario)
        return usuario

    return _crear


@pytest.fixture()
def crear_ficha(db_session):
    def _crear(*, codigo: str | None = None, id_programa: int = 1, id_trimestre: int = 1) -> Ficha:
        ficha = Ficha(
            codigoFicha=codigo or f"FICHA-{uuid.uuid4().hex[:8]}",
            idPrograma=id_programa,
            idTrimestre=id_trimestre,
        )
        db_session.add(ficha)
        db_session.commit()
        db_session.refresh(ficha)
        return ficha

    return _crear


@pytest.fixture()
def autenticar_como(fake_supabase, crear_usuario, crear_rol):
    """Crea un usuario con los roles dados, registra su token en el
    Supabase falso y devuelve (usuario, headers) listos para usar en la
    llamada al TestClient."""

    def _autenticar(*roles_nombres: str, token: str | None = None) -> tuple[Usuario, dict]:
        token = token or f"token-{uuid.uuid4()}"
        roles = [crear_rol(nombre) for nombre in roles_nombres]
        usuario = crear_usuario(roles=roles)
        fake_supabase(token, id=str(usuario.idUsuario), email=usuario.email)
        return usuario, {"Authorization": f"Bearer {token}"}

    return _autenticar
