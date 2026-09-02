from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BloqueClaseSchema(BaseModel):
    """Espejo de BloqueClase (frontend/src/pages/horario/tipos.ts) — texto
    libre a propósito, ver horario_guardado.py."""

    id: str
    tematica: str
    instructor: str
    ficha: str
    ambiente: str


class HorarioGuardadoBase(BaseModel):
    ficha: str
    aprendices: str | None = None
    horasTrimestre: str | None = None
    fechaInicio: date | None = None
    fechaFin: date | None = None
    bloques: list[BloqueClaseSchema]
    # Espejo de GridAsignaciones: fila = bloque horario, columna = día,
    # valor = id de BloqueClase asignado a esa celda (o null si está vacía).
    grid: list[list[str | None]]
    # idHorario de cada fila real en `horarios` creada por este guardado —
    # ver comentario en el modelo. El frontend los junta a medida que cada
    # POST /horarios/ del batch responde con éxito.
    idsHorarios: list[int] = []


class HorarioGuardadoCreate(HorarioGuardadoBase):
    pass


class HorarioGuardadoResponse(HorarioGuardadoBase):
    model_config = ConfigDict(from_attributes=True)

    idHorarioGuardado: int
    idUsuario: UUID
    creadorNombre: str | None = None
    fechaCreacion: datetime
