from sqlalchemy.orm import Session

from app.models.solicitud_cambio_horario import SolicitudCambioHorario


class SolicitudCambioHorarioRepository:
    @staticmethod
    def crear(db: Session, solicitud: SolicitudCambioHorario) -> SolicitudCambioHorario:
        db.add(solicitud)
        db.commit()
        db.refresh(solicitud)
        return solicitud

    @staticmethod
    def obtener_por_id(db: Session, id_solicitud: int) -> SolicitudCambioHorario | None:
        return (
            db.query(SolicitudCambioHorario)
            .filter(SolicitudCambioHorario.idSolicitud == id_solicitud)
            .first()
        )

    @staticmethod
    def obtener_por_instructor(db: Session, id_instructor) -> list[SolicitudCambioHorario]:
        return (
            db.query(SolicitudCambioHorario)
            .filter(SolicitudCambioHorario.idInstructor == id_instructor)
            .order_by(SolicitudCambioHorario.fechaSolicitud.desc())
            .all()
        )

    @staticmethod
    def obtener_todas(db: Session, estado: str | None = None) -> list[SolicitudCambioHorario]:
        consulta = db.query(SolicitudCambioHorario)
        if estado:
            consulta = consulta.filter(SolicitudCambioHorario.estado == estado)
        return consulta.order_by(SolicitudCambioHorario.fechaSolicitud.desc()).all()

    @staticmethod
    def resolver(
        db: Session,
        solicitud: SolicitudCambioHorario,
        *,
        estado: str,
        id_admin,
        fecha_resolucion,
    ) -> SolicitudCambioHorario:
        solicitud.estado = estado
        solicitud.idAdminResolvio = id_admin
        solicitud.fechaResolucion = fecha_resolucion
        db.commit()
        db.refresh(solicitud)
        return solicitud
