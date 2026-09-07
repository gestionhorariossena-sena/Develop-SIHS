from uuid import UUID

from pydantic import BaseModel


class FichaUsuarioVincular(BaseModel):
    codigoFicha: str


class VoceroResponse(BaseModel):
    """SCRUM-108 — GET /fichas/{id_ficha}/vocero."""

    idUsuario: UUID
    nombre: str
    email: str
    rolEnFicha: str
