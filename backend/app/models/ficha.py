from sqlalchemy import Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Ficha(Base):
    __tablename__ = "fichas"

    idFicha = Column(Integer, primary_key=True, index=True)
    codigoFicha = Column(String(50), unique=True, nullable=False)
    idPrograma = Column(Integer, ForeignKey("programas.idPrograma"), nullable=False)
    idTrimestre = Column(Integer, ForeignKey("trimestres.idTrimestre"), nullable=False)
    # Nullable: las fichas existentes no traen sede/fechas todavía — se
    # completa con el import real (ver SCRUM-76, que depende de este grupo F).
    idSede = Column(Integer, ForeignKey("sedes.idSede"), nullable=True)
    fechaInicioLectiva = Column(Date, nullable=True)
    fechaFinLectiva = Column(Date, nullable=True)
    fechaInicioProductiva = Column(Date, nullable=True)
    fechaFinProductiva = Column(Date, nullable=True)

    programa = relationship("Programa")
    trimestre = relationship("Trimestre")
    sede = relationship("Sede")
