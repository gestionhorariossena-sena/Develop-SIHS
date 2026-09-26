from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion


class NotificacionRepository:
    @staticmethod
    def crear(db: Session, notificacion: Notificacion) -> Notificacion:
        db.add(notificacion)
        db.commit()
        db.refresh(notificacion)
        return notificacion

    @staticmethod
    def existe_reciente(
        db: Session,
        *,
        id_usuario,
        tipo: str,
        entidad_relacionada: str,
        id_entidad_relacionada,
        minutos: int,
    ) -> bool:
        """¿Ya se le avisó de esto mismo hace poco? Publicar el horario de
        una ficha son decenas de bloques sueltos, uno por llamada: sin
        esto, a cada aprendiz le entrarían decenas de campanazos idénticos
        en el mismo minuto."""
        desde = datetime.now(timezone.utc) - timedelta(minutes=minutos)

        return (
            db.query(Notificacion)
            .filter(
                Notificacion.idUsuario == id_usuario,
                Notificacion.tipo == tipo,
                Notificacion.entidadRelacionada == entidad_relacionada,
                Notificacion.idEntidadRelacionada == str(id_entidad_relacionada),
                Notificacion.fechaCreacion >= desde,
            )
            .first()
            is not None
        )

    @staticmethod
    def obtener_por_usuario(
        db: Session,
        id_usuario,
    ) -> list[Notificacion]:
        return (
            db.query(Notificacion)
            .filter(Notificacion.idUsuario == id_usuario)
            .order_by(Notificacion.fechaCreacion.desc())
            .all()
        )

    @staticmethod
    def obtener_por_id(
        db: Session,
        id_notificacion: int,
    ) -> Notificacion | None:
        return (
            db.query(Notificacion)
            .filter(Notificacion.idNotificacion == id_notificacion)
            .first()
        )

    @staticmethod
    def marcar_leida(
        db: Session,
        notificacion: Notificacion,
    ) -> Notificacion:
        notificacion.leida = True
        db.commit()
        db.refresh(notificacion)
        return notificacion

    @staticmethod
    def marcar_todas_leidas(
        db: Session,
        id_usuario,
    ) -> int:
        notificaciones = (
            db.query(Notificacion)
            .filter(
                Notificacion.idUsuario == id_usuario,
                Notificacion.leida.is_(False),
            )
            .all()
        )

        for notificacion in notificaciones:
            notificacion.leida = True

        db.commit()

        return len(notificaciones)