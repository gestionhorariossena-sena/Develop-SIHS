from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class SolicitudCambioHorario(Base):
    """SCRUM-116: un instructor reporta una novedad/permuta/cambio de
    ambiente sobre un bloque suyo ya programado. v1 solo registra la
    solicitud y su resolución — no mueve datos reales de `horarios` al
    aprobar, ver docstring de SolicitudCambioHorarioService.resolver."""

    __tablename__ = "solicitud_cambio_horario"

    idSolicitud = Column(Integer, primary_key=True, index=True)

    idInstructor = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    idHorarioOrigen = Column(Integer, ForeignKey("horarios.idHorario"), nullable=False)

    tipo = Column(String(20), nullable=False)  # novedad | permuta | cambio-ambiente
    motivo = Column(String(1000), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente | aprobada | rechazada

    fechaSolicitud = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fechaResolucion = Column(DateTime(timezone=True), nullable=True)
    idAdminResolvio = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=True)
