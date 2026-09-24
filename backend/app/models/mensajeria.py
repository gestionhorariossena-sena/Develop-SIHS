from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Conversacion(Base):
    """SCRUM-119 — un hilo 1 a 1 entre un Aprendiz y un Instructor que sí le
    dicta clase (validado en el service, no acá). Sin canal grupal de
    ficha ni tiempo real en esta v1."""

    __tablename__ = "conversaciones"
    __table_args__ = (
        UniqueConstraint("idAprendiz", "idInstructor", name="uqConversacionAprendizInstructor"),
    )

    idConversacion = Column(Integer, primary_key=True, index=True)
    idAprendiz = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    idInstructor = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    fechaCreacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Dos FK a la misma tabla: SQLAlchemy necesita que se le diga cuál usa
    # cada relación.
    aprendiz = relationship("Usuario", foreign_keys=[idAprendiz], lazy="joined")
    instructor = relationship("Usuario", foreign_keys=[idInstructor], lazy="joined")

    # Sin esto la bandeja mostraba UUID en vez de nombres: ni el Instructor
    # ni el Aprendiz tienen permiso sobre `GET /usuarios/` (es
    # `require_lectura_catalogo`, solo Coordinador/Administrador), así que
    # no pueden resolverlos por su cuenta — y son los dos únicos que ven
    # esta pantalla.
    @property
    def aprendizNombre(self) -> str | None:
        return self.aprendiz.nombre if self.aprendiz else None

    @property
    def instructorNombre(self) -> str | None:
        return self.instructor.nombre if self.instructor else None


class Mensaje(Base):
    __tablename__ = "mensajes"

    idMensaje = Column(Integer, primary_key=True, index=True)
    idConversacion = Column(Integer, ForeignKey("conversaciones.idConversacion", ondelete="CASCADE"), nullable=False)
    idRemitente = Column(UUID(as_uuid=True), ForeignKey("usuarios.idUsuario"), nullable=False)
    contenido = Column(Text, nullable=False)
    # Solo un link de referencia (v1 no sube archivos, ver SCRUM-119).
    adjuntoUrl = Column(String(500), nullable=True)
    leido = Column(Boolean, server_default=false(), nullable=False)
    fechaEnvio = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
