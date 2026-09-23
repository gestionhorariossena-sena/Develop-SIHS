import threading
import time

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.usuario import Usuario

security = HTTPBearer()

# Cachea la validación de cada token por unos segundos para no golpear el
# endpoint de Supabase Auth en cada request (dos páginas piden varios
# recursos en paralelo con Promise.all, y cada uno revalida el mismo token).
# El lock solo protege el dict en memoria (lectura/escritura), NO la llamada
# de red -- probado en vivo que mantenerlo tomado durante la llamada a
# Supabase serializa TODOS los requests autenticados de la app entre sí
# (una request pasó de ~400ms a ~10s por quedar en fila detrás de otras).
_TTL_CACHE_SEG = 30
_cache_tokens: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()

# La llamada a Supabase Auth es sobre la red real (no localhost) y a veces
# falla de forma transitoria (timeout, conexión reiniciada) sin que el token
# ni Supabase tengan ningún problema real -- reproducido en vivo el
# 2026-09-14 como un 503 intermitente en /ficha-usuario/mi-horario. Un
# reintento corto absorbe eso sin esconder errores persistentes.
_REINTENTOS = 2


def _verificar_token_supabase(token: str) -> dict:
    """Valida el token contra Supabase Auth y devuelve los datos del usuario.

    No necesitamos el JWT secret del proyecto para esto: le preguntamos
    directamente a Supabase si el token es válido, igual que haría el
    frontend con supabase-js. El resultado se cachea brevemente (ver
    _TTL_CACHE_SEG) para tolerar ráfagas de requests con el mismo token.
    """
    ahora = time.monotonic()

    with _cache_lock:
        entrada = _cache_tokens.get(token)
        if entrada and entrada[0] > ahora:
            return entrada[1]

    ultimo_error: httpx.HTTPError | None = None
    respuesta = None
    for intento in range(_REINTENTOS + 1):
        try:
            respuesta = httpx.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
                timeout=10,
            )
            break
        except httpx.HTTPError as exc:
            ultimo_error = exc
            respuesta = None

    if respuesta is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo validar el token con Supabase",
        ) from ultimo_error

    if respuesta.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    datos = respuesta.json()

    with _cache_lock:
        _cache_tokens[token] = (ahora + _TTL_CACHE_SEG, datos)
        if len(_cache_tokens) > 500:
            _cache_tokens.clear()

    return datos


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

# Igual que require_lectura_catalogo, pero también admite Instructor — para
# los catálogos de solo lectura (ficha, ambiente, resultado de aprendizaje,
# competencia, día) que un Instructor necesita para ver el DETALLE de SU
# PROPIA franja/sesión en "Detalle de Franja y Ambiente" (MiHorario.tsx →
# DetalleFranjaAmbiente.tsx). No amplía nada de escritura, ni endpoints que
# devuelvan el horario COMPLETO de otro instructor/ficha/ambiente (eso
# sigue siendo solo Coordinador/Administrador) — solo datos de catálogo
# (nombre, código, descripción) que no son sensibles.
require_lectura_catalogo_o_instructor = require_roles("Coordinador", "Administrador", "Instructor")
