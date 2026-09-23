"""Crea 2 cuentas reales de Supabase Auth (instructor + aprendiz) para que
el coordinador pueda entrar como cada rol y ver "Mi Horario" -- pedido
explícito 2026-09-14 tras la demo del Asistente de Programación.

Mismo patrón que crear_admin.py (API admin de Supabase Auth con
service_role_key), pero deja el rol Instructor/Aprendiz en vez de
Administrador, y además:
  - Reasigna UNO de los horarios ya creados por el asistente (idInstructor)
    a la cuenta de instructor nueva, para que "Mi Horario" no aparezca
    vacío la primera vez que entra.
  - Vincula la cuenta de aprendiz a la MISMA ficha de ese horario
    (FichaUsuario), para cuando exista la vista "Mi Horario" del aprendiz
    (hoy en el PR #87, sin mergear).

No reutiliza usuarios YA EXISTENTES sin cuenta real (ej. instructores
importados del Excel con email placeholder ...sin-cuenta.local): Supabase
Auth siempre asigna su propio UUID al crear una cuenta, y no coincide con
el idUsuario ya guardado en la tabla "usuarios" de esos registros -- forzar
que coincidan requeriría la API admin con un parámetro de id explícito,
que quedó bloqueado por el clasificador de seguridad del harness al
probarlo en vivo. En cambio, esto crea cuentas NUEVAS y punto.

Uso:
    cd backend
    .venv/bin/python scripts/crear_cuentas_prueba.py

Imprime al final el email + password de cada cuenta -- guárdalos, no
quedan en ningún otro lado.
"""

import secrets
import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import httpx

from app.main import app  # noqa: F401 -- registra todos los modelos declarativos antes de usarlos
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol

# Ficha 3171618 (idFicha=21) -- una de las 4 usadas en la demo del
# asistente el 2026-09-14, ya tiene un horario creado por el generador.
ID_FICHA_DEMO = 21
EMAIL_INSTRUCTOR = "instructor.demo@sihs-pruebas.com"
EMAIL_APRENDIZ = "aprendiz.demo@sihs-pruebas.com"
DOCUMENTO_INSTRUCTOR = "1000900001"
DOCUMENTO_APRENDIZ = "1000900002"


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
    for u in respuesta.json().get("users", []):
        if u.get("email", "").lower() == email.lower():
            return u
    return None


def _crear_o_recuperar_cuenta_auth(email: str, password: str) -> tuple[str, bool]:
    """Devuelve (id_auth, fue_creada_ahora). Si ya existe, actualiza su
    password a la generada en esta corrida (para que la que se reporte al
    final sea la que de verdad funciona)."""
    respuesta = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers=_headers(),
        json={"email": email, "password": password, "email_confirm": True},
        timeout=15,
    )
    if respuesta.status_code in (200, 201):
        return respuesta.json()["id"], True

    existente = _buscar_usuario_supabase_por_email(email)
    if existente:
        httpx.put(
            f"{settings.supabase_url}/auth/v1/admin/users/{existente['id']}",
            headers=_headers(),
            json={"password": password},
            timeout=15,
        ).raise_for_status()
        return existente["id"], False

    respuesta.raise_for_status()
    raise RuntimeError(f"No se pudo crear ni encontrar la cuenta de Supabase para {email}")


def _asegurar_fila_usuario(db, id_auth: str, nombre: str, email: str, documento: str, rol_nombre: str) -> Usuario:
    rol = db.query(Rol).filter(Rol.nombre == rol_nombre).first()
    if not rol:
        raise RuntimeError(f"Rol '{rol_nombre}' no existe en la BD")

    usuario = db.get(Usuario, id_auth)
    if not usuario:
        usuario = Usuario(idUsuario=id_auth, nombre=nombre, email=email, numeroDocumento=documento, estado="activo")
        db.add(usuario)
    else:
        usuario.email = email
        usuario.numeroDocumento = documento
    db.commit()
    db.refresh(usuario)

    ya_tiene_rol = db.query(UsuarioRol).filter(UsuarioRol.idUsuario == usuario.idUsuario, UsuarioRol.idRol == rol.idRol).first()
    if not ya_tiene_rol:
        db.add(UsuarioRol(idUsuario=usuario.idUsuario, idRol=rol.idRol))
        db.commit()
    return usuario


def main() -> None:
    if not settings.supabase_service_role_key:
        sys.exit("Falta SUPABASE_SERVICE_ROLE_KEY en backend/.env")

    password_instructor = secrets.token_urlsafe(9)
    password_aprendiz = secrets.token_urlsafe(9)

    id_auth_instructor, creado_instructor = _crear_o_recuperar_cuenta_auth(EMAIL_INSTRUCTOR, password_instructor)
    id_auth_aprendiz, creado_aprendiz = _crear_o_recuperar_cuenta_auth(EMAIL_APRENDIZ, password_aprendiz)

    db = SessionLocal()
    try:
        instructor = _asegurar_fila_usuario(
            db, id_auth_instructor, "Instructor de Prueba", EMAIL_INSTRUCTOR, DOCUMENTO_INSTRUCTOR, "Instructor"
        )
        aprendiz = _asegurar_fila_usuario(
            db, id_auth_aprendiz, "Aprendiz de Prueba", EMAIL_APRENDIZ, DOCUMENTO_APRENDIZ, "Aprendiz"
        )

        # Reasigna UN horario real (ya creado por el asistente) al
        # instructor de prueba, para que "Mi Horario" no aparezca vacío.
        horario = (
            db.query(Horario)
            .filter(Horario.idFicha == ID_FICHA_DEMO, Horario.activo.is_(True))
            .order_by(Horario.idHorario.desc())
            .first()
        )
        if horario:
            horario.idInstructor = instructor.idUsuario
            db.commit()

        vinculo = db.get(FichaUsuario, {"idFicha": ID_FICHA_DEMO, "idUsuario": aprendiz.idUsuario})
        if not vinculo:
            db.add(FichaUsuario(idFicha=ID_FICHA_DEMO, idUsuario=aprendiz.idUsuario, rolEnFicha=None))
            db.commit()

        print("=" * 60)
        print(f"INSTRUCTOR ({'cuenta creada' if creado_instructor else 'cuenta ya existía, password actualizada'}):")
        print(f"  Documento: {DOCUMENTO_INSTRUCTOR}")
        print(f"  Email: {EMAIL_INSTRUCTOR}")
        print(f"  Password: {password_instructor}")
        if horario:
            print(f"  Horario asignado: #{horario.idHorario} (ficha idFicha={ID_FICHA_DEMO}, {horario.horaInicio})")
        else:
            print(f"  (No se encontró ningún horario activo para idFicha={ID_FICHA_DEMO} -- 'Mi Horario' saldrá vacío)")
        print()
        print(f"APRENDIZ ({'cuenta creada' if creado_aprendiz else 'cuenta ya existía, password actualizada'}):")
        print(f"  Documento: {DOCUMENTO_APRENDIZ}")
        print(f"  Email: {EMAIL_APRENDIZ}")
        print(f"  Password: {password_aprendiz}")
        print(f"  Vinculado a idFicha={ID_FICHA_DEMO} (misma ficha del horario de arriba)")
        print("=" * 60)
        print("Login: pantalla de inicio de sesión, campo 'correo institucional o número de documento'")
        print("       con cualquiera de los dos documentos + su password.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
