"""Reverso puntual de reset_demo_asistente.py para UNA sola ficha: reactiva
(activo=True) los horarios que ese script desactivó, sin tocar ninguna otra
ficha ni borrar nada. Pedido explícito del usuario para poder revisar en el
navegador cómo se ve Mi Horario del Aprendiz con datos reales (no inventados).

Uso:
    .venv/bin/python reactivar_demo_ficha.py                 # dry-run
    .venv/bin/python reactivar_demo_ficha.py --confirmar      # aplica
    .venv/bin/python reactivar_demo_ficha.py --confirmar --ficha 3171618
"""

import argparse
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401
from app.core.database import SessionLocal
from app.models.ficha import Ficha
from app.models.horario import Horario


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmar", action="store_true", help="Sin esto, solo hace dry-run")
    parser.add_argument("--ficha", default="3407178", help="Código de ficha a reactivar (default 3407178)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        ficha = db.query(Ficha).filter(Ficha.codigoFicha == args.ficha).first()
        if not ficha:
            print(f"No existe la ficha {args.ficha}")
            return

        horarios = db.query(Horario).filter(Horario.idFicha == ficha.idFicha, Horario.activo.is_(False)).all()

        if not horarios:
            print(f"Nada que reactivar -- 0 horarios inactivos para la ficha {args.ficha}.")
            return

        print(f"{'REACTIVANDO' if args.confirmar else '(dry-run) Se reactivarían'} {len(horarios)} horario(s) de la ficha {args.ficha}:")
        for h in sorted(horarios, key=lambda x: (x.horaInicio, x.idInstructor)):
            print(f"  #{h.idHorario} instructor={h.idInstructor} {h.horaInicio}-{h.horaFin} idTrimestre={h.idTrimestre}")

        if not args.confirmar:
            print("\nEsto fue un dry-run. Vuelve a correr con --confirmar para aplicar de verdad.")
            return

        for h in horarios:
            h.activo = True
        db.commit()
        print("Listo.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
