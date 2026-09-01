from pydantic import BaseModel, ConfigDict

from app.schemas.programa import ProgramaResponse
from app.schemas.trimestre import TrimestreResponse


class FichaBase(BaseModel):
    codigoFicha: str
    idPrograma: int
    idTrimestre: int


class FichaCreate(FichaBase):
    pass


class FichaUpdate(FichaBase):
    pass


class FichaResponse(FichaBase):
    model_config = ConfigDict(from_attributes=True)

    idFicha: int
    programa: ProgramaResponse
    trimestre: TrimestreResponse
    aprendicesTotales: int = 0
    jornadas: list[str] = []
