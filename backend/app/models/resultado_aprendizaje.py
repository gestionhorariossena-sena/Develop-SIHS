from sqlalchemy import Column, ForeignKey, Integer, String, Text

from app.core.database import Base


class ResultadoAprendizaje(Base):
    __tablename__ = "resultados_aprendizaje"

    idResultado = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50))
    descripcion = Column(Text, nullable=False)
    idCompetencia = Column(Integer, ForeignKey("competencias_formacion.idCompetencia"), nullable=False)
    # Nullable a propósito: no todos los programas tienen esta capa
    # digitalizada todavía — ver PLAN_INTEGRACION_LOGICA_Y_BD.md §2.1.
    idGuia = Column(Integer, ForeignKey("guias.idGuia"))
    horasAsignadas = Column(Integer)
    # Fase del pénsum en la que se dicta (1=TRIM I .. 4=TRIM IV). Un mismo
    # resultado puede repetirse en dos fases consecutivas en el Excel real
    # (se dicta progresivamente) -- por eso va en el resultado, no en la
    # competencia. Nullable: currículos importados antes de esto no la
    # traen. Ver migración 2fcba25519cd.
    numeroFase = Column(Integer, nullable=True)
