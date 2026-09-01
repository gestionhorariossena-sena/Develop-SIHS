from pydantic import BaseModel


class FichaUsuarioVincular(BaseModel):
    codigoFicha: str
