"""Crea 2 notas reales en "Organizador personal" (Mi Horario del Aprendiz),
usando el mismo flujo real (AnotacionHorarioService.crear) sobre horarios
reales de la ficha 3407178 -- no son datos inventados fuera de lugar, solo
contenido de ejemplo sobre clases que sí existen.

Reversible con --revertir (borra por idHorario+idUsuario).

Uso:
    .venv/bin/python crear_notas_demo.py                # dry-run
    .venv/bin/python crear_notas_demo.py --confirmar      # aplica
    .venv/bin/python crear_notas_demo.py --confirmar --revertir
"""

import argparse
import sys
import pathlib
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401
from app.core.database import SessionLocal
from app.models.anotacion_horario import AnotacionHorario
from app.schemas.anotacion_horario import AnotacionHorarioCreate
from app.services.anotacion_horario_service import AnotacionHorarioService

APRENDIZ = uuid.UUID("b7fb6c88-6c47-4f12-8609-23d4bb29c7ef")  # davidm20.05.2006+aprendiz1@gmail.com

NOTAS = [
    {
        "idHorario": 206,  # Martes, "Desarrollar procesos lógicos..."
        "nota": "Repasar los algoritmos vistos, traer calculadora para el examen.",
        "etiqueta": "Examen",
    },
    {
        "idHorario": 210,  # Viernes, "Establecer los requisitos..."
        "nota": "Entregar el documento de requisitos antes de la clase.",
        "etiqueta": "Entrega",
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmar", action="store_true")
    parser.add_argument("--revertir", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.revertir:
            ids_horario = [n["idHorario"] for n in NOTAS]
            filas = (
                db.query(AnotacionHorario)
                .filter(AnotacionHorario.idUsuario == APRENDIZ, AnotacionHorario.idHorario.in_(ids_horario))
                .all()
            )
            print(f"{'BORRANDO' if args.confirmar else '(dry-run) Se borrarían'} {len(filas)} nota(s).")
            if args.confirmar:
                for f in filas:
                    db.delete(f)
                db.commit()
                print("Listo.")
            return

        for n in NOTAS:
            print(f"idHorario={n['idHorario']} etiqueta={n['etiqueta']} nota={n['nota']!r}")

        if args.confirmar:
            for n in NOTAS:
                data = AnotacionHorarioCreate(idHorario=n["idHorario"], nota=n["nota"], etiqueta=n["etiqueta"])
                AnotacionHorarioService.crear(db, data, APRENDIZ)
            db.commit()
            print(f"Listo -- {len(NOTAS)} nota(s) creada(s).")
        else:
            print("\n(dry-run) Vuelve a correr con --confirmar para aplicar.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
