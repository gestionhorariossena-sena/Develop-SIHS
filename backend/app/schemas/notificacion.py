from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idNotificacion: int
    idUsuario: UUID
    tipo: str
    mensaje: str
    leida: bool
    fechaCreacion: datetime
    entidadRelacionada: str | None = None
    idEntidadRelacionada: str | None = None