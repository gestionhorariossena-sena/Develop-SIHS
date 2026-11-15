"""Cambia temporalmente el trimestre de UNA ficha de prueba al vigente, para
poder revisar en el navegador las pantallas del Aprendiz (Mi Horario, Mis
instructores, Inicio) con datos reales -- sin esto, `GET
/ficha-usuario/mi-horario` sin `idTrimestre` responde vacío porque la ficha
no coincide con el trimestre vigente (ver FichaUsuarioService.obtener_mi_horario).

No borra ni inventa nada: la ficha ya tenía 13 horarios reales y publicados
en su trimestre anterior, esto solo cambia a cuál trimestre dice pertenecer
la ficha. Reversible con --revertir.

Uso:
    .venv/bin/python mover_ficha_a_vigente.py                       # dry-run
    .venv/bin/python mover_ficha_a_vigente.py --confirmar            # aplica
    .venv/bin/python mover_ficha_a_vigente.py --confirmar --revertir # regresa al original
"""

import argparse
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401
from app.core.database import SessionLocal
from app.models.ficha import Ficha
from app.repositories.trimestre_repository import TrimestreRepository


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmar", action="store_true")
    parser.add_argument("--ficha", default="3407178")
    parser.add_argument("--revertir", type=int, help="idTrimestre original al que regresar")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        ficha = db.query(Ficha).filter(Ficha.codigoFicha == args.ficha).first()
        if not ficha:
            print(f"No existe la ficha {args.ficha}")
            return

        if args.revertir:
            print(f"Ficha {args.ficha}: idTrimestre {ficha.idTrimestre} -> {args.revertir}")
            if args.confirmar:
                ficha.idTrimestre = args.revertir
                db.commit()
                print("Listo.")
            else:
                print("(dry-run) Vuelve a correr con --confirmar para aplicar.")
            return

        vigente = TrimestreRepository.obtener_vigente(db)
        if not vigente:
            print("No hay trimestre vigente ahora mismo.")
            return

        print(f"Ficha {args.ficha}: idTrimestre {ficha.idTrimestre} ({ficha.idTrimestre}) -> {vigente.idTrimestre} ({vigente.nombre})")
        print(f"Para revertir: python mover_ficha_a_vigente.py --confirmar --revertir {ficha.idTrimestre}")

        if args.confirmar:
            ficha.idTrimestre = vigente.idTrimestre
            db.commit()
            print("Listo.")
        else:
            print("(dry-run) Vuelve a correr con --confirmar para aplicar.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
