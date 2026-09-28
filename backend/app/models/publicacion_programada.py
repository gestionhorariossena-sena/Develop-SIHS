from sqlalchemy import (
    CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, func,
)

from app.core.database import Base


class PublicacionProgramada(Base):
    __tablename__ = "publicaciones_programadas"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente', 'ejecutando', 'publicada', 'fallida', 'cancelada', 'revision_requerida')",
            name="ck_publicaciones_programadas_estado",
        ),
    )

    idPublicacion = Column(Integer, primary_key=True)
    idTrimestre = Column(Integer, ForeignKey("trimestres.idTrimestre", ondelete="RESTRICT"), nullable=False)
    idCoordinador = Column(ForeignKey("usuarios.idUsuario", ondelete="RESTRICT"), nullable=False)
    fechaEjecucion = Column(DateTime(timezone=True), nullable=False)
    estado = Column(String(30), nullable=False, default="pendiente", server_default="pendiente")
    fechaCreacion = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fechaEjecucionReal = Column(DateTime(timezone=True))
    resultado = Column(Text)
    revision = Column(Integer, nullable=False, default=1, server_default="1")


class PublicacionProgramadaHorario(Base):
    __tablename__ = "publicacion_programada_horarios"
    __table_args__ = (
        UniqueConstraint("idPublicacion", "revision", "idHorarioReferencia", name="uq_publicacion_revision_horario"),
    )

    idPublicacionHorario = Column(Integer, primary_key=True)
    idPublicacion = Column(
        Integer,
        ForeignKey("publicaciones_programadas.idPublicacion", ondelete="CASCADE"),
        nullable=False,
    )
    # La FK solo bloquea el horario mientras su programación está activa
    # (lo garantiza el servicio); al eliminar un horario histórico deja NULL.
    idHorario = Column(Integer, ForeignKey("horarios.idHorario", ondelete="SET NULL"), nullable=True)
    # Conserva el identificador histórico sin una FK restrictiva.
    idHorarioReferencia = Column(Integer, nullable=False)
    revision = Column(Integer, nullable=False)
    huellaRevision = Column(String(64), nullable=False)
