from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class FichaUsuario(Base):
    """Vínculo aprendiz-ficha. Ver _Docs/Documentación general/
    SECCION_ESTUDIANTES.md: se asume una ficha activa a la vez por usuario,
    aunque el esquema (PK compuesta) permitiría N:N."""

    __tablename__ = "ficha_usuario"

    idFicha = Column(Integer, ForeignKey("fichas.idFicha"), primary_key=True)
    idUsuario = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), primary_key=True)
