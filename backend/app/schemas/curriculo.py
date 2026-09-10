"""Esquemas para importar contenido curricular (competencias + resultados
de aprendizaje) desde el "Formato Planeación Pedagógica" real de SENA --
ver PLAN_INTEGRACION_IA.md. Distinto del asistente de fichas: esto es a
nivel de Programa (se sube una vez por programa), no por ficha."""

from pydantic import BaseModel


class ResultadoExtraido(BaseModel):
    descripcion: str
    horasAsignadas: int | None = None


class CompetenciaExtraida(BaseModel):
    descripcion: str
    resultados: list[ResultadoExtraido]


class PreviewCurriculoResponse(BaseModel):
    nombreArchivo: str
    hoja: str
    competencias: list[CompetenciaExtraida]
    totalCompetencias: int
    totalResultados: int
