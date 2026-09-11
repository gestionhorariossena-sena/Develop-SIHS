from datetime import datetime, timezone

from app.models.solicitud_cambio_horario import SolicitudCambioHorario
from app.repositories.horario_repository import HorarioRepository
from app.repositories.solicitud_cambio_horario_repository import SolicitudCambioHorarioRepository
from app.services.horario_service import HorarioService


class SolicitudCambioHorarioService:
    @staticmethod
    def crear(db, data, instructor):
        horario = HorarioRepository.obtener_por_id(db, data.idHorarioOrigen)

        if not horario:
            return "HORARIO_NO_EXISTE"

        if horario.idInstructor != instructor.idUsuario:
            return "NO_ES_TU_HORARIO"

        nueva_solicitud = SolicitudCambioHorario(
            idInstructor=instructor.idUsuario,
            idHorarioOrigen=data.idHorarioOrigen,
            tipo=data.tipo,
            motivo=data.motivo,
        )
        return SolicitudCambioHorarioRepository.crear(db, nueva_solicitud)

    @staticmethod
    def obtener_todos(db, estado=None):
        return SolicitudCambioHorarioRepository.obtener_todos(db, estado)

    @staticmethod
    def obtener_mias(db, id_instructor):
        return SolicitudCambioHorarioRepository.obtener_por_instructor(db, id_instructor)

    @staticmethod
    def aprobar(db, id_solicitud, cambios):
        """Puede propagar CruceHorarioError (ver HorarioService.actualizar)
        si `cambios` produce un cruce y no viene forzado — la capa de API
        la traduce a 409, igual que en PUT /horarios/{id}. En ese caso no
        se toca la solicitud: sigue pendiente."""
        solicitud = SolicitudCambioHorarioRepository.obtener_por_id(db, id_solicitud)

        if not solicitud:
            return None, "NO_ENCONTRADA", []

        if solicitud.estado != "pendiente":
            return None, "YA_RESUELTA", []

        conflictos: list[str] = []
        if cambios is not None:
            if solicitud.idHorarioOrigen is None:
                return None, "HORARIO_ORIGEN_INEXISTENTE", []

            horario, conflictos = HorarioService.actualizar(
                db, solicitud.idHorarioOrigen, cambios, forzar=cambios.forzar
            )
            if horario is None:
                return None, "HORARIO_ORIGEN_INEXISTENTE", []

        solicitud.estado = "aprobada"
        solicitud.fechaResolucion = datetime.now(timezone.utc)
        return SolicitudCambioHorarioRepository.actualizar(db, solicitud), None, conflictos

    @staticmethod
    def rechazar(db, id_solicitud):
        solicitud = SolicitudCambioHorarioRepository.obtener_por_id(db, id_solicitud)

        if not solicitud:
            return None, "NO_ENCONTRADA"

        if solicitud.estado != "pendiente":
            return None, "YA_RESUELTA"

        solicitud.estado = "rechazada"
        solicitud.fechaResolucion = datetime.now(timezone.utc)
        return SolicitudCambioHorarioRepository.actualizar(db, solicitud), None
