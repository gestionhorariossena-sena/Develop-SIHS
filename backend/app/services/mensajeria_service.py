from sqlalchemy.orm import Session

from app.models.ficha_usuario import FichaUsuario
from app.models.horario import Horario
from app.models.mensajeria import Conversacion, Mensaje
from app.repositories.mensajeria_repository import MensajeriaRepository


class ConversacionNoPermitidaError(Exception):
    """El instructor pedido no le dicta clase a la ficha del aprendiz."""


class MensajeriaService:
    @staticmethod
    def _instructor_dicta_a_aprendiz(db: Session, id_aprendiz, id_instructor) -> bool:
        ficha_usuario = db.query(FichaUsuario).filter(FichaUsuario.idUsuario == id_aprendiz).first()
        if not ficha_usuario:
            return False

        return (
            db.query(Horario)
            .filter(Horario.idFicha == ficha_usuario.idFicha, Horario.idInstructor == id_instructor)
            .first()
            is not None
        )

    @staticmethod
    def obtener_o_crear_conversacion(db: Session, id_aprendiz, id_instructor) -> Conversacion:
        existente = MensajeriaRepository.obtener_conversacion_por_par(db, id_aprendiz, id_instructor)
        if existente:
            return existente

        if not MensajeriaService._instructor_dicta_a_aprendiz(db, id_aprendiz, id_instructor):
            raise ConversacionNoPermitidaError()

        nueva = Conversacion(idAprendiz=id_aprendiz, idInstructor=id_instructor)
        return MensajeriaRepository.crear_conversacion(db, nueva)

    @staticmethod
    def _es_participante(conversacion: Conversacion, id_usuario) -> bool:
        return conversacion.idAprendiz == id_usuario or conversacion.idInstructor == id_usuario

    @staticmethod
    def obtener_conversaciones_de_usuario(db: Session, id_usuario) -> list[Conversacion]:
        return MensajeriaRepository.obtener_conversaciones_de_usuario(db, id_usuario)

    @staticmethod
    def obtener_mensajes(db: Session, id_conversacion: int, id_usuario) -> list[Mensaje] | None:
        conversacion = MensajeriaRepository.obtener_conversacion_por_id(db, id_conversacion)
        if not conversacion or not MensajeriaService._es_participante(conversacion, id_usuario):
            return None

        return MensajeriaRepository.obtener_mensajes(db, id_conversacion)

    @staticmethod
    def enviar_mensaje(db: Session, id_conversacion: int, id_usuario, contenido: str, adjunto_url: str | None) -> Mensaje | None:
        conversacion = MensajeriaRepository.obtener_conversacion_por_id(db, id_conversacion)
        if not conversacion or not MensajeriaService._es_participante(conversacion, id_usuario):
            return None

        mensaje = Mensaje(
            idConversacion=id_conversacion,
            idRemitente=id_usuario,
            contenido=contenido,
            adjuntoUrl=adjunto_url,
        )
        return MensajeriaRepository.crear_mensaje(db, mensaje)

    @staticmethod
    def marcar_leido(db: Session, id_mensaje: int, id_usuario) -> Mensaje | None:
        mensaje = MensajeriaRepository.obtener_mensaje_por_id(db, id_mensaje)
        if not mensaje:
            return None

        conversacion = MensajeriaRepository.obtener_conversacion_por_id(db, mensaje.idConversacion)
        if not conversacion or not MensajeriaService._es_participante(conversacion, id_usuario):
            return None

        return MensajeriaRepository.marcar_leido(db, mensaje)
