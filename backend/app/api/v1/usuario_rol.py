from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import require_admin
from app.schemas.usuario_rol import UsuarioRolCreate, UsuarioRolResponse
from app.services.auditoria_service import AuditoriaService
from app.services.usuario_rol_service import UsuarioRolService

router = APIRouter(prefix="/usuario-rol", tags=["usuario-rol"])


@router.post("/asignar")
def asignar_rol(
    data: UsuarioRolCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    resultado = UsuarioRolService.asignar(db, data.idUsuario, data.idRol)

    if resultado == "USUARIO_NO_EXISTE":
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if resultado == "ROL_NO_EXISTE":
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    if resultado == "YA_EXISTE":
        raise HTTPException(status_code=400, detail="El usuario ya tiene ese rol")

    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="ASIGNAR_ROL",
        entidad="usuarios",
        id_entidad=data.idUsuario,
        detalle=f"idRol={data.idRol}",
    )

    return {"mensaje": "Rol asignado correctamente"}


@router.delete("/remover")
def remover_rol(
    data: UsuarioRolCreate,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    eliminado = UsuarioRolService.remover(db, data.idUsuario, data.idRol)

    if not eliminado:
        raise HTTPException(status_code=404, detail="Relación no encontrada")

    AuditoriaService.registrar(
        db,
        usuario=usuario,
        accion="REMOVER_ROL",
        entidad="usuarios",
        id_entidad=data.idUsuario,
        detalle=f"idRol={data.idRol}",
    )

    return {"mensaje": "Rol removido correctamente"}


@router.get("/usuario/{id_usuario}", response_model=list[UsuarioRolResponse])
def obtener_roles_usuario(
    id_usuario: UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    roles = UsuarioRolService.obtener_roles_usuario(db, id_usuario)

    if roles is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return roles
