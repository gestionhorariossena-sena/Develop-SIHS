from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user, require_admin, require_lectura_catalogo, require_lectura_catalogo_o_instructor
from app.schemas.ficha import FichaCreate, FichaResponse, FichaUpdate
from app.schemas.ficha_usuario import VoceroResponse
from app.schemas.horario import HorarioResponse
from app.services.auditoria_service import AuditoriaService
from app.services.ficha_service import FichaService
from app.services.ficha_usuario_service import FichaUsuarioService
from app.services.horario_service import HorarioService

router = APIRouter(prefix="/fichas", tags=["fichas"])


@router.post("/", response_model=FichaResponse)
def crear_ficha(
    data: FichaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    ficha = FichaService.crear(db, data)
    AuditoriaService.registrar(db, usuario=usuario, accion="CREAR", entidad="fichas", id_entidad=ficha.idFicha)
    return ficha


@router.get("/", response_model=list[FichaResponse])
def obtener_fichas(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    return FichaService.obtener_todos(db)


@router.get("/{id_ficha}", response_model=FichaResponse)
def obtener_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    ficha = FichaService.obtener_por_id(db, id_ficha)

    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    return ficha


@router.get("/{id_ficha}/horarios", response_model=list[HorarioResponse])
def obtener_horarios_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    """Horarios de una ficha — alimenta el grid semanal del drawer de
    relacionados en Fichas.tsx (SCRUM-47)."""
    if not FichaService.obtener_por_id(db, id_ficha):
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    return HorarioService.obtener_por_ficha(db, id_ficha)


@router.get("/{id_ficha}/vocero", response_model=list[VoceroResponse])
def obtener_vocero_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    """SCRUM-108: vocero/subvocero de una ficha (nombre + correo), para el
    "Vocero de Ficha" del drawer de instructor y el botón "Contactar" en Mi
    Horario del aprendiz. Abierto a cualquier usuario autenticado — no es
    dato sensible, y tanto instructor como aprendiz necesitan verlo sin
    tener rol de gestión (require_lectura_catalogo los excluiría a ambos)."""
    if not FichaService.obtener_por_id(db, id_ficha):
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    return FichaUsuarioService.obtener_voceros(db, id_ficha)


@router.put("/{id_ficha}", response_model=FichaResponse)
def actualizar_ficha(
    id_ficha: int,
    data: FichaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    ficha = FichaService.actualizar(db, id_ficha, data)

    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    AuditoriaService.registrar(db, usuario=usuario, accion="ACTUALIZAR", entidad="fichas", id_entidad=id_ficha)

    return ficha


@router.delete("/{id_ficha}")
def eliminar_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = FichaService.eliminar(db, id_ficha)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    AuditoriaService.registrar(db, usuario=usuario, accion="ELIMINAR", entidad="fichas", id_entidad=id_ficha)

    return {"mensaje": "Ficha eliminada"}
