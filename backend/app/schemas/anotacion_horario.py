from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AnotacionHorarioCreate(BaseModel):
    idHorario: int
    nota: str
    etiqueta: str
    recordatorioActivo: bool = False


class AnotacionHorarioUpdate(BaseModel):
    nota: str
    etiqueta: str
    recordatorioActivo: bool


class AnotacionHorarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idAnotacion: int
    idUsuario: UUID
    idHorario: int
    nota: str
    etiqueta: str
    recordatorioActivo: bool
    fechaCreacion: datetime
