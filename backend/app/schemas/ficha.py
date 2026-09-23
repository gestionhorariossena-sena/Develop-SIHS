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
    faseActual: int | None = None


class FichaCreate(FichaBase):
    pass


class FichaUpdate(FichaBase):
    pass


class FichaFaseActualUpdate(BaseModel):
    """Payload mínimo para el botón "Actualizar fase" del asistente de
    programación (paso 2) -- a diferencia de FichaUpdate, no exige mandar
    codigoFicha/idPrograma/idTrimestre/etc. porque el wizard solo tiene
    a mano lo que vino del Excel, no la ficha completa como la carga la
    página Fichas."""

    faseActual: int


class FichaResponse(FichaBase):
    model_config = ConfigDict(from_attributes=True)

    idFicha: int
    programa: ProgramaResponse
    trimestre: TrimestreResponse
    sede: SedeResponse | None = None
    aprendicesTotales: int = 0
    jornadas: list[str] = []
