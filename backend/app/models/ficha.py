from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from app.core.database import Base

ficha_usuario = Table(
    "ficha_usuario",
    Base.metadata,
    Column("idFicha", Integer, ForeignKey("fichas.idFicha", ondelete="CASCADE"), primary_key=True),
    Column("idUsuario", ForeignKey("usuarios.idUsuario", ondelete="CASCADE"), primary_key=True),
)


class Ficha(Base):
    __tablename__ = "fichas"

    idFicha = Column(Integer, primary_key=True, index=True)
    codigoFicha = Column(String(50), unique=True, nullable=False)
    idPrograma = Column(Integer, ForeignKey("programas.idPrograma"), nullable=False)
    idTrimestre = Column(Integer, ForeignKey("trimestres.idTrimestre"), nullable=False)

    programa = relationship("Programa")
    trimestre = relationship("Trimestre")
