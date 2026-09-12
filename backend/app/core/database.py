from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

# client_encoding explícito: sin esto, texto con tildes/guiones largos que
# manda el frontend (ej. "—", "í") se puede guardar corrupto en Postgres
# dependiendo del locale de Windows donde corra el backend — encontrado en
# vivo el 2026-08-26 (tematica de un bloque con "—" llegó a la BD como
# "â€”", el patrón clásico de UTF-8 reinterpretado como
# Latin-1/cp1252 y vuelto a codificar).
# pool_pre_ping: sin esto, una conexión que Supabase (o la red) cerró por
# inactividad se sigue entregando desde el pool como si estuviera viva —
# la siguiente query se cuelga hasta que el SO agota el timeout TCP en vez
# de fallar rápido, y recién ahí SQLAlchemy se entera de que estaba muerta
# (visto en vivo: "OperationalError: consuming input failed ... Connection
# timed out" tras el backend corriendo varias horas sin reiniciar).
# pool_recycle: además, descarta conexiones de más de 5 minutos aunque
# parezcan sanas, para no depender solo del pre-ping.
# prepare_threshold=None: Supabase entrega la connection string del
# *pooler* (PgBouncer en modo transacción), que no soporta prepared
# statements con nombre entre transacciones distintas -- psycopg3 los
# prepara solo automáticamente después de unas cuantas ejecuciones. Sin
# esto, cualquier query que se repita lo suficiente revienta al azar con
# "DuplicatePreparedStatement" o "InvalidSqlStatementName" (encontrado en
# vivo el 2026-09-11 corriendo scripts de import masivo -- el mismo error
# aparecía en puntos distintos y no correspondía a ningún dato corrupto,
# solo a la conexión reutilizando un nombre de prepared statement que ya
# no era válido para esa conexión pooleada).
engine = create_engine(
    settings.database_url,
    connect_args={"client_encoding": "utf8", "prepare_threshold": None},
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
