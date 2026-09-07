from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class SolicitudAcceso(Base):
    """SCRUM-103: mockup `panel_de_administracion_sihs_sena/code.html`.
    Distinto de "usuario sin rol" (SCRUM-10, `AprobarlicitarSolicitudes.tsx`
    ya Finalizado, opera sobre cuentas que YA se registraron en Supabase
    Auth) — esto modela la solicitud PREVIA a que exista cuenta, con motivo
    declarado y trazabilidad de quién la resolvió. Los endpoints
    (crear/listar/aprobar/rechazar) son otro ticket del mismo Epic
    (SCRUM-109), no este — este ticket solo deja la tabla lista."""

    __tablename__ = "solicitudes_acceso"

    idSolicitud = Column(Integer, primary_key=True, index=True)

    # El solicitante todavía no tiene cuenta de Supabase Auth en este
    # punto — texto libre, no FK a usuarios.
    nombre = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    numeroDocumento = Column(String(30), nullable=True)

    idRolSolicitado = Column(Integer, ForeignKey("roles.idRol"), nullable=False)
    motivo = Column(Text, nullable=False)

    estado = Column(String(20), nullable=False, default="pendiente")
    motivoRechazo = Column(Text, nullable=True)

    fechaSolicitud = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fechaResolucion = Column(DateTime(timezone=True), nullable=True)
    idAdminResolvio = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=True)
