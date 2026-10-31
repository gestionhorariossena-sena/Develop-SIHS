from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_aprendiz
from app.models.usuario import Usuario
from app.schemas.ficha import FichaResponse
from app.schemas.ficha_usuario import FichaUsuarioVincular, MiRolFichaResponse
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


@router.get("/mi-rol", response_model=MiRolFichaResponse)
def obtener_mi_rol(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    """Mensajes/Mis instructores (MensajesAprendiz.tsx): solo el
    vocero/subvocero puede abrir conversaciones nuevas -- el resto ve el
    directorio en solo lectura. None si no tiene ficha vinculada (no es un
    error, simplemente no puede escribir todavía)."""
    return MiRolFichaResponse(rolEnFicha=FichaUsuarioService.obtener_mi_rol_en_ficha(db, usuario.idUsuario))


@router.get("/mi-horario", response_model=list[HorarioResponse])
def obtener_mi_horario(
    idTrimestre: int | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_aprendiz),
):
    """Grilla semanal real de MiHorarioAprendiz.tsx: todos los horarios de
    la ficha vinculada del Aprendiz, con el mismo shape enriquecido
    (instructorNombre/fichaCodigo/ambienteNombre/resultado...) que ya usa
    GET /horarios/ para Coordinador/Administrador -- ver
    HorarioService.a_response.

    `idTrimestre` es opcional: sin él, mantiene el comportamiento de
    siempre (solo responde algo si la ficha está en el trimestre vigente).
    Con él, se usa para que el Aprendiz pueda ver un trimestre histórico
    específico de su propia ficha (selector de Trimestre en la UI) -- los
    horarios ya traen su propio idTrimestre, independiente del que tenga
    la ficha ahora mismo."""
    horarios = FichaUsuarioService.obtener_mi_horario(db, usuario.idUsuario, id_trimestre=idTrimestre)

    if horarios is None:
        raise HTTPException(status_code=404, detail="No tienes una ficha vinculada")

    return [HorarioService.a_response(db, h) for h in horarios]
