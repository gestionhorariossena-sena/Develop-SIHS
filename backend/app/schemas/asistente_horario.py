"""Esquemas del asistente de programación (wizard de 4 pasos del
frontend: subir archivo -> revisar -> generar propuesta -> confirmar).
Ver _Docs/Documentación general/PLAN_INTEGRACION_IA.md, Fase 4 y
siguientes. Separado de app/schemas/horario.py porque son formas de datos
específicas de este flujo, no del CRUD de `horarios`."""

from datetime import date, time

from pydantic import BaseModel


class ColumnaClasificada(BaseModel):
    columnaOriginal: str
    campo: str | None
    confianza: float


class FilaImportada(BaseModel):
    fila: int
    # El número de ficha tal como viene en el Excel -- es codigoFicha
    # (texto, el número real de SENA), NO el idFicha interno de la BD
    # (SERIAL, autoincremental, sin relación con el número real).
    codigoFicha: str | None
    fichaExiste: bool
    # Solo se llena cuando fichaExiste=True -- el idFicha interno real,
    # necesario para /asistente/generar-propuesta.
    idFicha: int | None = None
    programa: str | None
    jornada: str | None
    instructorNombre: str | None
    advertencia: str | None = None
    # Se llenan solo si se sube un archivo complementario y trae estos
    # datos para la misma ficha (cruce por codigoFicha) -- LIDERES DE
    # FICHA no los trae, pero la hoja FICHAS de PROGRAMACIÓN CGMLTI sí.
    nivelFormacion: str | None = None
    coordinacion: str | None = None
    codigoPrograma: str | None = None
    fechaInicioLectiva: date | None = None
    fechaFinLectiva: date | None = None
    fechaFinProductiva: date | None = None
    # Fase actual del pénsum (1=TRIM I..4=TRIM IV) -- cruzada desde un
    # archivo complementario que la traiga (confirmado con el usuario:
    # la columna "TRI" de la hoja FICHAS de PROGRAMACIÓN CGMLTI es esto,
    # no la duración del programa). Ver PLAN_INTEGRACION_IA.md.
    faseActual: int | None = None


class ImportarExcelPreviewResponse(BaseModel):
    nombreArchivo: str
    hoja: str
    filaEncabezado: int
    columnas: list[ColumnaClasificada]
    filas: list[FilaImportada]
    totalFilas: int
    filasConAdvertencia: int
    # Se llena solo cuando NINGUNA fila trajo una ficha reconocible -- en
    # vez de que el coordinador tenga que inferirlo de 40 advertencias
    # idénticas fila por fila, se le dice la causa probable una sola vez.
    advertenciaGeneral: str | None = None
    # Nombre + hoja del archivo complementario, si se subió y se pudo
    # cruzar -- para que el frontend pueda mostrar "cruzado con: archivo.xlsx (hoja FICHAS)".
    archivoComplementario: str | None = None
    hojaComplementaria: str | None = None


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
