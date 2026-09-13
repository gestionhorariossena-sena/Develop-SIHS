from sqlalchemy.orm import Session

from app.models.rol import Rol
from app.models.solicitud_acceso import SolicitudAcceso


class SolicitudAccesoRepository:
    @staticmethod
    def listar(db: Session, estado: str | None = None):
        """Todas las solicitudes (o filtradas por estado), más recientes
        primero, junto con el Rol solicitado para poder mostrar su nombre.
        Usado hoy solo por la exportación a CSV; el resto del CRUD
        (crear/aprobar/rechazar) es del ticket "[Backend] Endpoints
        /solicitudes-acceso", aparte."""
        query = (
            db.query(SolicitudAcceso, Rol)
            .join(Rol, Rol.idRol == SolicitudAcceso.idRolSolicitado)
            .order_by(SolicitudAcceso.fechaSolicitud.desc())
        )

        if estado:
            query = query.filter(SolicitudAcceso.estado == estado)

        return query.all()
