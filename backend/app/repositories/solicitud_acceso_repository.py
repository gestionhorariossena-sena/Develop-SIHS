from sqlalchemy.orm import Session

from app.models.rol import Rol
from app.models.solicitud_acceso import SolicitudAcceso


class SolicitudAccesoRepository:
    @staticmethod
    def crear(db: Session, solicitud: SolicitudAcceso) -> SolicitudAcceso:
        db.add(solicitud)
        db.commit()
        db.refresh(solicitud)
        return solicitud

    @staticmethod
    def obtener_pendiente_por_email(db: Session, email: str) -> SolicitudAcceso | None:
        """Evita duplicados: POST /solicitudes-acceso/ rechaza un correo
        que ya tenga una solicitud pendiente sin resolver."""
        return (
            db.query(SolicitudAcceso)
            .filter(SolicitudAcceso.email == email, SolicitudAcceso.estado == "pendiente")
            .first()
        )

    @staticmethod
    def obtener_por_id(db: Session, id_solicitud: int):
        """(SolicitudAcceso, Rol) o None -- mismo shape que `listar`."""
        return (
            db.query(SolicitudAcceso, Rol)
            .join(Rol, Rol.idRol == SolicitudAcceso.idRolSolicitado)
            .filter(SolicitudAcceso.idSolicitud == id_solicitud)
            .first()
        )

    @staticmethod
    def listar(db: Session, estado: str | None = None):
        """Todas las solicitudes (o filtradas por estado), más recientes
        primero, junto con el Rol solicitado para poder mostrar su
        nombre."""
        query = (
            db.query(SolicitudAcceso, Rol)
            .join(Rol, Rol.idRol == SolicitudAcceso.idRolSolicitado)
            .order_by(SolicitudAcceso.fechaSolicitud.desc())
        )

        if estado:
            query = query.filter(SolicitudAcceso.estado == estado)

        return query.all()
