from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion
from app.repositories.notificacion_repository import NotificacionRepository


class NotificacionService:
    @staticmethod
    def crear(
        db: Session,
        *,
        id_usuario,
        tipo: str,
        mensaje: str,
        entidad_relacionada: str | None = None,
        id_entidad_relacionada=None,
    ) -> Notificacion:
        notificacion = Notificacion(
            idUsuario=id_usuario,
            tipo=tipo,
            mensaje=mensaje,
            entidadRelacionada=entidad_relacionada,
            idEntidadRelacionada=(
                str(id_entidad_relacionada)
                if id_entidad_relacionada is not None
                else None
            ),
        )

        return NotificacionRepository.crear(db, notificacion)

    @staticmethod
    def obtener_por_usuario(
        db: Session,
        id_usuario,
    ) -> list[Notificacion]:
        return NotificacionRepository.obtener_por_usuario(db, id_usuario)

    @staticmethod
    def marcar_leida(
        db: Session,
        id_notificacion: int,
        id_usuario,
    ) -> Notificacion | None:
        notificacion = NotificacionRepository.obtener_por_id(
            db,
            id_notificacion,
        )

        if notificacion is None:
            return None

        if notificacion.idUsuario != id_usuario:
            return None

        return NotificacionRepository.marcar_leida(db, notificacion)

    @staticmethod
    def marcar_todas_leidas(
        db: Session,
        id_usuario,
    ) -> int:
        return NotificacionRepository.marcar_todas_leidas(db, id_usuario)