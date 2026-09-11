from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SolicitudCambioHorario(Base):
    """Gap documentado en OBJETIVO_Y_SERVICIOS_FALTANTES.md (fila
    Instructores.tsx: "no existe tabla de solicitudes de cambio de
    horario") y confirmado por los mockups nuevos: botones "Reportar
    Novedad"/"Radicar Solicitud de Cambio o Novedad"
    (detalle_de_franja_y_ambiente_sihs_sena), "Solicitar Novedad o
    Permuta" y badge "Mis Solicitudes" (mi_horario_semanal_vista_
    principal_sihs_sena). 100% nuevo.

    "idHorarioOrigen" nullable con ON DELETE SET NULL: mismo criterio que
    avisos — una solicitud ya resuelta es un registro histórico que no
    debería desaparecer si el horario de origen se borra o reprograma
    después (se crea siempre con un idHorarioOrigen real, ver
    SolicitudCambioHorarioCreate).

    "tipo" es string corto (novedad | permuta | cambio-ambiente), mismo
    criterio que avisos.categoria/anotaciones_horario.etiqueta — se acota
    en el schema de FastAPI (Pydantic Literal).

    "estado" sí es un Enum nativo de Postgres (no string libre): es un
    flujo cerrado de 3 estados (pendiente/aprobada/rechazada) con
    transición controlada por los endpoints aprobar/rechazar, igual
    criterio que ya se usó para `solicitudes_acceso.estado`.

    Aprobar una solicitud de permuta/cambio-ambiente no es solo cambiar
    "estado": el endpoint PUT .../aprobar reutiliza HorarioService.
    actualizar (la misma validación de cruces de instructor/ambiente/
    ficha/RF-011 que usa cualquier edición normal de horarios) antes de
    aplicar el cambio de verdad sobre "horarios" — nunca se saltea esa
    validación. Una solicitud de tipo "novedad" puede aprobarse sin
    aplicar ningún cambio (es solo un reporte)."""

    __tablename__ = "solicitudes_cambio_horario"

    idSolicitud = Column(Integer, primary_key=True, index=True)

    idInstructor = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="CASCADE"),
        nullable=False,
    )
    idHorarioOrigen = Column(Integer, ForeignKey("horarios.idHorario", ondelete="SET NULL"), nullable=True)

    tipo = Column(String(20), nullable=False)
    motivo = Column(Text, nullable=False)

    estado = Column(
        Enum("pendiente", "aprobada", "rechazada", name="estado_solicitud_cambio_horario"),
        nullable=False,
        server_default="pendiente",
    )

    fechaSolicitud = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fechaResolucion = Column(DateTime(timezone=True), nullable=True)

    instructor = relationship("Usuario")
    horarioOrigen = relationship("Horario")
