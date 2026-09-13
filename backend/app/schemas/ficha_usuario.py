from uuid import UUID

from pydantic import BaseModel


class FichaUsuarioVincular(BaseModel):
    codigoFicha: str


class VoceroResponse(BaseModel):
    """GET /fichas/{id_ficha}/vocero — quién es el vocero/subvocero de una
    ficha. No cubre mensajería (Epic "Vistas del Aprendiz", pantalla
    "Mensajería de Instructores"), solo expone quién es."""

    idUsuario: UUID
    nombre: str
    email: str
    rolEnFicha: str
