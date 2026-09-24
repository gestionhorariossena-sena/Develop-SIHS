from sqlalchemy.orm import Session

from app.models.solicitud_acceso import SolicitudAcceso


class SolicitudAccesoRepository:
    @staticmethod
    def crear(db: Session, solicitud: SolicitudAcceso) -> SolicitudAcceso:
        db.add(solicitud)
        db.commit()
        db.refresh(solicitud)
        return solicitud

    @staticmethod
    def obtener_por_id(db: Session, id_solicitud: int) -> SolicitudAcceso | None:
        return db.query(SolicitudAcceso).filter(SolicitudAcceso.idSolicitud == id_solicitud).first()

    @staticmethod
    def obtener_pendiente_por_email(db: Session, email: str) -> SolicitudAcceso | None:
        return (
            db.query(SolicitudAcceso)
            .filter(SolicitudAcceso.email == email, SolicitudAcceso.estado == "pendiente")
            .first()
        )

    @staticmethod
    def obtener_todas(db: Session, estado: str | None = None) -> list[SolicitudAcceso]:
        consulta = db.query(SolicitudAcceso)
        if estado:
            consulta = consulta.filter(SolicitudAcceso.estado == estado)
        # Las pendientes son lo que el panel atiende, y la más vieja es la
        # que más tiempo lleva esperando: descendente por fecha deja arriba
        # la más reciente, igual que el resto de bandejas del sistema.
        return consulta.order_by(SolicitudAcceso.fechaSolicitud.desc()).all()

    @staticmethod
    def resolver(
        db: Session,
        solicitud: SolicitudAcceso,
        *,
        estado: str,
        id_admin,
        fecha_resolucion,
        motivo_rechazo: str | None = None,
    ) -> SolicitudAcceso:
        solicitud.estado = estado
        solicitud.idAdminResolvio = id_admin
        solicitud.fechaResolucion = fecha_resolucion
        if motivo_rechazo is not None:
            solicitud.motivoRechazo = motivo_rechazo
        db.commit()
        db.refresh(solicitud)
        return solicitud
