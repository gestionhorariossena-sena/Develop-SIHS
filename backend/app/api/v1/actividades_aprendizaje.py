from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.actividades_aprendizaje import (
    ActividadAprendizajeCreate,
    ActividadAprendizajeResponse,
    ActividadAprendizajeUpdate,
)
from app.services.actividades_aprendizaje_service import ActividadAprendizajeService

router = APIRouter(prefix="/actividades-aprendizaje", tags=["actividades-aprendizaje"])


@router.post("/", response_model=ActividadAprendizajeResponse)
def crear_actividad(
    data: ActividadAprendizajeCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return ActividadAprendizajeService.crear(db, data)


@router.get("/", response_model=list[ActividadAprendizajeResponse])
def obtener_actividades(
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return ActividadAprendizajeService.obtener_todos(db)


@router.get("/resultado/{id_resultado}", response_model=list[ActividadAprendizajeResponse])
def obtener_actividades_por_resultado(
    id_resultado: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return ActividadAprendizajeService.obtener_por_resultado(db, id_resultado)


@router.get("/{id_actividad}", response_model=ActividadAprendizajeResponse)
def obtener_actividad(
    id_actividad: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    actividad = ActividadAprendizajeService.obtener_por_id(db, id_actividad)

    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad de aprendizaje no encontrada")

    return actividad


@router.put("/{id_actividad}", response_model=ActividadAprendizajeResponse)
def actualizar_actividad(
    id_actividad: int,
    data: ActividadAprendizajeUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    actividad = ActividadAprendizajeService.actualizar(db, id_actividad, data)

    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad de aprendizaje no encontrada")

    return actividad


@router.delete("/{id_actividad}")
def eliminar_actividad(
    id_actividad: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    resultado = ActividadAprendizajeService.eliminar(db, id_actividad)

    if not resultado:
        raise HTTPException(status_code=404, detail="Actividad de aprendizaje no encontrada")

    return {"mensaje": "Actividad de aprendizaje eliminada correctamente"}
