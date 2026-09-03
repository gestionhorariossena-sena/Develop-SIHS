from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.especialidad import usuario_especialidad


class Usuario(Base):
    """Perfil del dominio SIHS. La autenticación (password, sesiones,
    recuperación de contraseña) vive en auth.users, administrada por
    Supabase Auth — "idUsuario" es el mismo UUID que ese usuario allá."""

    __tablename__ = "usuarios"

    idUsuario = Column(UUID(as_uuid=True), primary_key=True)

    nombre = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)

    estado = Column(
        Enum("activo", "inactivo", name="estado_usuario"),
        default="activo",
    )

    fechaRegistro = Column(DateTime(timezone=True), server_default=func.now())

    # Solo aplica a instructores — nullable a propósito, ver
    # _Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md §2.2.
    tipoContrato = Column(String(20))
    horasContratadasSemana = Column(Integer)
    codigoInstructor = Column(String(20), unique=True, nullable=True)
    # Trimestre en el que se generó codigoInstructor. El código queda fijo
    # una vez creado (no se regenera) — no es un historial de códigos por
    # trimestre, solo registra en cuál se emitió el único código vigente.
    idTrimestre = Column(Integer, ForeignKey("trimestres.idTrimestre"), nullable=True)
    # Sigla/iniciales cortas (ej. "DC", "LM") — así referencian instructores
    # ambas coordinaciones en sus horarios reales, distinto de
    # codigoInstructor (el código de registro que ya existía).
    sigla = Column(String(10), nullable=True)

    roles = relationship(
        "Rol",
        secondary="usuario_rol",
        back_populates="usuarios",
    )

    especialidades = relationship(
        "Especialidad",
        secondary=usuario_especialidad,
        back_populates="usuarios",
    )
