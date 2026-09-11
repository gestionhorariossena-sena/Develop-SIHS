from sqlalchemy import CheckConstraint, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class SolicitudAcceso(Base):
    """Solicitud de acceso al sistema (SCRUM-96) hecha por alguien que
    todavía NO tiene cuenta en Supabase Auth — nombre/email/numeroDocumento
    son texto libre declarado por el solicitante en el portal público de
    registro, no una FK a "usuarios". Al aprobar (ticket de backend aparte),
    el flujo crea el usuario en Supabase Auth + "usuarios" y despacha una
    credencial temporal con "usuarios.debe_cambiar_clave" en true."""

    __tablename__ = "solicitudes_acceso"
    __table_args__ = (
        CheckConstraint(
            "estado != 'rechazada' OR \"motivoRechazo\" IS NOT NULL",
            name="ckMotivoRechazoObligatorio",
        ),
    )

    idSolicitud = Column(Integer, primary_key=True, index=True)

    nombre = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    numeroDocumento = Column(String(30), nullable=False)

    # No asumir que solo aplica a Coordinador: el mockup filtra por
    # "Todos los roles solicitados" sobre cualquier rol.
    idRolSolicitado = Column(Integer, ForeignKey("roles.idRol"), nullable=False)

    motivo = Column(Text, nullable=False)

    estado = Column(
        Enum("pendiente", "aprobada", "rechazada", name="estado_solicitud_acceso"),
        nullable=False,
        default="pendiente",
        server_default="pendiente",
    )
    # Obligatorio solo cuando estado='rechazada' — ver ckMotivoRechazoObligatorio.
    motivoRechazo = Column(Text, nullable=True)

    fechaSolicitud = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fechaResolucion = Column(DateTime(timezone=True), nullable=True)

    idAdminResolvio = Column(
        UUID(as_uuid=True), ForeignKey("usuarios.idUsuario", ondelete="SET NULL"), nullable=True
    )
