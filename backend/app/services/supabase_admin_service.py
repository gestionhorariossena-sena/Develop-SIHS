"""Punto único para crear/reutilizar una cuenta de Supabase Auth vía la
Admin REST API (`{supabase_url}/auth/v1/admin/users`, autenticada con
`supabase_service_role_key`). Reusado por `scripts/crear_admin.py`
(bootstrap del primer Administrador) y por `SolicitudAccesoService.aprobar`
(alta de usuarios aprobados en el Panel de Administración) -- un solo
lugar que mantener/probar para esta llamada sensible, en vez de dos
copias divergentes."""

import httpx

from app.core.config import settings


def _headers() -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def buscar_usuario_supabase_por_email(email: str) -> dict | None:
    respuesta = httpx.get(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers=_headers(),
        params={"page": 1, "per_page": 1000},
        timeout=15,
    )
    respuesta.raise_for_status()
    for usuario in respuesta.json().get("users", []):
        if usuario.get("email", "").lower() == email.lower():
            return usuario
    return None


def crear_o_recuperar_usuario_supabase(email: str, password: str) -> tuple[dict, bool]:
    """Devuelve (usuario_supabase, fue_creado_ahora). Si el correo ya tiene
    cuenta, la reutiliza tal cual -- no le cambia la contraseña."""
    respuesta = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers=_headers(),
        json={"email": email, "password": password, "email_confirm": True},
        timeout=15,
    )

    if respuesta.status_code in (200, 201):
        return respuesta.json(), True

    existente = buscar_usuario_supabase_por_email(email)
    if existente:
        return existente, False

    respuesta.raise_for_status()
    raise RuntimeError(f"No se pudo crear ni encontrar el usuario de Supabase para {email}")
