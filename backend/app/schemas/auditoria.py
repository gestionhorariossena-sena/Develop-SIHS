from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IntentoLoginFallido(BaseModel):
    # Lo que el usuario escribió al intentar iniciar sesión (email, en la
    # práctica) — no necesariamente corresponde a un usuario real.
    identificador: str


class EstadoLoginResponse(BaseModel):
    bloqueado: bool
    intentos: int
    intentosRestantes: int
    segundosParaDesbloqueo: int | None = None


class AuditoriaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idAuditoria: int
    idUsuario: UUID | None = None
    identificador: str | None = None
    accion: str
    entidad: str
    idEntidad: str | None = None
    detalle: str | None = None
    fecha: datetime
