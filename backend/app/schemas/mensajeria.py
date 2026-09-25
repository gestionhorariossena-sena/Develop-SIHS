from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ConversacionCrear(BaseModel):
    idInstructor: UUID


class ConversacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idConversacion: int
    idAprendiz: UUID
    idInstructor: UUID
    fechaCreacion: datetime

    # Los resuelve el modelo: quienes usan esta pantalla (Aprendiz e
    # Instructor) no tienen permiso para mirar /usuarios/.
    aprendizNombre: str | None = None
    instructorNombre: str | None = None


class MensajeCrear(BaseModel):
    contenido: str
    adjuntoUrl: str | None = None


class MensajeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idMensaje: int
    idConversacion: int
    idRemitente: UUID
    contenido: str
    adjuntoUrl: str | None = None
    leido: bool
    fechaEnvio: datetime
