from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
 
from app.core.database import Base
 
# Tabla puente usuario_especialidad: igual que usuario_rol para Rol, no
# necesita su propio model/schema/repository/service — un usuario puede
# tener varias especialidades y se maneja con esta tabla de asociación
# pura (sin columnas propias, solo las dos FK como PK compuesta).
usuario_especialidad = Table(
    "usuario_especialidad",
    Base.metadata,
    Column(
        "idUsuario",
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "idEspecialidad",
        Integer,
        ForeignKey("especialidades.idEspecialidad", ondelete="CASCADE"),
        primary_key=True,
    ),
)

# Tabla puente especialidad_competencia: qué especialidades habilitan a un
# instructor para dictar una competencia (y por lo tanto los resultados de
# aprendizaje que cuelgan de ella). Misma forma que usuario_especialidad —
# asociación pura, sin columnas propias. Ver la migración
# a7c31f5b9e02 para el porqué.
especialidad_competencia = Table(
    "especialidad_competencia",
    Base.metadata,
    Column(
        "idEspecialidad",
        Integer,
        ForeignKey("especialidades.idEspecialidad", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "idCompetencia",
        Integer,
        ForeignKey("competencias_formacion.idCompetencia", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Especialidad(Base):
    __tablename__ = "especialidades"
 
    idEspecialidad = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
 
    usuarios = relationship(
        "Usuario",
        secondary=usuario_especialidad,
        back_populates="especialidades",
    )

    competencias = relationship(
        "CompetenciaFormacion",
        secondary=especialidad_competencia,
        back_populates="especialidades",
    )
 