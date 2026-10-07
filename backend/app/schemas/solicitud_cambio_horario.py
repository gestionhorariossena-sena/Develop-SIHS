from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SolicitudCambioHorarioCreate(BaseModel):
    idHorarioOrigen: int
    tipo: str
    motivo: str


class SolicitudCambioHorarioResolver(BaseModel):
    estado: str  # aprobada | rechazada


class SolicitudCambioHorarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idSolicitud: int
    idInstructor: UUID
    idHorarioOrigen: int
    tipo: str
    motivo: str
    estado: str
    fechaSolicitud: datetime
    fechaResolucion: datetime | None = None
    idAdminResolvio: UUID | None = None
    instructorNombre: str | None = None
    fichaCodigo: str | None = None
    horaInicio: time | None = None
    horaFin: time | None = None
    ambienteNombre: str | None = None
