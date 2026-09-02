from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Auditoria(Base):
    """RNF-26/RNF-27: registro mínimo de acciones sensibles (usuarios,
    horarios, ambientes, fichas) e intentos fallidos de login — esto
    último es la base que necesita SCRUM-17 para contar intentos por
    usuario y bloquear tras el tercero.

    "idUsuario" es nullable a propósito: un intento de login fallido puede
    no resolver a un usuario real (ej. email que no existe en el sistema)
    — "identificador" guarda igual el dato con el que se intentó (email o
    documento) para no perder trazabilidad en ese caso."""

    __tablename__ = "auditoria"

    idAuditoria = Column(Integer, primary_key=True, index=True)
    idUsuario = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario", ondelete="SET NULL"))
    identificador = Column(String(150))
    accion = Column(String(50), nullable=False)
    entidad = Column(String(50), nullable=False)
    idEntidad = Column(String(50))
    detalle = Column(Text)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
