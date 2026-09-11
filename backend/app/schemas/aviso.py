from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

CategoriaAviso = Literal["reprog", "eventos", "sede", "extraordinario"]


class AvisoBase(BaseModel):
    titulo: str
    cuerpo: str
    categoria: CategoriaAviso
    idFicha: int | None = None
    idSede: int | None = None
    adjuntoUrl: str | None = None
    vigenteHasta: datetime | None = None


class AvisoCreate(AvisoBase):
    pass


class AvisoUpdate(AvisoBase):
    pass


class AvisoResponse(AvisoBase):
    model_config = ConfigDict(from_attributes=True)

    idAviso: int
    idUsuarioPublicador: UUID | None = None
    fechaPublicacion: datetime
    publicadorNombre: str | None = None
