from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AnotacionHorario(Base):
    """Notas personales del Aprendiz sobre un bloque de horario propio —
    SCRUM-107. Ver mockup mi_horario_rol_aprendiz_sihs_sena/code.html,
    sección "Herramientas de Organización Personal"."""

    __tablename__ = "anotaciones_horario"

    idAnotacion = Column(Integer, primary_key=True, index=True)

    idUsuario = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="CASCADE"),
        nullable=False,
    )
    idHorario = Column(
        Integer,
        ForeignKey("horarios.idHorario", ondelete="CASCADE"),
        nullable=False,
    )

    nota = Column(String(500), nullable=False)
    # Examen | Entrega | Importante | Normal — string corto, mismo criterio
    # que Notificacion.tipo, sin tabla catálogo aparte.
    etiqueta = Column(String(20), nullable=False)

    # v1 solo guarda la preferencia y la pinta en la UI — el envío real de
    # un recordatorio (push/correo) es trabajo futuro, no bloqueante.
    recordatorioActivo = Column(Boolean, server_default=false(), nullable=False)

    fechaCreacion = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    usuario = relationship("Usuario")
    horario = relationship("Horario")
