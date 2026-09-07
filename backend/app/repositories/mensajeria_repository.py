from sqlalchemy.orm import Session

from app.models.mensajeria import Conversacion, Mensaje


class MensajeriaRepository:
    @staticmethod
    def obtener_conversacion_por_id(db: Session, id_conversacion: int) -> Conversacion | None:
        return db.query(Conversacion).filter(Conversacion.idConversacion == id_conversacion).first()

    @staticmethod
    def obtener_conversacion_por_par(db: Session, id_aprendiz, id_instructor) -> Conversacion | None:
        return (
            db.query(Conversacion)
            .filter(Conversacion.idAprendiz == id_aprendiz, Conversacion.idInstructor == id_instructor)
            .first()
        )

    @staticmethod
    def obtener_conversaciones_de_usuario(db: Session, id_usuario) -> list[Conversacion]:
        return (
            db.query(Conversacion)
            .filter((Conversacion.idAprendiz == id_usuario) | (Conversacion.idInstructor == id_usuario))
            .order_by(Conversacion.fechaCreacion.desc())
            .all()
        )

    @staticmethod
    def crear_conversacion(db: Session, conversacion: Conversacion) -> Conversacion:
        db.add(conversacion)
        db.commit()
        db.refresh(conversacion)
        return conversacion

    @staticmethod
    def obtener_mensajes(db: Session, id_conversacion: int) -> list[Mensaje]:
        return (
            db.query(Mensaje)
            .filter(Mensaje.idConversacion == id_conversacion)
            .order_by(Mensaje.fechaEnvio.asc())
            .all()
        )

    @staticmethod
    def crear_mensaje(db: Session, mensaje: Mensaje) -> Mensaje:
        db.add(mensaje)
        db.commit()
        db.refresh(mensaje)
        return mensaje

    @staticmethod
    def obtener_mensaje_por_id(db: Session, id_mensaje: int) -> Mensaje | None:
        return db.query(Mensaje).filter(Mensaje.idMensaje == id_mensaje).first()

    @staticmethod
    def marcar_leido(db: Session, mensaje: Mensaje) -> Mensaje:
        mensaje.leido = True
        db.commit()
        db.refresh(mensaje)
        return mensaje
