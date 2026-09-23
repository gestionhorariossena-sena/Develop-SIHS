from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

EtiquetaAnotacion = Literal["Examen", "Entrega", "Importante", "Normal"]


class AnotacionHorarioBase(BaseModel):
    idHorario: int | None = None
    nota: str
    etiqueta: EtiquetaAnotacion = "Normal"
    recordatorioActivo: bool = False


class AnotacionHorarioCreate(AnotacionHorarioBase):
    pass


class AnotacionHorarioUpdate(AnotacionHorarioBase):
    pass


class AnotacionHorarioResponse(AnotacionHorarioBase):
    model_config = ConfigDict(from_attributes=True)

    idAnotacion: int
    idUsuario: UUID
    fechaCreacion: datetime
