from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.rol import RolResponse


class SolicitudAccesoCreate(BaseModel):
    """Lo que manda "¿Eres coordinador? Solicita acceso" del registro
    (Registro.tsx) — público, sin sesión. `idRolSolicitado` es opcional
    porque ese formulario es específicamente para pedir Coordinador y no
    tiene selector de rol; el servicio resuelve el default."""

    nombre: str
    email: EmailStr
    numeroDocumento: str | None = None
    motivo: str
    idRolSolicitado: int | None = None


class SolicitudAccesoAprobar(BaseModel):
    """El Administrador confirma con qué rol entra la persona: el panel
    muestra el solicitado pero deja cambiarlo antes de aprobar."""

    idRol: int


class SolicitudAccesoRechazar(BaseModel):
    motivoRechazo: str


class SolicitudAccesoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idSolicitud: int
    nombre: str
    email: str
    numeroDocumento: str | None = None
    idRolSolicitado: int
    rolSolicitado: RolResponse
    motivo: str
    estado: str
    motivoRechazo: str | None = None
    fechaSolicitud: datetime
    fechaResolucion: datetime | None = None
    idAdminResolvio: UUID | None = None


class SolicitudAccesoAprobada(BaseModel):
    """Respuesta de aprobar. `passwordTemporal` viaja en la respuesta
    porque hoy el correo no sale: el SMTP del proyecto de Supabase sigue
    sin configurar (H-15 / SCRUM-129). Hasta entonces el Administrador
    necesita poder leerla para pasársela a la persona por otro medio —
    cuando ese correo funcione, este campo deja de tener razón de ser."""

    solicitud: SolicitudAccesoResponse
    email: str
    passwordTemporal: str | None = None
    correoEnviado: bool
