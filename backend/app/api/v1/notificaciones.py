from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user
from app.schemas.notificacion import NotificacionResponse, NotificacionesConteoResponse
from app.services.notificacion_service import NotificacionService

router = APIRouter(prefix="/notificaciones", tags=["notificaciones"])


@router.get("/", response_model=list[NotificacionResponse])
def obtener_notificaciones(
    solo_no_leidas: bool = Query(False, description="Solo las que aún no se han leído."),
    limite: int | None = Query(None, ge=1, le=200, description="Máximo de notificaciones, las más recientes primero."),
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    return NotificacionService.obtener_por_usuario(
        db,
        usuario.idUsuario,
        solo_no_leidas=solo_no_leidas,
        limite=limite,
    )


@router.get("/conteo-no-leidas", response_model=NotificacionesConteoResponse)
def contar_no_leidas(
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    return {"noLeidas": NotificacionService.contar_no_leidas(db, usuario.idUsuario)}


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

@router.delete("/{id_notificacion}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_notificacion(
    id_notificacion: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    if not NotificacionService.eliminar(db, id_notificacion, usuario.idUsuario):
        raise HTTPException(
            status_code=404,
            detail="Notificación no encontrada",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
