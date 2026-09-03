from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.coordinacion import CoordinacionCreate, CoordinacionResponse, CoordinacionUpdate
from app.services.coordinacion_service import CoordinacionService

router = APIRouter(prefix="/coordinaciones", tags=["coordinaciones"])


@router.post("/", response_model=CoordinacionResponse)
def crear_coordinacion(
    data: CoordinacionCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return CoordinacionService.crear(db, data)


@router.get("/", response_model=list[CoordinacionResponse])
def obtener_coordinaciones(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    return CoordinacionService.obtener_todos(db)


@router.get("/{id_coordinacion}", response_model=CoordinacionResponse)
def obtener_coordinacion(
    id_coordinacion: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    coordinacion = CoordinacionService.obtener_por_id(db, id_coordinacion)

    if not coordinacion:
        raise HTTPException(status_code=404, detail="Coordinación no encontrada")

    return coordinacion


@router.put("/{id_coordinacion}", response_model=CoordinacionResponse)
def actualizar_coordinacion(
    id_coordinacion: int,
    data: CoordinacionUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    coordinacion = CoordinacionService.actualizar(db, id_coordinacion, data)

    if not coordinacion:
        raise HTTPException(status_code=404, detail="Coordinación no encontrada")

    return coordinacion


@router.delete("/{id_coordinacion}")
def eliminar_coordinacion(
    id_coordinacion: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = CoordinacionService.eliminar(db, id_coordinacion)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Coordinación no encontrada")

    return {"mensaje": "Coordinación eliminada"}
