import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.usuario import Usuario

security = HTTPBearer()


def _verificar_token_supabase(token: str) -> dict:
    """Valida el token contra Supabase Auth y devuelve los datos del usuario.

    No necesitamos el JWT secret del proyecto para esto: le preguntamos
    directamente a Supabase si el token es válido, igual que haría el
    frontend con supabase-js.
    """
    try:
        respuesta = httpx.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            },
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo validar el token con Supabase",
        ) from exc

    if respuesta.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    return respuesta.json()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Usuario:
    datos_supabase = _verificar_token_supabase(credentials.credentials)

    supabase_user_id = datos_supabase.get("id")
    email = datos_supabase.get("email")

    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    usuario = db.get(Usuario, supabase_user_id)

    if not usuario:
        # Primer request autenticado de este usuario: Supabase Auth ya lo
        # validó, pero todavía no tiene fila de perfil en "usuarios". La
        # creamos aquí para no obligar a un paso manual de registro aparte.
        usuario = Usuario(
            idUsuario=supabase_user_id,
            nombre=(email or "usuario").split("@")[0],
            email=email,
            numeroDocumento=(datos_supabase.get("user_metadata") or {}).get("numero_documento") or None,
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)

    return usuario


def require_role(role_name: str):
    def role_checker(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if not any(rol.nombre == role_name for rol in usuario.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado",
            )
        return usuario

    return role_checker


def require_roles(*roles_permitidos: str):
    def role_checker(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if not any(rol.nombre in roles_permitidos for rol in usuario.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado",
            )
        return usuario

    return role_checker


require_admin = require_role("Administrador")
require_coordinador = require_role("Coordinador")
require_admin_o_coordinador = require_roles("Administrador", "Coordinador")
require_instructor = require_role("Instructor")
require_aprendiz = require_role("Aprendiz")

# Lectura de catálogos que un Coordinador necesita para armar un horario
# (fichas, ambientes, instructores, resultados, jornadas, días, trimestres)
# — la escritura de esos catálogos sigue siendo solo de Administrador.
require_lectura_catalogo = require_roles("Coordinador", "Administrador")
