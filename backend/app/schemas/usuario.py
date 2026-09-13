from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.especialidad import EspecialidadResponse
from app.schemas.rol import RolResponse


class UsuarioCodigoInstructorRequest(BaseModel):
    idUsuario: UUID


class UsuarioCodigoInstructorValidacionRequest(BaseModel):
    codigo: str


class UsuarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    idUsuario: UUID
    nombre: str
    email: EmailStr
    estado: str
    fechaRegistro: datetime
    # Solo aplica a instructores — nullable, ver
    # _Docs/Documentación general/PLAN_INTEGRACION_LOGICA_Y_BD.md §2.2.
    tipoContrato: str | None = None
    horasContratadasSemana: int | None = None
    codigoInstructor: str | None = None
    roles: list[RolResponse] = []
    especialidades: list[EspecialidadResponse] = []
    # El atributo del modelo es snake_case a propósito (nombre exacto del
    # mockup panel_de_administracion_sihs_sena/code.html, ver
    # app/models/usuario.py) — el alias solo lo traduce a camelCase para
    # la API, que es la convención del resto de este schema. Lo consume
    # ProtectedRoute.tsx para forzar la pantalla de cambio de contraseña
    # obligatorio en el primer login con credencial temporal.
    debeCambiarClave: bool = Field(validation_alias="debe_cambiar_clave")


class CargaSemanalResponse(BaseModel):
    """GET /usuarios/{id}/carga-semanal — horas ya asignadas vs. el tope
    de RF-011, para la sección "Carga semanal" del drawer de instructor.
    horasMaximas es None cuando el usuario no tiene tipoContrato definido
    (no se puede calcular un tope sin saber si es planta o contrato)."""

    idUsuario: UUID
    tipoContrato: str | None
    horasAsignadas: float
    horasMaximas: int | None
