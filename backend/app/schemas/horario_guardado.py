from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


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

    @field_validator("idsHorarios", mode="before")
    @classmethod
    def _null_como_lista_vacia(cls, valor):
        # La columna es nullable (snapshots creados antes de que existiera
        # este campo tienen NULL en la BD) — sin este validator,
        # HorarioGuardadoResponse rechazaba esas filas con
        # ResponseValidationError ("Input should be a valid list") y
        # tumbaba TODO el endpoint GET /horarios-guardados/ con 500 (bug
        # reportado 2026-09-02: en Historial de horarios solo cargaban los
        # horarios individuales, nunca los "completos").
        return valor if valor is not None else []


class HorarioGuardadoCreate(HorarioGuardadoBase):
    pass


class HorarioGuardadoResponse(HorarioGuardadoBase):
    model_config = ConfigDict(from_attributes=True)

    idHorarioGuardado: int
    idUsuario: UUID
    creadorNombre: str | None = None
    fechaCreacion: datetime
