"""SCRUM-112 — decisión de arquitectura: mecanismo de envío de la
credencial temporal por correo al aprobar una solicitud de acceso
(mockup "Protocolo de Seguridad" / "Flujo al Aprobar" de
`panel_de_administracion_sihs_sena/code.html`).

Decisión: **opción 1 del ticket — reutilizar la Admin API de Supabase**,
no enviar el correo a mano con `smtplib` (opción 2). Motivo: cero código
de envío de correo que mantener/probar en este backend — el mismo patrón
ya está probado en `backend/scripts/crear_admin.py` (crea/reutiliza una
cuenta de Supabase Auth vía `POST /auth/v1/admin/users` con
`apikey`/`Authorization: Bearer {supabase_service_role_key}`), así que
este servicio solo repite esa llamada con una contraseña generada por
nosotros en vez de una fija.

**Dependencia pendiente, fuera de alcance de este ticket**: el envío
REAL del correo en español, desde la cuenta de Gmail de gestión, depende
de que el SMTP personalizado quede configurado en el Dashboard de
Supabase (Authentication → SMTP Settings) — eso es SCRUM-129, que es
configuración manual del dashboard, no código, así que no tiene PR.
Mientras esa configuración no exista, Supabase sigue mandando (si manda
algo) con su remitente/plantilla por defecto en inglés. Este servicio no
necesita que SCRUM-129 esté resuelto para funcionar — crea la cuenta y la
contraseña igual — pero el resultado (`passwordTemporal`) no le llega
todavía a la persona por el canal que pide el mockup hasta que esa
configuración exista. Quien invoque este servicio (el endpoint de
aprobación de solicitudes de acceso, que es otro ticket del mismo Epic,
no este) decide qué hacer con ese valor mientras tanto.
"""

import secrets

import httpx

from app.core.config import settings
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol


def _headers() -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def _buscar_usuario_supabase_por_email(email: str) -> dict | None:
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


def _crear_o_recuperar_usuario_supabase(email: str, password: str) -> dict:
    respuesta = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers=_headers(),
        json={"email": email, "password": password, "email_confirm": True},
        timeout=15,
    )

    if respuesta.status_code in (200, 201):
        return respuesta.json()

    existente = _buscar_usuario_supabase_por_email(email)
    if existente:
        return existente

    respuesta.raise_for_status()
    raise RuntimeError(f"No se pudo crear ni encontrar el usuario de Supabase para {email}")


class CredencialTemporalService:
    @staticmethod
    def crear_cuenta_con_clave_temporal(db, *, email: str, nombre: str, id_rol: int) -> dict:
        password_temporal = secrets.token_urlsafe(9)

        usuario_supabase = _crear_o_recuperar_usuario_supabase(email, password_temporal)
        id_usuario = usuario_supabase["id"]

        usuario = db.get(Usuario, id_usuario)
        if not usuario:
            usuario = Usuario(idUsuario=id_usuario, nombre=nombre, email=email, debeCambiarClave=True)
            db.add(usuario)
            db.commit()
            db.refresh(usuario)

        ya_tiene_rol = (
            db.query(UsuarioRol)
            .filter(UsuarioRol.idUsuario == id_usuario, UsuarioRol.idRol == id_rol)
            .first()
        )
        if not ya_tiene_rol:
            db.add(UsuarioRol(idUsuario=id_usuario, idRol=id_rol))
            db.commit()

        return {
            "email": email,
            "passwordTemporal": password_temporal,
            "idUsuario": id_usuario,
        }
