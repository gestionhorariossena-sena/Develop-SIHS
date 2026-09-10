"""Esquemas del asistente de programación (wizard de 4 pasos del
frontend: subir archivo -> revisar -> generar propuesta -> confirmar).
Ver _Docs/Documentación general/PLAN_INTEGRACION_IA.md, Fase 4 y
siguientes. Separado de app/schemas/horario.py porque son formas de datos
específicas de este flujo, no del CRUD de `horarios`."""

from datetime import time

from pydantic import BaseModel


class ColumnaClasificada(BaseModel):
    columnaOriginal: str
    campo: str | None
    confianza: float


class FilaImportada(BaseModel):
    fila: int
    idFicha: int | None
    fichaExiste: bool
    programa: str | None
    jornada: str | None
    instructorNombre: str | None
    advertencia: str | None = None


class ImportarExcelPreviewResponse(BaseModel):
    nombreArchivo: str
    hoja: str
    filaEncabezado: int
    columnas: list[ColumnaClasificada]
    filas: list[FilaImportada]
    totalFilas: int
    filasConAdvertencia: int


class GenerarPropuestaRequest(BaseModel):
    idTrimestre: int
    idsFicha: list[int]
    # Simplificación del MVP (igual que app/scheduling/generator.py): una
    # sola jornada para todo el lote, no una por ficha todavía.
    jornada: str


class BloquePropuesto(BaseModel):
    idFicha: int
    fichaCodigo: str
    idResultado: int
    resultadoDescripcion: str
    idInstructor: str
    instructorNombre: str
    idAmbiente: int
    ambienteNombre: str
    idJornada: int
    dias: list[int]
    horaInicio: time
    horaFin: time


class GenerarPropuestaResponse(BaseModel):
    bloques: list[BloquePropuesto]
    factible: bool
    mensaje: str


class PreguntaHorarioRequest(BaseModel):
    pregunta: str
    # Texto libre armado por el frontend con el bloque/conflicto que el
    # coordinador está viendo -- igual de contexto que ya usa
    # prompt_resumir_auditoria, pero para una pregunta puntual.
    contexto: str
