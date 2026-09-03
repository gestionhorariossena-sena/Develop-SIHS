from sqlalchemy import JSON, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

# JSON genérico por defecto, JSONB real en Postgres (`with_variant`) — el
# dialecto de SQLite que usan los tests no sabe compilar `postgresql.JSONB`
# directo. En producción (Postgres) esto sigue siendo JSONB exactamente
# igual que antes, ningún cambio de comportamiento ahí.
_JSON_O_JSONB = JSON().with_variant(JSONB(), "postgresql")


class HorarioGuardado(Base):
    """Lo que arma el editor visual (frontend/src/pages/NuevoHorario.tsx),
    guardado tal cual. NO es la tabla "horarios" relacional (esa exige FKs
    reales a ambiente/instructor/ficha/resultado para detectar cruces, que
    es el objetivo real del proyecto) — el editor hoy captura ficha/
    instructor/ambiente como texto libre, así que se guarda en JSONB hasta
    que ese módulo exista. Ver
    _Docs/Documentación general/SECCION_ESTUDIANTES.md."""

    __tablename__ = "horarios_guardados"

    idHorarioGuardado = Column(Integer, primary_key=True, index=True)
    idUsuario = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="CASCADE"),
        nullable=False,
    )

    ficha = Column(String(100), nullable=False)
    aprendices = Column(String(20))
    horasTrimestre = Column(String(20))
    fechaInicio = Column(Date)
    fechaFin = Column(Date)

    bloques = Column(_JSON_O_JSONB, nullable=False)
    grid = Column(_JSON_O_JSONB, nullable=False)

    # idHorario de cada fila real creada en `horarios` (tabla relacional)
    # al guardar este snapshot — sin esto, borrar el snapshot ("Horario
    # completo" en Historial de horarios) no tenía forma de saber cuáles
    # clases reales le correspondían, así que las dejaba huérfanas (bug
    # reportado 2026-09-02: instructor seguía "ocupado" después de borrar
    # su horario completo). Nullable: snapshots viejos, de antes de este
    # cambio, no lo tienen — borrarlos sigue sin poder liberar las clases
    # reales asociadas, no hay forma de reconstruir el vínculo con datos
    # que ya existían.
    idsHorarios = Column(_JSON_O_JSONB, nullable=True)

    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario")
