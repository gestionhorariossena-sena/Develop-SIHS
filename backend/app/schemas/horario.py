from datetime import time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HorarioBase(BaseModel):
    horaInicio: time
    horaFin: time
    idJornada: int
    idTrimestre: int
    idAmbiente: int
    idInstructor: UUID
    idFicha: int
    idResultado: int


class HorarioCreate(HorarioBase):
    # Ids de "diasDeLaSemana" — un horario puede repetirse varios días
    # (ver horario_dia, tabla puente).
    dias: list[int]
    forzar: bool = False


class HorarioUpdate(HorarioCreate):
    pass


class HorarioResponse(HorarioBase):
    model_config = ConfigDict(from_attributes=True)

    idHorario: int
    dias: list[int]

    # Enriquecido por HorarioService/_a_response para no obligar al
    # frontend a resolver estos nombres con llamadas aparte.
    instructorNombre: str | None = None
    fichaCodigo: str | None = None
    ambienteNombre: str | None = None
    resultadoCodigo: str | None = None
    resultadoDescripcion: str | None = None
