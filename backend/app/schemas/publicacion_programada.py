from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PublicacionProgramadaInput(BaseModel):
    idTrimestre: int
    idHorarios: list[int] = Field(min_length=1)
    fechaHoraLocal: datetime

    @field_validator("fechaHoraLocal")
    @classmethod
    def hora_local_sin_zona(cls, value: datetime):
        if value.tzinfo is not None:
            raise ValueError("Envía la hora local de Colombia sin offset de zona horaria.")
        return value


class PublicacionProgramadaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idPublicacion: int
    idTrimestre: int
    idCoordinador: UUID
    fechaEjecucion: datetime
    estado: str
    fechaCreacion: datetime
    fechaEjecucionReal: datetime | None
    resultado: str | None
    revision: int
    idHorarios: list[int] = Field(default_factory=list)
