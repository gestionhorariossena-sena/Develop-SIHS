"""Reset de la demo del Asistente de Programación: para volver a mostrarle
al coordinador la subida del Excel + generación de propuesta desde cero,
sin que el generador se salte fichas creyendo que "ya tienen todo
programado".

Desactiva (activo=False), NO borra -- funcionalmente idéntico para el
generador (_CatalogoPrograma solo mira horarios con activo=True como "ya
programados", ver asistente_horario_service.py) y para las vistas
(Horarios completos, Mi Horario, etc. también filtran por activo), pero
reversible si algo sale mal: los datos siguen ahí, solo ocultos, en vez de
perdidos para siempre.

Uso:
    .venv/bin/python reset_demo_asistente.py                    # dry-run: solo lista qué tocaría
    .venv/bin/python reset_demo_asistente.py --confirmar         # aplica de verdad
    .venv/bin/python reset_demo_asistente.py --confirmar --horas 48   # ventana más amplia

Filtro doble (ficha real de la demo Y creado recientemente) para no tocar
por accidente horarios reales antiguos de esas mismas fichas.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401 -- registra todos los modelos declarativos antes de usarlos
from app.core.database import SessionLocal
from app.models.ficha import Ficha
from app.models.horario import Horario

# Códigos de ficha reales del Excel de la demo (LIDERES DE FICHA
# 2026_pruebas.xlsx) -- las mismas ~50 fichas que se han usado en cada
# corrida del asistente hasta ahora. Si la próxima demo usa un Excel
# distinto, pasar --fichas con los códigos nuevos.
FICHAS_DEMO_DEFAULT = [
    '3141676','3141677','3141675','3171599','3171618','3171645','3171667','3171668','3171672',
    '3171676','3171678','3171687','3171689','3171690','3228995','3228994A','3228994B','3228996',
    '3228970A','3228973A','3228973B','3228977','3228981','3228982','3228993','3288274','3288258',
    '3288282','3288277','3288278','3310819','3310829','3310832A','3310832B','3407171','3407180',
    '3407181','3407182','3407183','3407188','3407191','3407192','3407781','3407169','3407177',
    '3407178','3407179','3407173','3407184','3407186',
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmar", action="store_true", help="Sin esto, solo hace dry-run (lista sin tocar nada)")
    parser.add_argument("--horas", type=int, default=24, help="Ventana hacia atrás para considerar 'de la demo' (default 24h)")
    parser.add_argument("--fichas", nargs="*", default=FICHAS_DEMO_DEFAULT, help="Códigos de ficha a considerar")
    args = parser.parse_args()

    umbral = datetime.now(timezone.utc) - timedelta(hours=args.horas)

    db = SessionLocal()
    try:
        ids_ficha = [f.idFicha for f in db.query(Ficha).filter(Ficha.codigoFicha.in_(args.fichas)).all()]

        horarios = (
            db.query(Horario)
            .filter(Horario.idFicha.in_(ids_ficha), Horario.activo.is_(True), Horario.fechaCreacion >= umbral)
            .all()
        )

        if not horarios:
            print(f"Nada que resetear -- 0 horarios activos creados en las últimas {args.horas}h para estas fichas.")
            return

        print(f"{'DESACTIVANDO' if args.confirmar else '(dry-run) Se desactivarían'} {len(horarios)} horario(s):")
        for h in sorted(horarios, key=lambda x: x.fechaCreacion):
            print(f"  #{h.idHorario} ficha={h.idFicha} instructor={h.idInstructor} {h.horaInicio} creado={h.fechaCreacion}")

        if not args.confirmar:
            print("\nEsto fue un dry-run. Vuelve a correr con --confirmar para aplicar de verdad.")
            return

        for h in horarios:
            h.activo = False
        db.commit()
        print(f"\nListo: {len(horarios)} horario(s) desactivados. El generador ya no los verá como 'ya programados'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
