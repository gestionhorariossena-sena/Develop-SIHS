"""Crea (o reutiliza) una cuenta de Supabase Auth para cada correo dado y la
deja con el rol Administrador — bootstrap para el primer admin del sistema,
ya que POST /usuario-rol/asignar exige *ya* ser Administrador (require_admin
en app/core/supabase_auth.py) y no hay forma de asignarlo desde la app misma.

Uso:
    cd backend
    .venv/bin/python scripts/crear_admin.py --password 'Gestion-4532' \
        correo1@ejemplo.com correo2@ejemplo.com

Si el correo ya tiene cuenta en Supabase Auth, no se toca la contraseña —
solo se asegura que tenga fila en "usuarios" y el rol Administrador.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.services.supabase_admin_service import crear_o_recuperar_usuario_supabase as _crear_o_recuperar_usuario_supabase

ROL_ADMINISTRADOR = "Administrador"


def _asegurar_rol_administrador(db) -> Rol:
    rol = db.query(Rol).filter(Rol.nombre == ROL_ADMINISTRADOR).first()
    if rol:
        return rol
    rol = Rol(nombre=ROL_ADMINISTRADOR)
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


def promover_a_admin(email: str, password: str) -> str:
    usuario_supabase, creado = _crear_o_recuperar_usuario_supabase(email, password)
    id_usuario = usuario_supabase["id"]

    db = SessionLocal()
    try:
        rol_admin = _asegurar_rol_administrador(db)

        usuario = db.get(Usuario, id_usuario)
        if not usuario:
            usuario = Usuario(idUsuario=id_usuario, nombre=email.split("@")[0], email=email)
            db.add(usuario)
            db.commit()

        ya_tiene_rol = (
            db.query(UsuarioRol)
            .filter(UsuarioRol.idUsuario == id_usuario, UsuarioRol.idRol == rol_admin.idRol)
            .first()
        )
        if not ya_tiene_rol:
            db.add(UsuarioRol(idUsuario=id_usuario, idRol=rol_admin.idRol))
            db.commit()

        estado_cuenta = "cuenta creada" if creado else "cuenta ya existía"
        estado_rol = "rol asignado" if not ya_tiene_rol else "ya tenía el rol"
        return f"{email}: {estado_cuenta}, {estado_rol}"
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("emails", nargs="+", help="Correos a crear/promover como Administrador")
    parser.add_argument("--password", required=True, help="Contraseña para las cuentas nuevas")
    args = parser.parse_args()

    if not settings.supabase_service_role_key:
        sys.exit("Falta SUPABASE_SERVICE_ROLE_KEY en backend/.env")

    for email in args.emails:
        try:
            print(promover_a_admin(email, args.password))
        except Exception as exc:
            print(f"{email}: ERROR — {exc}")


if __name__ == "__main__":
    main()
