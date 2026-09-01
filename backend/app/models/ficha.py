from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Ficha(Base):
    __tablename__ = "fichas"

    idFicha = Column(Integer, primary_key=True, index=True)
    codigoFicha = Column(String(50), unique=True, nullable=False)
    idPrograma = Column(Integer, ForeignKey("programas.idPrograma"), nullable=False)
    idTrimestre = Column(Integer, ForeignKey("trimestres.idTrimestre"), nullable=False)

    programa = relationship("Programa")
    trimestre = relationship("Trimestre")
