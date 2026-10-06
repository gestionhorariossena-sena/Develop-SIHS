from pydantic import BaseModel

from app.schemas.especialidad import EspecialidadResponse


class TematicaResultadoResponse(BaseModel):
    """Un resultado de aprendizaje: es lo que el creador de horarios llama
    "Temática" de cada bloque."""

    idResultado: int
    codigo: str | None = None
    descripcion: str
    horasAsignadas: int | None = None
    numeroFase: int | None = None
    # Se devuelve para que editar desde la pestaña no la borre: el PUT de
    # /resultados-aprendizaje reemplaza todos los campos.
    idGuia: int | None = None
    # Bloques de horario que lo dictan. Mayor que cero = no se puede
    # borrar sin antes reasignar esos bloques.
    horariosAsignados: int = 0


class TematicaCompetenciaResponse(BaseModel):
    idCompetencia: int
    codigo: str | None = None
    descripcion: str
    idPrograma: int
    nombrePrograma: str | None = None
    especialidades: list[EspecialidadResponse] = []
    resultados: list[TematicaResultadoResponse] = []
    totalHoras: int = 0
