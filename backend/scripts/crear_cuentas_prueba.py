"""Deja el entorno de pruebas con **una cuenta real por rol** en Supabase
Auth (Coordinador + Instructor + Aprendiz) y repara los roles de las
cuentas de prueba históricas que los perdieron.

Nació el 2026-09-14 (pedido tras la demo del Asistente de Programación)
creando solo Instructor y Aprendiz. El 2026-09-24, al verificar el plan de
cierre de huecos (H-13), se encontró que `ana@mail.com` (documentada como
Coordinador) y `carlos@mail.com` (Instructor) tenían la lista de roles
vacía contra la base compartida: sin una cuenta de Coordinador funcional no
se puede probar el rol para el que se construyó el sistema. Por eso ahora:

  - Crea también `coordinador.demo@sihs-pruebas.com`.
  - Reasigna el rol documentado a las cuentas de `database/02_datos_prueba.sql`
    (ana/carlos/juan/maria) que estén sin ninguno. Es idempotente y no toca
    sus contraseñas: si la cuenta no existe en la BD, la salta.

Mismo patrón que crear_admin.py (API admin de Supabase Auth con
service_role_key), y además:
  - Reasigna UNO de los horarios ya creados por el asistente (idInstructor)
    a la cuenta de instructor nueva, para que "Mi Horario" no aparezca
    vacío la primera vez que entra.
  - Vincula la cuenta de aprendiz a la MISMA ficha de ese horario
    (FichaUsuario), para que "Mi Horario" del aprendiz tenga contenido.

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

# (email, nombre, documento, rol) de las cuentas demo que crea este script.
# El orden es el de la salida final.
CUENTAS_DEMO = [
    ("coordinador.demo@sihs-pruebas.com", "Coordinador de Prueba", "1000900003", "Coordinador"),
    ("instructor.demo@sihs-pruebas.com", "Instructor de Prueba", "1000900001", "Instructor"),
    ("aprendiz.demo@sihs-pruebas.com", "Aprendiz de Prueba", "1000900002", "Aprendiz"),
]

# Cuentas de database/02_datos_prueba.sql y el rol que ese script les da.
# Se les repone si quedaron sin ninguno (H-13).
ROLES_CUENTAS_HISTORICAS = {
    "ana@mail.com": "Coordinador",
    "carlos@mail.com": "Instructor",
    "juan@mail.com": "Aprendiz",
    "maria@mail.com": "Aprendiz",
}


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


def _reponer_roles_historicos(db) -> list[str]:
    """Le devuelve su rol documentado a las cuentas de
    database/02_datos_prueba.sql que quedaron con la lista vacía. No toca a
    las que ya tienen alguno: si alguien se lo cambió a propósito, manda esa
    decisión y no este script."""
    reparadas = []
    for email, rol_nombre in ROLES_CUENTAS_HISTORICAS.items():
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
        if not usuario:
            continue
        if db.query(UsuarioRol).filter(UsuarioRol.idUsuario == usuario.idUsuario).first():
            continue
        rol = db.query(Rol).filter(Rol.nombre == rol_nombre).first()
        if not rol:
            raise RuntimeError(f"Rol '{rol_nombre}' no existe en la BD")
        db.add(UsuarioRol(idUsuario=usuario.idUsuario, idRol=rol.idRol))
        db.commit()
        reparadas.append(f"{email} -> {rol_nombre}")
    return reparadas


def main() -> None:
    if not settings.supabase_service_role_key:
        sys.exit("Falta SUPABASE_SERVICE_ROLE_KEY en backend/.env")

    passwords = {email: secrets.token_urlsafe(9) for email, _, _, _ in CUENTAS_DEMO}
    cuentas_auth = {
        email: _crear_o_recuperar_cuenta_auth(email, passwords[email])
        for email, _, _, _ in CUENTAS_DEMO
    }

    db = SessionLocal()
    try:
        usuarios = {}
        for email, nombre, documento, rol_nombre in CUENTAS_DEMO:
            id_auth, _ = cuentas_auth[email]
            usuarios[email] = _asegurar_fila_usuario(db, id_auth, nombre, email, documento, rol_nombre)

        instructor = usuarios["instructor.demo@sihs-pruebas.com"]
        aprendiz = usuarios["aprendiz.demo@sihs-pruebas.com"]

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

        reparadas = _reponer_roles_historicos(db)

        print("=" * 60)
        for email, _, documento, rol_nombre in CUENTAS_DEMO:
            _, fue_creada = cuentas_auth[email]
            estado = "cuenta creada" if fue_creada else "cuenta ya existía, password actualizada"
            print(f"{rol_nombre.upper()} ({estado}):")
            print(f"  Documento: {documento}")
            print(f"  Email: {email}")
            print(f"  Password: {passwords[email]}")
            if rol_nombre == "Instructor":
                if horario:
                    print(f"  Horario asignado: #{horario.idHorario} (idFicha={ID_FICHA_DEMO}, {horario.horaInicio})")
                else:
                    print(f"  (Sin horario activo para idFicha={ID_FICHA_DEMO} -- 'Mi Horario' saldrá vacío)")
            if rol_nombre == "Aprendiz":
                print(f"  Vinculado a idFicha={ID_FICHA_DEMO} (misma ficha del horario de arriba)")
            print()
        print("=" * 60)
        if reparadas:
            print("Roles repuestos a cuentas de database/02_datos_prueba.sql (password 'Prueba123!'):")
            for linea in reparadas:
                print(f"  {linea}")
        else:
            print("Cuentas de database/02_datos_prueba.sql: ninguna estaba sin rol.")
        print("=" * 60)
        print("Login: pantalla de inicio de sesión, campo 'correo institucional o número de documento'")
        print("       con cualquiera de los documentos de arriba + su password.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
