from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Aviso(Base):
    """Avisos y comunicados de Coordinación —
    avisos_oficiales_y_eventos_rol_aprendiz_sihs_sena/code.html. 100% nuevo,
    no hay tabla previa que reusar.

    "idFicha"/"idSede" nullable a propósito: null en ambos = aviso general
    (visible para todos), idFicha puesto = aplica a una ficha puntual (ej.
    cancelación de una clase), idSede puesto = aviso de esa sede. No son
    excluyentes entre sí — el filtrado real (ficha vinculada del Aprendiz,
    sede, etc.) lo hace el frontend sobre lo que devuelve GET /avisos/.

    "adjuntoUrl" es solo texto (link externo) a propósito: este ticket no
    cubre subir el archivo, esa es una mejora aparte.

    Fuera de alcance (ver ticket): relacionar un aviso a un bloque puntual
    de "horarios" ("Ver cómo afecta mi horario" del mockup) y cualquier
    tabla de aforo/hitos institucionales — ninguna de las dos existe hoy."""

    __tablename__ = "avisos"

    idAviso = Column(Integer, primary_key=True, index=True)

    # Nullable + SET NULL (no CASCADE): un aviso oficial es un registro
    # histórico que debe sobrevivir aunque la cuenta del Coordinador que lo
    # publicó se elimine después.
    idUsuarioPublicador = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.idUsuario", ondelete="SET NULL"),
        nullable=True,
    )

    titulo = Column(String(200), nullable=False)
    cuerpo = Column(Text, nullable=False)

    # reprog | eventos | sede: mismas 3 categorías del filtro del mockup.
    # extraordinario: el destacado tipo "COMUNICADO EXTRAORDINARIO".
    categoria = Column(String(20), nullable=False)

    # SET NULL (no CASCADE): si la ficha/sede referenciada se borra, el
    # aviso no debería desaparecer con ella — null ya es un estado válido
    # ("aviso general"), así que cae ahí en vez de perderse.
    idFicha = Column(Integer, ForeignKey("fichas.idFicha", ondelete="SET NULL"), nullable=True)
    idSede = Column(Integer, ForeignKey("sedes.idSede", ondelete="SET NULL"), nullable=True)

    adjuntoUrl = Column(String(500), nullable=True)

    fechaPublicacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    vigenteHasta = Column(DateTime(timezone=True), nullable=True)

    publicador = relationship("Usuario")
    ficha = relationship("Ficha")
    sede = relationship("Sede")
