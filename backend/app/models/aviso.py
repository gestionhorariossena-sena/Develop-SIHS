from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Aviso(Base):
    """Aviso/comunicado publicado por Coordinación — SCRUM-111. General de
    sede (idFicha/idSede null) o dirigido a una ficha/sede puntual."""

    __tablename__ = "avisos"

    idAviso = Column(Integer, primary_key=True, index=True)

    idUsuarioPublicador = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario"),
        nullable=False,
    )

    titulo = Column(String(200), nullable=False)
    cuerpo = Column(Text, nullable=False)
    # reprog | eventos | sede | extraordinario
    categoria = Column(String(20), nullable=False)

    idFicha = Column(Integer, ForeignKey("fichas.idFicha"), nullable=True)
    idSede = Column(Integer, ForeignKey("sedes.idSede"), nullable=True)

    adjuntoUrl = Column(String(500), nullable=True)

    fechaPublicacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    vigenteHasta = Column(Date, nullable=True)

    publicador = relationship("Usuario")
    ficha = relationship("Ficha")
    sede = relationship("Sede")
