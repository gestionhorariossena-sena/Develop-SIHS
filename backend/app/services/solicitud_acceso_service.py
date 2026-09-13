import csv
import io

from app.repositories.solicitud_acceso_repository import SolicitudAccesoRepository

ENCABEZADOS_CSV = [
    "idSolicitud",
    "nombre",
    "email",
    "numeroDocumento",
    "rolSolicitado",
    "motivo",
    "estado",
    "motivoRechazo",
    "fechaSolicitud",
    "fechaResolucion",
    "idAdminResolvio",
]


class SolicitudAccesoService:
    @staticmethod
    def exportar_csv(db, estado: str | None = None) -> str:
        """Botón "Exportar Registro (CSV)" del Panel de Administración —
        mismo filtro por estado que usaría el listado (GET
        /solicitudes-acceso/, otro ticket)."""
        filas = SolicitudAccesoRepository.listar(db, estado)

        buffer = io.StringIO()
        escritor = csv.writer(buffer)
        escritor.writerow(ENCABEZADOS_CSV)

        for solicitud, rol in filas:
            escritor.writerow(
                [
                    solicitud.idSolicitud,
                    solicitud.nombre,
                    solicitud.email,
                    solicitud.numeroDocumento,
                    rol.nombre,
                    solicitud.motivo,
                    solicitud.estado,
                    solicitud.motivoRechazo or "",
                    solicitud.fechaSolicitud.isoformat() if solicitud.fechaSolicitud else "",
                    solicitud.fechaResolucion.isoformat() if solicitud.fechaResolucion else "",
                    str(solicitud.idAdminResolvio) if solicitud.idAdminResolvio else "",
                ]
            )

        return buffer.getvalue()
