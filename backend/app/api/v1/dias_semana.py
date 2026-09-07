from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo_o_instructor
from app.schemas.dia_semana import DiaSemanaCreate, DiaSemanaResponse, DiaSemanaUpdate
from app.services.dia_semana_service import DiaSemanaService

router = APIRouter(prefix="/dias-semana", tags=["dias-semana"])


@router.post("/", response_model=DiaSemanaResponse)
def crear_dia(
    data: DiaSemanaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return DiaSemanaService.crear(db, data)


@router.get("/", response_model=list[DiaSemanaResponse])
def obtener_dias(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    return DiaSemanaService.obtener_todos(db)


@router.get("/{id_dia}", response_model=DiaSemanaResponse)
def obtener_dia(
    id_dia: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    dia = DiaSemanaService.obtener_por_id(db, id_dia)

    if not dia:
        raise HTTPException(status_code=404, detail="Día no encontrado")

    return dia


@router.put("/{id_dia}", response_model=DiaSemanaResponse)
def actualizar_dia(
    id_dia: int,
    data: DiaSemanaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    dia = DiaSemanaService.actualizar(db, id_dia, data)

    if not dia:
        raise HTTPException(status_code=404, detail="Día no encontrado")

    return dia


@router.delete("/{id_dia}")
def eliminar_dia(
    id_dia: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = DiaSemanaService.eliminar(db, id_dia)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Día no encontrado")

    return {"mensaje": "Día eliminado"}