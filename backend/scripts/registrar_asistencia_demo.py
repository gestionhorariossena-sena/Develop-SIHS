"""Registra asistencia real para la ficha de prueba 3407178, usando el
MISMO flujo que usaría un instructor de verdad (AsistenciaService.registrar
-- con toda su validación: día de la semana correcto, fecha no futura,
aprendiz matriculado). No es un INSERT directo ni datos inventados fuera
de lugar: son sesiones reales de horarios reales, en fechas reales en las
que esa clase sí se dicta, solo que nadie les había pasado lista todavía
(en toda la base de datos solo había 1 fila de asistencia, de otro aprendiz).

Reversible: borra por idHorario+fechaSesion con --revertir.

Uso:
    .venv/bin/python registrar_asistencia_demo.py                # dry-run
    .venv/bin/python registrar_asistencia_demo.py --confirmar     # aplica
    .venv/bin/python registrar_asistencia_demo.py --confirmar --revertir
"""

import argparse
import sys
import pathlib
import uuid
from datetime import date, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: F401
from app.core.database import SessionLocal
from app.models.asistencia import Asistencia
from app.models.ficha_usuario import FichaUsuario
from app.models.ficha import Ficha
from app.schemas.asistencia import MarcaAsistencia, RegistroAsistencia
from app.services.asistencia_service import AsistenciaService

# (idHorario, idInstructor, isoweekday de la clase) -- tomado directo de
# los horarios reales de la ficha 3407178.
SESIONES = [
    (208, "072c8b9f-bc51-4f79-b768-146262260b00", 1, "presente"),   # Lunes, hace 1 semana
    (211, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 1, "presente"),   # Lunes, hace 2 semanas
    (212, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 1, "tardanza"),   # Lunes, hace 3 semanas
    (206, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 2, "presente"),
    (209, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 2, "ausente"),
    (202, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 3, "presente"),
    (203, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 3, "excusa"),
    (205, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 4, "presente"),
    (207, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 4, "presente"),
    (204, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 5, "presente"),
    (210, "0c775aef-5b51-48db-b9f1-3cc385c6fc6d", 5, "presente"),
]

APRENDIZ = "b7fb6c88-6c47-4f12-8609-23d4bb29c7ef"  # davidm20.05.2006+aprendiz1@gmail.com
FICHA_CODIGO = "3407178"


def fecha_pasada_para(dia_semana: int, hace_semanas: int) -> date:
    """La fecha, hace N semanas, del día de la semana pedido (1=lunes)."""
    hoy = date.today()
    delta = (hoy.isoweekday() - dia_semana) % 7
    base = hoy - timedelta(days=delta)
    return base - timedelta(weeks=hace_semanas)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--confirmar", action="store_true")
    parser.add_argument("--revertir", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        ficha = db.query(Ficha).filter(Ficha.codigoFicha == FICHA_CODIGO).first()
        vinculo = db.query(FichaUsuario).filter(FichaUsuario.idUsuario == APRENDIZ).first()
        if not ficha or not vinculo or vinculo.idFicha != ficha.idFicha:
            print("La ficha/vínculo esperado no coincide -- no hago nada.")
            return

        if args.revertir:
            ids_horario = [s[0] for s in SESIONES]
            filas = db.query(Asistencia).filter(
                Asistencia.idUsuarioAprendiz == APRENDIZ, Asistencia.idHorario.in_(ids_horario)
            ).all()
            print(f"{'BORRANDO' if args.confirmar else '(dry-run) Se borrarían'} {len(filas)} fila(s).")
            if args.confirmar:
                for f in filas:
                    db.delete(f)
                db.commit()
                print("Listo.")
            return

        creadas = 0
        for idx, (id_horario, id_instructor, dia_semana, estado) in enumerate(SESIONES):
            fecha_sesion = fecha_pasada_para(dia_semana, idx % 3)
            print(f"idHorario={id_horario} fecha={fecha_sesion} ({fecha_sesion.strftime('%A')}) estado={estado}")

            if args.confirmar:
                data = RegistroAsistencia(
                    idHorario=id_horario,
                    fechaSesion=fecha_sesion,
                    marcas=[MarcaAsistencia(idUsuarioAprendiz=APRENDIZ, estado=estado)],
                )
                AsistenciaService.registrar(db, data, uuid.UUID(id_instructor))
                db.commit()
                creadas += 1

        if args.confirmar:
            print(f"Listo -- {creadas} sesión(es) registradas.")
        else:
            print("\n(dry-run) Vuelve a correr con --confirmar para aplicar.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
