from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TipoAmbiente(str, Enum):
    REGULAR = "regular"
    ESPECIAL = "especial"


class EstadoAmbiente(str, Enum):
    DISPONIBLE = "disponible"
    MANTENIMIENTO = "mantenimiento"
    INACTIVO = "inactivo"


class AmbienteBase(BaseModel):
    numero_ambiente: int = Field(gt=0, alias="numeroAmbiente")
    nombre: str = Field(min_length=1, max_length=100, alias="nombreAmbiente")
    tipo_ambiente: TipoAmbiente = Field(alias="tipoAmbiente")
    estado_ambiente: EstadoAmbiente = Field(default=EstadoAmbiente.DISPONIBLE, alias="estadoAmbiente")
    sede_id: int = Field(gt=0, alias="idSede")
    piso: str | None = Field(default=None)
    capacidad: int | None = Field(default=None, gt=0)
    especialidad_sala: str | None = Field(default=None, alias="especialidadSala")
    responsable_llaves: str | None = Field(default=None, alias="responsableLlaves")

    model_config = ConfigDict(populate_by_name=True)


class AmbienteCreate(AmbienteBase):
    pass


class AmbienteUpdate(AmbienteBase):
    pass


class AmbienteResponse(AmbienteBase):
    id: int = Field(alias="idAmbiente")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
