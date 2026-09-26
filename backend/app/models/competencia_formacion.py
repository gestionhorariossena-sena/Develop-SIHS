from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.especialidad import especialidad_competencia


class CompetenciaFormacion(Base):
    __tablename__ = "competencias_formacion"

    idCompetencia = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50))
    descripcion = Column(Text, nullable=False)
    idPrograma = Column(Integer, ForeignKey("programas.idPrograma"), nullable=False)

    # Qué fortalezas habilitan a un instructor para dictar esta
    # competencia — ver models/especialidad.py y la validación de
    # HorarioService._validar_fortaleza_instructor. Vacío = la
    # competencia no se ha clasificado todavía y no se valida nada.
    especialidades = relationship(
        "Especialidad",
        secondary=especialidad_competencia,
        back_populates="competencias",
    )
