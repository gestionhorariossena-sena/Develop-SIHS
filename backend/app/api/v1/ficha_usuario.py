from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_aprendiz
from app.models.usuario import Usuario
from app.schemas.ficha import FichaResponse
from app.schemas.ficha_usuario import FichaUsuarioVincular
from app.schemas.horario import HorarioResponse
from app.services.ficha_usuario_service import FichaUsuarioService
from app.services.horario_service import HorarioService

router = APIRouter(prefix="/ficha-usuario", tags=["ficha-usuario"])


@router.post("/vincular", response_model=FichaResponse)
def vincular_ficha(
    data: FichaUsuarioVincular,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    resultado = FichaUsuarioService.vincular(db, usuario.idUsuario, data.codigoFicha)

    if resultado == "FICHA_NO_EXISTE":
        raise HTTPException(status_code=404, detail="No existe una ficha con ese código")

    if resultado == "YA_VINCULADO":
        raise HTTPException(status_code=400, detail="Ya tienes una ficha vinculada")

    return resultado


@router.get("/mi-ficha", response_model=FichaResponse)
def obtener_mi_ficha(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    ficha = FichaUsuarioService.obtener_mi_ficha(db, usuario.idUsuario)

    if not ficha:
        raise HTTPException(status_code=404, detail="No tienes una ficha vinculada")

    return ficha


@router.get("/mi-horario", response_model=list[HorarioResponse])
def obtener_mi_horario(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    """Grilla semanal real de MiHorarioAprendiz.tsx: todos los horarios de
    la ficha vinculada del Aprendiz, con el mismo shape enriquecido
    (instructorNombre/fichaCodigo/ambienteNombre/resultado...) que ya usa
    GET /horarios/ para Coordinador/Administrador -- ver
    HorarioService.a_response."""
    horarios = FichaUsuarioService.obtener_mi_horario(db, usuario.idUsuario)

    if horarios is None:
        raise HTTPException(status_code=404, detail="No tienes una ficha vinculada")

    return [HorarioService.a_response(db, h) for h in horarios]
