from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.rol import RolResponse


class UsuarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idUsuario: UUID
    nombre: str
    email: EmailStr
    estado: str
    fechaRegistro: datetime
    # Solo aplica a instructores — nullable, ver
    # _Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md §2.2.
    tipoContrato: str | None = None
    horasContratadasSemana: int | None = None
    roles: list[RolResponse] = []
