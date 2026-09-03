from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Notificacion(Base):
    __tablename__ = "notificaciones"

    idNotificacion = Column(Integer, primary_key=True, index=True)

    idUsuario = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="CASCADE"),
        nullable=False,
    )

    tipo = Column(String(30), nullable=False)
    mensaje = Column(String(500), nullable=False)

    leida = Column(Boolean, server_default="false", nullable=False)

    fechaCreacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    entidadRelacionada = Column(String(50), nullable=True)
    idEntidadRelacionada = Column(String(50), nullable=True)

    usuario = relationship("Usuario")