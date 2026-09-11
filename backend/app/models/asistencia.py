from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Asistencia(Base):
    """Módulo exploratorio (SCRUM-113, backlog de arquitectura): confirmado
    por el mockup detalle_de_franja_y_ambiente_sihs_sena/code.html, que lo
    marca a sí mismo como "PROTOTIPO PRÓXIMO RELEASE" — el backend
    institucional SIHS actual no provee lista de estudiantes por ficha en
    tiempo real (gestión descentralizada en SOFIA Plus), así que este
    ticket solo deja la tabla trazada en el backlog. No lleva endpoints
    todavía a propósito: dependen de que exista una lista real de
    aprendices por ficha con datos de contacto (ver ficha_usuario)."""

    __tablename__ = "asistencias"

    idAsistencia = Column(Integer, primary_key=True, index=True)

    idHorario = Column(Integer, ForeignKey("horarios.idHorario"), nullable=False)
    idUsuarioAprendiz = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)

    # presente | tardanza | excusa | ausente
    estado = Column(String(20), nullable=False)
    horaMarcacion = Column(DateTime(timezone=True), nullable=True)
    referenciaExcusa = Column(String(200), nullable=True)

    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
