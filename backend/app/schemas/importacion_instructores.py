from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class InstructorImportadoPreview(BaseModel):
    fila: int
    documento: str
    nombre: str
    correo: str
    contrato: str
    horas: int
    especialidades: list[str]


class ErrorImportacionInstructor(BaseModel):
    fila: int
    mensaje: str


class PrevisualizacionImportacionInstructores(BaseModel):
    validos: list[InstructorImportadoPreview]
    errores: list[ErrorImportacionInstructor]


class ResultadoImportacionInstructores(BaseModel):
    creados: int
    existentes: int
    errores: list[ErrorImportacionInstructor]
    credencialesTemporales: list[dict[str, str]]
    idLote: UUID | None = None


class LoteImportacionInstructorResponse(BaseModel):
    idLote: UUID
    fechaCreacion: datetime
    creados: int


class ResultadoEliminacionLoteInstructores(BaseModel):
    eliminados: int
