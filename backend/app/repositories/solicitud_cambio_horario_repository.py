from sqlalchemy.orm import Session, joinedload

from app.models.solicitud_cambio_horario import SolicitudCambioHorario


class SolicitudCambioHorarioRepository:
    @staticmethod
    def obtener_todos(db: Session, estado: str | None = None):
        query = db.query(SolicitudCambioHorario).options(joinedload(SolicitudCambioHorario.instructor))

        if estado is not None:
            query = query.filter(SolicitudCambioHorario.estado == estado)

        return query.order_by(SolicitudCambioHorario.fechaSolicitud.desc()).all()

    @staticmethod
    def obtener_por_instructor(db: Session, id_instructor):
        return (
            db.query(SolicitudCambioHorario)
            .options(joinedload(SolicitudCambioHorario.instructor))
            .filter(SolicitudCambioHorario.idInstructor == id_instructor)
            .order_by(SolicitudCambioHorario.fechaSolicitud.desc())
            .all()
        )

    @staticmethod
    def obtener_por_id(db: Session, id_solicitud: int):
        return (
            db.query(SolicitudCambioHorario)
            .options(joinedload(SolicitudCambioHorario.instructor))
            .filter(SolicitudCambioHorario.idSolicitud == id_solicitud)
            .first()
        )

    @staticmethod
    def crear(db: Session, solicitud: SolicitudCambioHorario):
        db.add(solicitud)
        db.commit()
        db.refresh(solicitud)
        return solicitud

    @staticmethod
    def actualizar(db: Session, solicitud: SolicitudCambioHorario):
        db.commit()
        db.refresh(solicitud)
        return solicitud
