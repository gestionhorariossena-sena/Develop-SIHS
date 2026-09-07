from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user
from app.schemas.notificacion import NotificacionResponse
from app.services.notificacion_service import NotificacionService

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


@router.get("/", response_model=list[NotificacionResponse])
def obtener_notificaciones(
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    return NotificacionService.obtener_por_usuario(db, usuario.idUsuario)


@router.patch("/marcar-todas-leidas")
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    cantidad = NotificacionService.marcar_todas_leidas(
        db,
        usuario.idUsuario,
    )

    return {
        "mensaje": "Notificaciones marcadas como leídas",
        "cantidad": cantidad,
    }


@router.patch("/{id_notificacion}/leida", response_model=NotificacionResponse)
def marcar_notificacion_leida(
    id_notificacion: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    notificacion = NotificacionService.marcar_leida(
        db,
        id_notificacion,
        usuario.idUsuario,
    )

    if notificacion is None:
        raise HTTPException(
            status_code=404,
            detail="Notificación no encontrada",
        )

    return notificacion