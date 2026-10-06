from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.trimestre import TrimestreCreate, TrimestreResponse, TrimestreUpdate
from app.services.trimestre_service import TrimestreService

router = APIRouter(prefix="/trimestres", tags=["trimestres"])


@router.post("/", response_model=TrimestreResponse)
def crear_trimestre(
    data: TrimestreCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return TrimestreService.crear(db, data)


@router.get("/", response_model=list[TrimestreResponse])
def obtener_trimestres(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    return TrimestreService.obtener_todos(db)


@router.get("/{id_trimestre}", response_model=TrimestreResponse)
def obtener_trimestre(
    id_trimestre: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    trimestre = TrimestreService.obtener_por_id(db, id_trimestre)

    if not trimestre:
        raise HTTPException(status_code=404, detail="Período académico no encontrado")

    return trimestre


@router.put("/{id_trimestre}", response_model=TrimestreResponse)
def actualizar_trimestre(
    id_trimestre: int,
    data: TrimestreUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    trimestre = TrimestreService.actualizar(db, id_trimestre, data)

    if not trimestre:
        raise HTTPException(status_code=404, detail="Período académico no encontrado")

    return trimestre


@router.delete("/{id_trimestre}")
def eliminar_trimestre(
    id_trimestre: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = TrimestreService.eliminar(db, id_trimestre)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Período académico no encontrado")

    return {"mensaje": "Período académico eliminado"}
