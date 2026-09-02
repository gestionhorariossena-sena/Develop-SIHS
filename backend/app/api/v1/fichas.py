from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.ficha import FichaCreate, FichaResponse, FichaUpdate
from app.services.auditoria_service import AuditoriaService
from app.services.ficha_service import FichaService

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
    usuario=Depends(require_lectura_catalogo),
):
    return FichaService.obtener_todos(db)


@router.get("/{id_ficha}", response_model=FichaResponse)
def obtener_ficha(
    id_ficha: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    ficha = FichaService.obtener_por_id(db, id_ficha)

    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha no encontrada")

    return ficha


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
