"""Esquemas de validación para respuestas de IA. Requisito 12 de
_Docs/Arquitectura/Arquitectura_IA_Motor_Horarios.md: las respuestas del
LLM son JSON estructurado y SIEMPRE se validan con Pydantic antes de
tocar cualquier dato real — si el LLM devuelve algo que no calza con
estos modelos, `model_validate` truena aquí, no silenciosamente más
adelante en un servicio de negocio."""

from pydantic import BaseModel, Field, RootModel


class ClasificacionColumna(BaseModel):
    # None cuando el encabezado no corresponde a ningún campo conocido de
    # SIHS -- la IA debe poder decir "no sé", no forzar una clasificación.
    campo: str | None
    confianza: float = Field(ge=0.0, le=1.0)


class ClasificacionColumnas(RootModel[dict[str, ClasificacionColumna]]):
    """Encabezado original de Excel -> clasificación. Ej.:
    {"JORNADA": {"campo": "jornada", "confianza": 1.0}}"""
