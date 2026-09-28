"""Worker de polling para publicaciones programadas.

Ejecutar desde backend con: python -m app.workers.publicacion_programada_worker
El despliegue debe iniciar este proceso además del servidor web.
"""
import argparse
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.publicacion_programada import PublicacionProgramada
from app.services.publicacion_programada_service import ejecutar

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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--intervalo", type=float, default=5.0)
    parser.add_argument("--once", action="store_true", help="procesa lo vencido y termina")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    while True:
        total = procesar_vencidas()
        if total:
            logger.info("Publicaciones programadas procesadas: %s", total)
        if args.once:
            return
        time.sleep(max(0.5, args.intervalo))


if __name__ == "__main__":
    main()
