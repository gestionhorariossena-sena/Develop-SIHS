from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_instructor, require_roles
from app.models.usuario import Usuario
from app.schemas.solicitud_cambio_horario import (
    SolicitudCambioHorarioAprobar,
    SolicitudCambioHorarioCreate,
    SolicitudCambioHorarioResponse,
)
from app.services.auditoria_service import AuditoriaService
from app.services.horario_service import CruceHorarioError
from app.services.solicitud_cambio_horario_service import SolicitudCambioHorarioService

router = APIRouter(prefix="/solicitudes-cambio-horario", tags=["solicitudes-cambio-horario"])

# Aprobar/rechazar es de Coordinación, no del propio instructor que la radica.
require_puede_resolver = require_roles("Coordinador", "Administrador")


def _con_instructor(solicitud):
    solicitud.instructorNombre = solicitud.instructor.nombre if solicitud.instructor else None
    return solicitud


@router.post("/", response_model=SolicitudCambioHorarioResponse, status_code=201)
def crear_solicitud(
    data: SolicitudCambioHorarioCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_instructor),
):
    resultado = SolicitudCambioHorarioService.crear(db, data, usuario)

    if resultado == "HORARIO_NO_EXISTE":
        raise HTTPException(status_code=404, detail="El horario indicado no existe")

    if resultado == "NO_ES_TU_HORARIO":
        raise HTTPException(status_code=403, detail="Solo puedes solicitar cambios sobre tus propios horarios")

    return _con_instructor(resultado)


@router.get("/", response_model=list[SolicitudCambioHorarioResponse])
def obtener_solicitudes(
    estado: str | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_resolver),
):
    return [_con_instructor(s) for s in SolicitudCambioHorarioService.obtener_todos(db, estado)]


@router.get("/mias", response_model=list[SolicitudCambioHorarioResponse])
def obtener_mis_solicitudes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_instructor),
):
    return [_con_instructor(s) for s in SolicitudCambioHorarioService.obtener_mias(db, usuario.idUsuario)]


@router.put("/{id_solicitud}/aprobar", response_model=SolicitudCambioHorarioResponse)
def aprobar_solicitud(
    id_solicitud: int,
    data: SolicitudCambioHorarioAprobar,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_resolver),
):
    try:
        solicitud, codigo_error, conflictos = SolicitudCambioHorarioService.aprobar(db, id_solicitud, data.cambios)
    except CruceHorarioError as error:
        raise HTTPException(status_code=409, detail={"mensajes": error.mensajes}) from error

    if codigo_error == "NO_ENCONTRADA":
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if codigo_error == "YA_RESUELTA":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    if codigo_error == "HORARIO_ORIGEN_INEXISTENTE":
        raise HTTPException(
            status_code=409, detail="El horario original ya no existe, no se puede aplicar el cambio"
        )

    detalle = "; ".join(conflictos) if conflictos else None
    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="APROBAR",
        entidad="solicitudes_cambio_horario",
        id_entidad=id_solicitud,
        detalle=detalle,
    )
    return _con_instructor(solicitud)


@router.put("/{id_solicitud}/rechazar", response_model=SolicitudCambioHorarioResponse)
def rechazar_solicitud(
    id_solicitud: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_puede_resolver),
):
    solicitud, codigo_error = SolicitudCambioHorarioService.rechazar(db, id_solicitud)

    if codigo_error == "NO_ENCONTRADA":
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    if codigo_error == "YA_RESUELTA":
        raise HTTPException(status_code=400, detail="La solicitud ya fue resuelta")

    AuditoriaService.registrar(
        db, usuario=usuario, accion="RECHAZAR", entidad="solicitudes_cambio_horario", id_entidad=id_solicitud
    )
    return _con_instructor(solicitud)
