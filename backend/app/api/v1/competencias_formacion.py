from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo_o_instructor
from app.schemas.competencia_formacion import (
    CompetenciaFormacionCreate,
    CompetenciaFormacionResponse,
    CompetenciaFormacionUpdate,
)
from app.services.competencia_formacion_service import CompetenciaFormacionService

router = APIRouter(prefix="/competencias-formacion", tags=["competencias-formacion"])


@router.post("/", response_model=CompetenciaFormacionResponse)
def crear_competencia(
    data: CompetenciaFormacionCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return CompetenciaFormacionService.crear(db, data)


@router.get("/", response_model=list[CompetenciaFormacionResponse])
def obtener_competencias(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    return CompetenciaFormacionService.obtener_todos(db)


@router.get("/{id_competencia}", response_model=CompetenciaFormacionResponse)
def obtener_competencia(
    id_competencia: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo_o_instructor),
):
    competencia = CompetenciaFormacionService.obtener_por_id(db, id_competencia)

    if not competencia:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")

    return competencia


@router.put("/{id_competencia}", response_model=CompetenciaFormacionResponse)
def actualizar_competencia(
    id_competencia: int,
    data: CompetenciaFormacionUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    competencia = CompetenciaFormacionService.actualizar(db, id_competencia, data)

    if not competencia:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")

    return competencia


@router.delete("/{id_competencia}")
def eliminar_competencia(
    id_competencia: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = CompetenciaFormacionService.eliminar(db, id_competencia)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Competencia no encontrada")

    return {"mensaje": "Competencia eliminada"}
