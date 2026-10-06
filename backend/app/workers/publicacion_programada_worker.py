"""Worker de polling para publicaciones programadas.

Ejecutar desde backend con: python -m app.workers.publicacion_programada_worker
También puede ejecutarse embebido en el proceso web (Render Free) mediante
`run_worker`, que acepta un Event para apagado limpio.
"""
import argparse
import logging
import time
from datetime import datetime, timezone
from threading import Event

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.publicacion_programada import PublicacionProgramada
from app.services.publicacion_programada_service import ejecutar
from app.services.worker_publicacion_service import registrar_senal

logger = logging.getLogger("sihs.publicacion_worker")


def procesar_vencidas() -> int:
    with SessionLocal() as db:
        ids = list(db.execute(select(PublicacionProgramada.idPublicacion).where(
            PublicacionProgramada.estado == "pendiente",
            PublicacionProgramada.fechaEjecucion <= datetime.now(timezone.utc),
        ).order_by(PublicacionProgramada.fechaEjecucion).limit(100)).scalars())
    procesadas = 0
    for identificador in ids:
        try:
            with SessionLocal() as db:
                procesadas += bool(ejecutar(db, identificador))
        except Exception:
            logger.exception("Fallo al procesar publicación programada id=%s", identificador)
    return procesadas


def run_worker(
    intervalo: float = 5.0,
    once: bool = False,
    stop_event: Event | None = None,
) -> None:
    """Ejecuta el ciclo del worker.

    `stop_event` permite que el servidor web lo detenga de forma limpia.
    Sin evento conserva el comportamiento histórico de proceso persistente.
    """
    espera = max(0.5, intervalo)
    while True:
        if stop_event is not None and stop_event.is_set():
            return

        if not once:
            with SessionLocal() as db:
                registrar_senal(db)

        total = procesar_vencidas()

        if not once:
            with SessionLocal() as db:
                registrar_senal(db)

        if total:
            logger.info("Publicaciones programadas procesadas: %s", total)

        if once:
            return

        if stop_event is not None:
            if stop_event.wait(espera):
                return
        else:
            time.sleep(espera)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--intervalo", type=float, default=5.0)
    parser.add_argument("--once", action="store_true", help="procesa lo vencido y termina")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    run_worker(intervalo=args.intervalo, once=args.once)


if __name__ == "__main__":
    main()
