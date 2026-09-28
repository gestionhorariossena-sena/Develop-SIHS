from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.worker_publicacion import WorkerPublicacionEstado

MAX_ANTIGUEDAD_SEGUNDOS = 30


def registrar_senal(db, ahora: datetime | None = None) -> None:
    """Persiste un heartbeat; solo lo llama el proceso worker."""
    ahora = ahora or datetime.now(timezone.utc)
    fila = db.get(WorkerPublicacionEstado, 1)
    if fila is not None:
        fila.ultimaSenal = ahora
        db.commit()
        return

    db.add(WorkerPublicacionEstado(id=1, ultimaSenal=ahora))
    try:
        db.commit()
    except IntegrityError:
        # Dos instancias pueden arrancar a la vez: la fila singleton ya la
        # insertó la otra, así que recuperamos y actualizamos su señal.
        db.rollback()
        fila = db.get(WorkerPublicacionEstado, 1)
        if fila is None:
            raise
        fila.ultimaSenal = ahora
        db.commit()


def consultar_disponibilidad(db, ahora: datetime | None = None) -> dict:
    ahora = ahora or datetime.now(timezone.utc)
    try:
        fila = db.execute(
            select(WorkerPublicacionEstado).where(WorkerPublicacionEstado.id == 1)
        ).scalar_one_or_none()
    except SQLAlchemyError:
        db.rollback()
        return {
            "habilitado": False,
            "ultimaSenal": None,
            "segundosDesdeSenal": None,
            "motivo": "No se pudo consultar la señal de disponibilidad del worker.",
        }

    if fila is None:
        return {
            "habilitado": False,
            "ultimaSenal": None,
            "segundosDesdeSenal": None,
            "motivo": "El worker de publicaciones no ha enviado una señal reciente.",
        }

    senal = fila.ultimaSenal
    if senal.tzinfo is None:
        senal = senal.replace(tzinfo=timezone.utc)
    antiguedad = max(0, int((ahora - senal).total_seconds()))
    activo = antiguedad <= MAX_ANTIGUEDAD_SEGUNDOS
    return {
        "habilitado": activo,
        "ultimaSenal": senal,
        "segundosDesdeSenal": antiguedad,
        "motivo": None if activo else "La última señal del worker está vencida.",
    }
