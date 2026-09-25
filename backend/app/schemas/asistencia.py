from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# Los cuatro que acepta la columna `estado`. Literal y no Enum de Postgres,
# mismo criterio que el resto del proyecto (ver Notificacion.tipo).
EstadoAsistencia = Literal["presente", "tardanza", "excusa", "ausente"]


class AprendizDeSesion(BaseModel):
    """Una fila de la lista que el instructor marca. `estado` viene en null
    cuando todavía no se le pasó lista a esa persona ese día — el cliente lo
    muestra como "sin marcar", que no es lo mismo que "ausente"."""

    idUsuario: UUID
    nombre: str
    numeroDocumento: str | None = None
    rolEnFicha: str | None = None

    estado: EstadoAsistencia | None = None
    horaMarcacion: datetime | None = None
    referenciaExcusa: str | None = None


class SesionAsistencia(BaseModel):
    """Todo lo que la pantalla de pasar lista necesita de una sesión."""

    idHorario: int
    fechaSesion: date
    fichaCodigo: str | None = None
    resultadoDescripcion: str | None = None
    ambienteNombre: str | None = None
    horaInicio: time
    horaFin: time

    aprendices: list[AprendizDeSesion]

    # Cuándo y quién pasó lista por última vez. null = sesión sin registrar.
    registradaEn: datetime | None = None
    registradaPor: str | None = None


class MarcaAsistencia(BaseModel):
    idUsuarioAprendiz: UUID
    estado: EstadoAsistencia
    referenciaExcusa: str | None = None


class RegistroAsistencia(BaseModel):
    """La lista completa de una sesión, no marca por marca: pasar lista es
    un acto único y así el servidor puede reemplazar lo que hubiera."""

    idHorario: int
    fechaSesion: date
    marcas: list[MarcaAsistencia]


class AsistenciaDeAprendiz(BaseModel):
    """Una fila del historial del aprendiz."""

    model_config = ConfigDict(from_attributes=True)

    idAsistencia: int
    idHorario: int
    fechaSesion: date
    estado: EstadoAsistencia
    referenciaExcusa: str | None = None

    resultadoDescripcion: str | None = None
    instructorNombre: str | None = None
    ambienteNombre: str | None = None
    horaInicio: time
    horaFin: time


class ResumenAsistencia(BaseModel):
    """Las cifras del encabezado. `porcentaje` es sobre sesiones
    REGISTRADAS, no sobre las programadas del trimestre: el sistema solo
    sabe de las clases a las que alguien le pasó lista."""

    registradas: int
    presente: int
    tardanza: int
    excusa: int
    ausente: int
    porcentaje: float


class MiAsistencia(BaseModel):
    resumen: ResumenAsistencia
    sesiones: list[AsistenciaDeAprendiz]
