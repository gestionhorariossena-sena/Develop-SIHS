from pydantic import BaseModel, ConfigDict


class ResultadoAprendizajeBase(BaseModel):
    codigo: str | None = None
    descripcion: str
    idCompetencia: int
    idGuia: int | None = None
    horasAsignadas: int | None = None
    numeroFase: int | None = None


class ResultadoAprendizajeCreate(ResultadoAprendizajeBase):
    pass


class ResultadoAprendizajeUpdate(ResultadoAprendizajeBase):
    pass


class ResultadoAprendizajeResponse(ResultadoAprendizajeBase):
    model_config = ConfigDict(from_attributes=True)

    idResultado: int
