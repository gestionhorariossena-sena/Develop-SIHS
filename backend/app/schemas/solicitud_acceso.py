from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class EstadoSolicitudAcceso(str, Enum):
    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"


class SolicitudAccesoCreate(BaseModel):
    """POST /solicitudes-acceso/ -- público, la persona todavía no tiene
    cuenta en Supabase Auth en este punto (por eso texto libre, no un
    idUsuario)."""

    nombre: str = Field(min_length=1, max_length=150)
    email: EmailStr
    numeroDocumento: str = Field(min_length=1, max_length=30)
    idRolSolicitado: int
    motivo: str = Field(min_length=1)


class SolicitudAccesoResponse(BaseModel):
    idSolicitud: int
    nombre: str
    email: str
    numeroDocumento: str
    idRolSolicitado: int
    # Resuelto en el servicio (join con roles) -- igual criterio que
    # HorarioService.a_response con instructorNombre/ambienteNombre, para
    # no obligar al frontend a pedirlo aparte.
    rolSolicitado: str | None = None
    motivo: str
    estado: EstadoSolicitudAcceso
    motivoRechazo: str | None = None
    fechaSolicitud: datetime
    fechaResolucion: datetime | None = None
    idAdminResolvio: UUID | None = None


class SolicitudAccesoAprobar(BaseModel):
    """El admin puede otorgar un rol distinto al solicitado -- el mockup
    lo permite vía un selector precargado con el rol solicitado."""

    idRol: int


class SolicitudAccesoRechazar(BaseModel):
    motivoRechazo: str = Field(min_length=1)
