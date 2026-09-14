from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user, require_role
from app.schemas.mensajeria import (
    ConversacionCrear,
    ConversacionResponse,
    MensajeCrear,
    MensajeResponse,
)
from app.services.mensajeria_service import ConversacionNoPermitidaError, MensajeriaService

router = APIRouter(prefix="/mensajeria", tags=["mensajeria"])


@router.get("/conversaciones", response_model=list[ConversacionResponse])
def obtener_conversaciones(
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    return MensajeriaService.obtener_conversaciones_de_usuario(db, usuario.idUsuario)


@router.post("/conversaciones", response_model=ConversacionResponse, status_code=201)
def crear_conversacion(
    data: ConversacionCrear,
    db: Session = Depends(get_db),
    usuario=Depends(require_role("Aprendiz")),
):
    try:
        return MensajeriaService.obtener_o_crear_conversacion(db, usuario.idUsuario, data.idInstructor)
    except ConversacionNoPermitidaError:
        raise HTTPException(
            status_code=403,
            detail="Ese instructor no dicta clase a tu ficha — no podés iniciar una conversación con él.",
        )


@router.get("/conversaciones/{id_conversacion}/mensajes", response_model=list[MensajeResponse])
def obtener_mensajes(
    id_conversacion: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    mensajes = MensajeriaService.obtener_mensajes(db, id_conversacion, usuario.idUsuario)
    if mensajes is None:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return mensajes


@router.post("/conversaciones/{id_conversacion}/mensajes", response_model=MensajeResponse, status_code=201)
def enviar_mensaje(
    id_conversacion: int,
    data: MensajeCrear,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    mensaje = MensajeriaService.enviar_mensaje(
        db, id_conversacion, usuario.idUsuario, data.contenido, data.adjuntoUrl
    )
    if mensaje is None:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return mensaje


@router.patch("/mensajes/{id_mensaje}/leido", response_model=MensajeResponse)
def marcar_leido(
    id_mensaje: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    mensaje = MensajeriaService.marcar_leido(db, id_mensaje, usuario.idUsuario)
    if mensaje is None:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    return mensaje
