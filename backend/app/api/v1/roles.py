from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin, require_lectura_catalogo
from app.schemas.rol import RolCreate, RolResponse, RolUpdate
from app.services.rol_service import RolService

router = APIRouter(prefix="/roles", tags=["roles"])


@router.post("/", response_model=RolResponse)
def crear_rol(
    data: RolCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    return RolService.crear(db, data)


@router.get("/", response_model=list[RolResponse])
def obtener_roles(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    return RolService.obtener_todos(db)


@router.get("/{id_rol}", response_model=RolResponse)
def obtener_rol(
    id_rol: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    rol = RolService.obtener_por_id(db, id_rol)

    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    return rol


@router.put("/{id_rol}", response_model=RolResponse)
def actualizar_rol(
    id_rol: int,
    data: RolUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    rol = RolService.actualizar(db, id_rol, data)

    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    return rol


@router.delete("/{id_rol}")
def eliminar_rol(
    id_rol: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = RolService.eliminar(db, id_rol)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    return {"mensaje": "Rol eliminado"}
