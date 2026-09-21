from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Asistencia(Base):
    """SCRUM-113 — módulo exploratorio, marcado en el propio mockup
    (`detalle_de_franja_y_ambiente_sihs_sena/code.html`) como "PROTOTIPO
    PRÓXIMO RELEASE": el backend institucional no provee lista de
    estudiantes por ficha en tiempo real (gestión descentralizada en Sofía
    Plus). Este ticket solo deja la tabla trazada en el backlog — no hay
    endpoints todavía a propósito, se agregan cuando se priorice."""

    __tablename__ = "asistencias"

    idAsistencia = Column(Integer, primary_key=True, index=True)

    idHorario = Column(Integer, ForeignKey("horarios.idHorario"), nullable=False)
    idUsuarioAprendiz = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)

    estado = Column(String(20), nullable=False)  # presente | tardanza | excusa | ausente
    horaMarcacion = Column(DateTime(timezone=True), nullable=True)
    referenciaExcusa = Column(String(200), nullable=True)

    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
