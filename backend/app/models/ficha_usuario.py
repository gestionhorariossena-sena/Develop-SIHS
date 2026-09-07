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
    # SCRUM-108: "vocero"/"subvocero"/null (aprendiz normal). Columna suelta
    # en vez de tabla aparte — se decidió así porque es un atributo del
    # VÍNCULO aprendiz-ficha (un vocero lo es de ESA ficha puntual, no en
    # general), y ficha_usuario ya es esa tabla de vínculo; una tabla nueva
    # solo para esto duplicaría la misma PK compuesta sin ganar nada.
    rolEnFicha = Column(String(20), nullable=True)


ficha_usuario = FichaUsuario.__table__
