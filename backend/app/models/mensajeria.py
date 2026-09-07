from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Conversacion(Base):
    """SCRUM-119 — un hilo 1 a 1 entre un Aprendiz y un Instructor que sí le
    dicta clase (validado en el service, no acá). Sin canal grupal de
    ficha ni tiempo real en esta v1."""

    __tablename__ = "conversaciones"
    __table_args__ = (
        UniqueConstraint("idAprendiz", "idInstructor", name="uqConversacionAprendizInstructor"),
    )

    idConversacion = Column(Integer, primary_key=True, index=True)
    idAprendiz = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    idInstructor = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Mensaje(Base):
    __tablename__ = "mensajes"

    idMensaje = Column(Integer, primary_key=True, index=True)
    idConversacion = Column(Integer, ForeignKey("conversaciones.idConversacion", ondelete="CASCADE"), nullable=False)
    idRemitente = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    contenido = Column(Text, nullable=False)
    # Solo un link de referencia (v1 no sube archivos, ver SCRUM-119).
    adjuntoUrl = Column(String(500), nullable=True)
    leido = Column(Boolean, server_default=false(), nullable=False)
    fechaEnvio = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
