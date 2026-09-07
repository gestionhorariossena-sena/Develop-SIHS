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
    titulo: str
    cuerpo: str
    categoria: str
    idFicha: int | None = None
    idSede: int | None = None
    adjuntoUrl: str | None = None
    fechaPublicacion: datetime
    vigenteHasta: date | None = None
