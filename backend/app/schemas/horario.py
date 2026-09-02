from datetime import time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


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


class HorarioDryRunRequest(HorarioBase):
    dias: list[int]
    excluirIdHorario: int | None = None

    @field_validator("horaFin")
    @classmethod
    def valida_rango(cls, hora_fin: time, info):
        hora_inicio = info.data.get("horaInicio")
        if hora_inicio is not None and hora_fin <= hora_inicio:
            raise ValueError("La hora de fin debe ser mayor que la de inicio.")
        return hora_fin


class HorarioDryRunConflict(BaseModel):
    tipo: str
    mensaje: str
    idHorarioExistente: int | None = None
    idInstructor: UUID | None = None
    idFicha: int | None = None
    idAmbiente: int | None = None
    idResultado: int | None = None


class HorarioDryRunResponse(BaseModel):
    ok: bool
    puedeGuardar: bool
    mensaje: str
    conflictos: list[HorarioDryRunConflict] = []
    resumen: dict[str, object]


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
