from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Asistencia(Base):
    """Asistencia de un aprendiz a UNA sesión concreta de un bloque de
    horario (SCRUM-113).

    La tabla venía del backlog sin endpoints, porque el backend
    institucional no provee la lista de estudiantes por ficha (gestión
    descentralizada en Sofía Plus). Se activó el 2026-09-25 con la nómina
    que el sistema sí tiene: los aprendices vinculados a la ficha
    (`ficha_usuario`). Mientras esa nómina esté incompleta, la pantalla lo
    dice en vez de fingir un curso entero.

    `fechaSesion` es lo que convierte un horario semanal recurrente en una
    clase concreta — ver la migración c9d4e1f70a33.
    """

    __tablename__ = "asistencias"
    __table_args__ = (
        # Pasar lista dos veces de la misma sesión corrige, no duplica.
        UniqueConstraint(
            "idHorario", "idUsuarioAprendiz", "fechaSesion", name="uqAsistenciaHorarioAprendizFecha"
        ),
        Index("ixAsistenciaAprendizFecha", "idUsuarioAprendiz", "fechaSesion"),
    )

    idAsistencia = Column(Integer, primary_key=True, index=True)

    idHorario = Column(Integer, ForeignKey("horarios.idHorario"), nullable=False)
    idUsuarioAprendiz = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)

    # Qué día concreto se dictó esa clase. Sin esto, dos semanas seguidas
    # del mismo bloque serían la misma fila.
    fechaSesion = Column(Date, nullable=False)

    estado = Column(String(20), nullable=False)  # presente | tardanza | excusa | ausente
    horaMarcacion = Column(DateTime(timezone=True), nullable=True)
    referenciaExcusa = Column(String(200), nullable=True)

    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # El historial del aprendiz muestra tema, instructor y ambiente de cada
    # sesión: todo eso cuelga del horario.
    horario = relationship("Horario")
    aprendiz = relationship("Usuario")
