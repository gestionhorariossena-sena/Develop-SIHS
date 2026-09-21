from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.programa import ProgramaCreate, ProgramaResponse, ProgramaUpdate
from app.services.programa_service import ProgramaService

router = APIRouter(prefix="/programas", tags=["programas"])


@router.post("/", response_model=ProgramaResponse)
def crear_programa(
    data: ProgramaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return ProgramaService.crear(db, data)


@router.get("/", response_model=list[ProgramaResponse])
def obtener_programas(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    return ProgramaService.obtener_todos(db)


@router.get("/{id_programa}", response_model=ProgramaResponse)
def obtener_programa(
    id_programa: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    programa = ProgramaService.obtener_por_id(db, id_programa)

    if not programa:
        raise HTTPException(status_code=404, detail="Programa no encontrado")

    return programa


@router.put("/{id_programa}", response_model=ProgramaResponse)
def actualizar_programa(
    id_programa: int,
    data: ProgramaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    programa = ProgramaService.actualizar(db, id_programa, data)

    if not programa:
        raise HTTPException(status_code=404, detail="Programa no encontrado")

    return programa


@router.delete("/{id_programa}")
def eliminar_programa(
    id_programa: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = ProgramaService.eliminar(db, id_programa)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Programa no encontrado")

    return {"mensaje": "Programa eliminado"}
