"""Trazabilidad de una ejecución confirmada de carga masiva de instructores."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class LoteImportacionInstructor(Base):
    __tablename__ = "lotes_importacion_instructores"

    idLote = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    idAdministrador = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario", ondelete="SET NULL"), nullable=True)
    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
