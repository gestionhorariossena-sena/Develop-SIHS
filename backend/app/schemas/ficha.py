from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.programa import ProgramaResponse
from app.schemas.sede import SedeResponse
from app.schemas.trimestre import TrimestreResponse


class FichaBase(BaseModel):
    codigoFicha: str
    idPrograma: int
    idTrimestre: int
    idSede: int | None = None
    fechaInicioLectiva: date | None = None
    fechaFinLectiva: date | None = None
    fechaInicioProductiva: date | None = None
    fechaFinProductiva: date | None = None


class FichaCreate(FichaBase):
    pass


class FichaUpdate(FichaBase):
    pass


class FichaResponse(FichaBase):
    model_config = ConfigDict(from_attributes=True)

    idFicha: int
    programa: ProgramaResponse
    trimestre: TrimestreResponse
    sede: SedeResponse | None = None
    aprendicesTotales: int = 0
    jornadas: list[str] = []
