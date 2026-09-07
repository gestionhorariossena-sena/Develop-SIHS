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