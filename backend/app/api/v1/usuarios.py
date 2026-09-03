from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.supabase_auth import (
    get_current_user,
    require_admin,
    require_admin_o_coordinador,
    require_lectura_catalogo,
)
from app.models.usuario import Usuario
from app.schemas.horario import HorarioResponse
from app.schemas.usuario import (
    CargaSemanalResponse,
    UsuarioCodigoInstructorRequest,
    UsuarioCodigoInstructorValidacionRequest,
    UsuarioLoginDocumentoRequest,
    UsuarioLoginDocumentoResponse,
    UsuarioResponse,
)
from app.services.auditoria_service import AuditoriaService
from app.services.horario_service import HorarioService
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("/me", response_model=UsuarioResponse)
def obtener_mi_perfil(usuario: Usuario = Depends(get_current_user)):
    """Perfil del usuario autenticado — confirma que Supabase Auth + la
    base de datos están conectados end-to-end."""
    return usuario


@router.post("/login-documento", response_model=UsuarioLoginDocumentoResponse)
def iniciar_sesion_por_documento(data: UsuarioLoginDocumentoRequest, db: Session = Depends(get_db)):
    """Autentica documento y contraseña sin exponer el email asociado."""
    identificador = data.numeroDocumento.strip()
    estado = AuditoriaService.verificar_bloqueo(db, identificador)
    if estado["bloqueado"]:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Demasiados intentos. Inténtalo más tarde.")

    usuario = UsuarioService.obtener_por_numero_documento(db, identificador)
    respuesta = None
    if usuario:
        try:
            respuesta = httpx.post(
                f"{settings.supabase_url}/auth/v1/token?grant_type=password",
                headers={"apikey": settings.supabase_anon_key},
                json={"email": usuario.email, "password": data.password},
                timeout=10,
            )
        except httpx.HTTPError:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Servicio de autenticación no disponible.") from None

    if respuesta is None or respuesta.status_code != 200:
        AuditoriaService.registrar_login_fallido(db, identificador)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas.")

    datos = respuesta.json()
    return {
        "access_token": datos["access_token"],
        "refresh_token": datos["refresh_token"],
        "token_type": datos.get("token_type", "bearer"),
        "expires_in": datos.get("expires_in"),
    }


@router.get("/me/horarios", response_model=list[HorarioResponse])
def obtener_mis_horarios(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    """Autoservicio para "Mi horario" (pedido 2026-09-03) — a diferencia de
    GET /{id}/horarios (Coordinador/Administrador viendo A OTRO), acá
    cualquier usuario autenticado puede pedir SUS PROPIOS horarios, sin
    importar el rol — no hace falta `require_lectura_catalogo`, el alcance
    ya está limitado a `usuario.idUsuario` (nunca a un id que venga del
    request). Solo devuelve lo publicado — un instructor no debe ver un
    borrador que el coordinador todavía está armando."""
    return HorarioService.obtener_publicados_por_instructor(db, usuario.idUsuario)


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


@router.get("/{id_usuario}/horarios", response_model=list[HorarioResponse])
def obtener_horarios_instructor(
    id_usuario: UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_lectura_catalogo),
):
    """Horarios asignados a un instructor — alimenta la mini-grid semanal
    del drawer de relacionados en Instructores.tsx (SCRUM-46)."""
    if not UsuarioService.obtener_por_id(db, id_usuario):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return HorarioService.obtener_por_instructor(db, id_usuario)


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
