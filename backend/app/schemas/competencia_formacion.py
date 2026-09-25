from pydantic import BaseModel, ConfigDict

from app.schemas.especialidad import EspecialidadResponse


class CompetenciaFormacionBase(BaseModel):
    codigo: str | None = None
    descripcion: str
    idPrograma: int


class CompetenciaFormacionCreate(CompetenciaFormacionBase):
    pass


class CompetenciaFormacionUpdate(CompetenciaFormacionBase):
    pass


class CompetenciaFormacionResponse(CompetenciaFormacionBase):
    model_config = ConfigDict(from_attributes=True)

    idCompetencia: int
    # Fortalezas que habilitan a un instructor para dictar esta
    # competencia. Vacío = sin clasificar (y entonces la validación de
    # fortalezas no dice nada sobre sus resultados).
    especialidades: list[EspecialidadResponse] = []


class CompetenciaEspecialidadesUpdate(BaseModel):
    """Reemplaza de una el conjunto de fortalezas de la competencia — la
    UI manda la lista completa de checkboxes marcados, no un alta/baja por
    especialidad, porque así no hay estados intermedios raros si alguien
    marca y desmarca varias antes de guardar."""

    idsEspecialidades: list[int]
