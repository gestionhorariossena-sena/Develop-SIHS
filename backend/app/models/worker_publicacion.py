from sqlalchemy import Column, DateTime, Integer

from app.core.database import Base


class WorkerPublicacionEstado(Base):
    """Última señal persistida del proceso worker de publicaciones."""

    __tablename__ = "worker_publicacion_estado"

    id = Column(Integer, primary_key=True)
    ultimaSenal = Column(DateTime(timezone=True), nullable=False)
