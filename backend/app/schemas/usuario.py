from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.especialidad import EspecialidadResponse
from app.schemas.rol import RolResponse


class UsuarioCodigoInstructorRequest(BaseModel):
    idUsuario: UUID


class UsuarioCodigoInstructorValidacionRequest(BaseModel):
    codigo: str


class UsuarioLoginDocumentoRequest(BaseModel):
    numeroDocumento: str
    password: str


class UsuarioLoginDocumentoResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int | None = None


class UsuarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idUsuario: UUID
    nombre: str
    # `str`, no `EmailStr` -- este es un modelo de RESPUESTA (lectura de lo
    # que ya existe en BD), no de entrada, así que validar formato acá no
    # protege nada. Instructores/ambientes importados sin cuenta real usan
    # un placeholder deliberado con dominio ".local" (ej.
    # "juan@instructores.sihs.sin-cuenta.local") para dejar claro que no
    # tienen login -- pydantic-email-validator rechaza ".local" por ser un
    # TLD de uso especial/reservado (RFC 6761), no por ser inválido como
    # identificador. Con EmailStr, CUALQUIER endpoint que liste usuarios
    # (GET /usuarios/, y todo lo que dependa de él: Vista por Instructor,
    # el buscador de instructores del asistente, etc.) tronaba con 500 en
    # cuanto la lista incluía uno de estos usuarios -- encontrado en vivo
    # el 2026-09-14, bloqueaba "Vista por Instructor" por completo.
    email: str
    estado: str
    fechaRegistro: datetime
    # Solo aplica a instructores — nullable, ver
    # _Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md §2.2.
    tipoContrato: str | None = None
    horasContratadasSemana: int | None = None
    codigoInstructor: str | None = None
    idTrimestre: int | None = None
    sigla: str | None = None
    debeCambiarClave: bool = False
    roles: list[RolResponse] = []
    especialidades: list[EspecialidadResponse] = []


class CargaSemanalResponse(BaseModel):
    """GET /usuarios/{id}/carga-semanal — horas ya asignadas vs. el tope
    de RF-011, para la sección "Carga semanal" del drawer de instructor.
    horasMaximas es None cuando el usuario no tiene tipoContrato definido
    (no se puede calcular un tope sin saber si es planta o contrato)."""

    idUsuario: UUID
    tipoContrato: str | None
    horasAsignadas: float
    horasMaximas: int | None
