from datetime import datetime, timezone

from app.repositories.horario_repository import HorarioRepository
from app.repositories.solicitud_cambio_horario_repository import SolicitudCambioHorarioRepository
from app.models.solicitud_cambio_horario import SolicitudCambioHorario

ESTADOS_RESOLUCION_VALIDOS = {"aprobada", "rechazada"}


class SolicitudCambioHorarioService:
    @staticmethod
    def crear(db, id_instructor, data):
        horario = HorarioRepository.obtener_por_id(db, data.idHorarioOrigen)
        if not horario or horario.idInstructor != id_instructor:
            return None

        solicitud = SolicitudCambioHorario(
            idInstructor=id_instructor,
            idHorarioOrigen=data.idHorarioOrigen,
            tipo=data.tipo,
            motivo=data.motivo,
        )
        return SolicitudCambioHorarioRepository.crear(db, solicitud)

    @staticmethod
    def obtener_mias(db, id_instructor):
        return SolicitudCambioHorarioRepository.obtener_por_instructor(db, id_instructor)

    @staticmethod
    def obtener_todas(db, estado: str | None = None):
        return SolicitudCambioHorarioRepository.obtener_todas(db, estado)

    @staticmethod
    def resolver(db, id_solicitud: int, id_admin, estado: str):
        """Marca la solicitud como aprobada/rechazada. NO dispara
        HorarioService.actualizar todavía: el ticket SCRUM-116 solo pide
        motivo en texto libre (no un "ambiente/instructor destino"
        estructurado), así que no hay datos suficientes para mover el
        horario real de forma automática — eso queda para cuando el
        producto defina ese campo. Por ahora "aprobar" es una decisión
        registrada, y quien programa aplica el cambio a mano en el
        creador de horarios si corresponde."""
        if estado not in ESTADOS_RESOLUCION_VALIDOS:
            raise ValueError(f"Estado de resolución inválido: {estado}")

        solicitud = SolicitudCambioHorarioRepository.obtener_por_id(db, id_solicitud)
        if not solicitud:
            return None

        return SolicitudCambioHorarioRepository.resolver(
            db,
            solicitud,
            estado=estado,
            id_admin=id_admin,
            fecha_resolucion=datetime.now(timezone.utc),
        )
