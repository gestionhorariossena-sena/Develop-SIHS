from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_role, require_roles
from app.schemas.solicitud_cambio_horario import (
    SolicitudCambioHorarioCreate,
    SolicitudCambioHorarioResolver,
    SolicitudCambioHorarioResponse,
)
from app.services.solicitud_cambio_horario_service import SolicitudCambioHorarioService

router = APIRouter(prefix="/solicitudes-cambio-horario", tags=["solicitudes-cambio-horario"])


@router.post("/", response_model=SolicitudCambioHorarioResponse, status_code=201)
def crear_solicitud(
    data: SolicitudCambioHorarioCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_role("Instructor")),
):
    solicitud = SolicitudCambioHorarioService.crear(db, usuario.idUsuario, data)
    if not solicitud:
        raise HTTPException(status_code=404, detail="El horario indicado no existe o no te pertenece")
    return solicitud


@router.get("/mias", response_model=list[SolicitudCambioHorarioResponse])
def obtener_mias(
    db: Session = Depends(get_db),
    usuario=Depends(require_role("Instructor")),
):
    return SolicitudCambioHorarioService.obtener_mias(db, usuario.idUsuario)


@router.get("/", response_model=list[SolicitudCambioHorarioResponse])
def obtener_todas(
    estado: str | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario=Depends(require_roles("Coordinador", "Administrador")),
):
    return SolicitudCambioHorarioService.obtener_todas(db, estado)


@router.patch("/{id_solicitud}/resolver", response_model=SolicitudCambioHorarioResponse)
def resolver_solicitud(
    id_solicitud: int,
    data: SolicitudCambioHorarioResolver,
    db: Session = Depends(get_db),
    usuario=Depends(require_roles("Coordinador", "Administrador")),
):
    try:
        solicitud = SolicitudCambioHorarioService.resolver(db, id_solicitud, usuario.idUsuario, data.estado)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return solicitud
