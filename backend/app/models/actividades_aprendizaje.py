from sqlalchemy import Column, ForeignKey, Integer, String, Text

from app.core.database import Base


class ActividadAprendizaje(Base):
    __tablename__ = "actividades_aprendizaje"

    idActividad = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50))
    descripcion = Column(Text, nullable=False)
    tipoActividad = Column(String(80))
    duracionMinutos = Column(Integer)
    idResultado = Column(Integer, ForeignKey("resultados_aprendizaje.idResultado"), nullable=False)
