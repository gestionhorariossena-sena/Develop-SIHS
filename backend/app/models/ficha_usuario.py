from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class FichaUsuario(Base):
    """Vínculo aprendiz-ficha. Ver _Docs/Documentación general/
    SECCION_ESTUDIANTES.md: se asume una ficha activa a la vez por usuario,
    aunque el esquema (PK compuesta) permitiría N:N."""

    __tablename__ = "ficha_usuario"

    idFicha = Column(Integer, ForeignKey("fichas.idFicha"), primary_key=True)
    idUsuario = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), primary_key=True)

    # Concepto de "Vocero"/"Subvocero" de ficha, confirmado por los mockups
    # de Instructor (detalle_de_franja_y_ambiente_sihs_sena,
    # mi_horario_semanal_vista_principal_sihs_sena). Columna suelta en vez
    # de tabla aparte: es un atributo del VÍNCULO aprendiz-ficha (un vocero
    # lo es de ESA ficha puntual, no en general), y ficha_usuario ya es esa
    # tabla de vínculo — una tabla nueva solo para esto duplicaría la misma
    # PK compuesta sin ganar nada. Valores esperados: 'vocero' | 'subvocero'
    # | NULL (aprendiz normal).
    rolEnFicha = Column(String(20), nullable=True)


ficha_usuario = FichaUsuario.__table__
