from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.solicitud_acceso import (
    SolicitudAccesoAprobada,
    SolicitudAccesoAprobar,
    SolicitudAccesoCreate,
    SolicitudAccesoRechazar,
    SolicitudAccesoResponse,
)
from app.services.solicitud_acceso_service import SolicitudAccesoError, SolicitudAccesoService

router = APIRouter(prefix="/solicitudes-acceso", tags=["solicitudes-acceso"])


@router.post("/", response_model=SolicitudAccesoResponse, status_code=201)
def crear_solicitud(data: SolicitudAccesoCreate, db: Session = Depends(get_db)):
    """Público a propósito: quien pide acceso todavía no tiene cuenta, así
    que no puede haber token. No crea nada en Supabase Auth — solo deja la
    solicitud en cola para que un Administrador la apruebe."""
    try:
        return SolicitudAccesoService.crear(db, data)
    except SolicitudAccesoError as exc:
        raise HTTPException(status_code=exc.estado_http, detail=str(exc)) from exc


@router.get("/", response_model=list[SolicitudAccesoResponse])
def obtener_solicitudes(
    estado: str | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return SolicitudAccesoService.obtener_todas(db, estado)


@router.post("/{id_solicitud}/aprobar", response_model=SolicitudAccesoAprobada)
def aprobar_solicitud(
    id_solicitud: int,
    data: SolicitudAccesoAprobar,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    """Crea la cuenta de Supabase Auth con el rol indicado y una clave
    temporal. Devuelve la clave porque todavía no sale ningún correo
    (H-15): hasta que el SMTP del proyecto exista, el Administrador es el
    canal."""
    try:
        return SolicitudAccesoService.aprobar(db, id_solicitud, usuario.idUsuario, data.idRol)
    except SolicitudAccesoError as exc:
        raise HTTPException(status_code=exc.estado_http, detail=str(exc)) from exc


@router.post("/{id_solicitud}/rechazar", response_model=SolicitudAccesoResponse)
def rechazar_solicitud(
    id_solicitud: int,
    data: SolicitudAccesoRechazar,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    try:
        return SolicitudAccesoService.rechazar(db, id_solicitud, usuario.idUsuario, data.motivoRechazo)
    except SolicitudAccesoError as exc:
        raise HTTPException(status_code=exc.estado_http, detail=str(exc)) from exc
