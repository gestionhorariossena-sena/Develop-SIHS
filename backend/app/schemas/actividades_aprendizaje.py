from pydantic import BaseModel, ConfigDict


class ActividadAprendizajeBase(BaseModel):
    codigo: str | None = None
    descripcion: str
    tipoActividad: str | None = None
    duracionMinutos: int | None = None
    idResultado: int


class ActividadAprendizajeCreate(ActividadAprendizajeBase):
    pass


class ActividadAprendizajeUpdate(ActividadAprendizajeBase):
    pass


class ActividadAprendizajeResponse(ActividadAprendizajeBase):
    idActividad: int
    model_config = ConfigDict(from_attributes=True)
