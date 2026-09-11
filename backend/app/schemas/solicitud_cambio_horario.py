from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.horario import HorarioUpdate

TipoSolicitudCambioHorario = Literal["novedad", "permuta", "cambio-ambiente"]
EstadoSolicitudCambioHorario = Literal["pendiente", "aprobada", "rechazada"]


class SolicitudCambioHorarioCreate(BaseModel):
    idHorarioOrigen: int
    tipo: TipoSolicitudCambioHorario
    motivo: str


class SolicitudCambioHorarioAprobar(BaseModel):
    # Si viene, se aplica a idHorarioOrigen vía HorarioService.actualizar
    # (con su misma validación de cruces) antes de marcar la solicitud
    # como aprobada. Se deja vacío para un tipo "novedad" que no requiere
    # cambiar nada en "horarios", solo quedar registrada como atendida.
    cambios: HorarioUpdate | None = None


class SolicitudCambioHorarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idSolicitud: int
    idInstructor: UUID
    idHorarioOrigen: int | None
    tipo: TipoSolicitudCambioHorario
    motivo: str
    estado: EstadoSolicitudCambioHorario
    fechaSolicitud: datetime
    fechaResolucion: datetime | None
    instructorNombre: str | None = None
