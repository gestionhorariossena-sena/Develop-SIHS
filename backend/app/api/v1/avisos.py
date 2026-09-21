from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import get_current_user, require_admin_o_coordinador
from app.schemas.aviso import AvisoCreate, AvisoResponse, AvisoUpdate
from app.services.aviso_service import AvisoService

router = APIRouter(prefix="/avisos", tags=["avisos"])


@router.post("/", response_model=AvisoResponse)
def crear_aviso(
    data: AvisoCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin_o_coordinador),
):
    return AvisoService.crear(db, data, usuario.idUsuario)


@router.get("/", response_model=list[AvisoResponse])
def obtener_avisos(
    categoria: str | None = None,
    idFicha: int | None = None,
    db: Session = Depends(get_db),
    usuario=Depends(get_current_user),
):
    return AvisoService.obtener_todos(db, categoria=categoria, id_ficha=idFicha)


@router.put("/{id_aviso}", response_model=AvisoResponse)
def actualizar_aviso(
    id_aviso: int,
    data: AvisoUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin_o_coordinador),
):
    aviso = AvisoService.actualizar(db, id_aviso, data)

    if not aviso:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")

    return aviso


@router.delete("/{id_aviso}")
def eliminar_aviso(
    id_aviso: int,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin_o_coordinador),
):
    eliminado = AvisoService.eliminar(db, id_aviso)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")

    return {"mensaje": "Aviso eliminado"}
