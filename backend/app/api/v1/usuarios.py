from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.supabase_auth import (
    get_current_user,
    require_admin,
    require_admin_o_coordinador,
    require_lectura_catalogo,
)
from app.models.usuario import Usuario
from app.schemas.usuario import (
    CargaSemanalResponse,
    UsuarioCodigoInstructorRequest,
    UsuarioCodigoInstructorValidacionRequest,
    UsuarioResponse,
)
from app.services.horario_service import HorarioService
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("/me", response_model=UsuarioResponse)
def obtener_mi_perfil(usuario: Usuario = Depends(get_current_user)):
    """Perfil del usuario autenticado — confirma que Supabase Auth + la
    base de datos están conectados end-to-end."""
    return usuario


@router.get("/", response_model=list[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    return UsuarioService.listar_usuarios(db)


@router.get("/{id_usuario}", response_model=UsuarioResponse)
def obtener_usuario(
    id_usuario: UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin),
):
    encontrado = UsuarioService.obtener_por_id(db, id_usuario)

    if not encontrado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return encontrado


@router.get("/{id_usuario}/carga-semanal", response_model=CargaSemanalResponse)
def obtener_carga_semanal(
    id_usuario: UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    """Horas ya asignadas por semana vs. el tope de RF-011 — alimenta la
    sección "Carga semanal" del drawer de instructor en Instructores.tsx.
    No es un módulo "instructores" aparte (no existe en este backend, ver
    ESTRUCTURA.md) — un instructor es un Usuario con rol Instructor, así
    que vive bajo /usuarios como el resto de sus datos."""
    carga = HorarioService.calcular_carga_semanal(db, id_usuario)

    if carga is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return carga


@router.post("/instructor/codigo/generar")
def generar_codigo_instructor(
    data: UsuarioCodigoInstructorRequest,
    db: Session = Depends(get_db),
    usuario=Depends(require_admin_o_coordinador),
):
    generado = UsuarioService.generar_codigo_instructor(db, data.idUsuario)

    if generado is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return generado


@router.post("/instructor/codigo/validar")
def validar_codigo_instructor(
    data: UsuarioCodigoInstructorValidacionRequest,
    db: Session = Depends(get_db),
):
    return UsuarioService.validar_codigo_instructor(db, data.codigo)
