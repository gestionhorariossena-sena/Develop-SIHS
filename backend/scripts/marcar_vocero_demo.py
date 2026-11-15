"""Marca temporalmente a un aprendiz como vocero de su ficha, para poder
revisar en el navegador la pestaña "Mensajes" del subnav (solo visible para
vocero/subvocero, ver AppShell.tsx) y la bandeja de chat en /mensajes/chat.

No inventa nada nuevo: solo cambia `ficha_usuario.rolEnFicha` de ese vínculo
ya existente. Reversible con --revertir.

Uso:
    .venv/bin/python marcar_vocero_demo.py                          # dry-run
    .venv/bin/python marcar_vocero_demo.py --confirmar               # aplica
    .venv/bin/python marcar_vocero_demo.py --confirmar --revertir    # regresa a null
"""

import argparse
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401
from app.core.database import SessionLocal
from app.models.ficha_usuario import FichaUsuario


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmar", action="store_true")
    parser.add_argument("--usuario", default="b7fb6c88-6c47-4f12-8609-23d4bb29c7ef")
    parser.add_argument("--revertir", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        vinculo = db.query(FichaUsuario).filter(FichaUsuario.idUsuario == args.usuario).first()
        if not vinculo:
            print(f"No existe ficha_usuario para el usuario {args.usuario}")
            return

        nuevo = None if args.revertir else "vocero"
        print(f"ficha_usuario (ficha {vinculo.idFicha}, usuario {args.usuario}): rolEnFicha {vinculo.rolEnFicha!r} -> {nuevo!r}")

        if args.confirmar:
            vinculo.rolEnFicha = nuevo
            db.commit()
            print("Listo.")
        else:
            print("(dry-run) Vuelve a correr con --confirmar para aplicar.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
