from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.especialidad import (
    EspecialidadCreate,
    EspecialidadResponse,
    EspecialidadUpdate,
)
from app.services.especialidad_service import EspecialidadService

router = APIRouter(prefix="/especialidades", tags=["especialidades"])


@router.post("/", response_model=EspecialidadResponse)
def crear_especialidad(
    data: EspecialidadCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return EspecialidadService.crear(db, data)


@router.get("/", response_model=list[EspecialidadResponse])
def obtener_especialidades(
    db: Session = Depends(get_db),
    # T-27 (SCRUM-142): igual que el resto de catálogos (jornadas, programas,
    # sedes, trimestres...) -- un Coordinador necesita leer este catálogo
    # para poder usar PUT /usuarios/{id}/especialidades (ver el comentario
    # ahí: "Es coordinación quien las conoce y las mantiene"). Antes exigía
    # require_admin y un Coordinador no podía ni listar los IDs válidos.
    usuario=Depends(require_lectura_catalogo),
):
    return EspecialidadService.obtener_todos(db)


@router.get("/{id_especialidad}", response_model=EspecialidadResponse)
def obtener_especialidad(
    id_especialidad: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    especialidad = EspecialidadService.obtener_por_id(db, id_especialidad)

    if not especialidad:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")

    return especialidad


@router.put("/{id_especialidad}", response_model=EspecialidadResponse)
def actualizar_especialidad(
    id_especialidad: int,
    data: EspecialidadUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    especialidad = EspecialidadService.actualizar(db, id_especialidad, data)

    if not especialidad:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")

    return especialidad


@router.delete("/{id_especialidad}")
def eliminar_especialidad(
    id_especialidad: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = EspecialidadService.eliminar(db, id_especialidad)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Especialidad no encontrada")

    return {"mensaje": "Especialidad eliminada"}