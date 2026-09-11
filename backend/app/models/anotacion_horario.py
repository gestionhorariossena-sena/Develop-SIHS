from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AnotacionHorario(Base):
    """Notas personales del Aprendiz sobre su horario — sección "Herramientas
    de Organización Personal" / drawer "Organizador Personal" de
    mi_horario_rol_aprendiz_sihs_sena/code.html. 100% nuevo, sin tabla previa
    que reusar.

    "idHorario" (no "idHorarioDia") es la FK al bloque real: horario_dia es
    una tabla puente sin PK propia (ver app/models/horario.py), así que no
    hay una fila individual a la que apuntar ahí — el bloque horario ya
    identifica de sobra la clase sobre la que se anota. Nullable porque el
    mockup también admite notas generales no atadas a un bloque puntual.

    "etiqueta" sigue el mismo criterio que Notificacion.tipo: string corto,
    sin tabla catálogo aparte — acotado a nivel de schema (Pydantic Literal),
    no con un Enum de Postgres, para no necesitar una migración cada vez que
    se agregue una etiqueta nueva."""

    __tablename__ = "anotaciones_horario"

    idAnotacion = Column(Integer, primary_key=True, index=True)

    idUsuario = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="CASCADE"),
        nullable=False,
    )
    idHorario = Column(Integer, ForeignKey("horarios.idHorario", ondelete="CASCADE"), nullable=True)

    nota = Column(Text, nullable=False)
    etiqueta = Column(String(20), nullable=False, server_default="Normal")

    # v1 solo guarda la preferencia y la pinta en la UI — el envío real del
    # recordatorio (push/correo) queda como mejora aparte, no bloqueante.
    recordatorioActivo = Column(Boolean, nullable=False, server_default=false())

    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    usuario = relationship("Usuario")
    horario = relationship("Horario")
