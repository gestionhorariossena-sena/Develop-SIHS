from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AvisoCreate(BaseModel):
    titulo: str
    cuerpo: str
    categoria: str
    idFicha: int | None = None
    idSede: int | None = None
    adjuntoUrl: str | None = None
    vigenteHasta: date | None = None


class AvisoUpdate(BaseModel):
    titulo: str
    cuerpo: str
    categoria: str
    idFicha: int | None = None
    idSede: int | None = None
    adjuntoUrl: str | None = None
    vigenteHasta: date | None = None


class AvisoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idAviso: int
    idUsuarioPublicador: UUID
    # Enriquecido por AvisoService/_a_response (mismo criterio que
    # HorarioService.a_response) para no obligar al frontend a resolver
    # el nombre del publicador con una llamada aparte.
    publicadorNombre: str | None = None
    titulo: str
    cuerpo: str
    categoria: str
    idFicha: int | None = None
    idSede: int | None = None
    adjuntoUrl: str | None = None
    fechaPublicacion: datetime
    vigenteHasta: date | None = None
