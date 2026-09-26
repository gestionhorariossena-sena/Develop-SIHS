from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion
from app.repositories.notificacion_repository import NotificacionRepository

# Vocabulario cerrado de tipos. Son los cuatro que el panel de la campana
# sabe pintar (`frontend/src/components/NotificacionesPanel.tsx`, cada uno
# con su icono y su color); cualquier otro valor llegaba sin icono ni
# estilo. Hasta H-8 el único disparador del sistema mandaba "Cambios de
# Aula & Horario", que no es ninguno de estos — nadie lo notó porque
# tampoco llegaba a nadie.
TIPO_CRUCE = "cruce"
TIPO_HORARIO = "horario"
TIPO_AMBIENTE = "ambiente"
TIPO_SISTEMA = "sistema"

TIPOS_VALIDOS = {TIPO_CRUCE, TIPO_HORARIO, TIPO_AMBIENTE, TIPO_SISTEMA}


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
        if tipo not in TIPOS_VALIDOS:
            raise ValueError(
                f"Tipo de notificación desconocido: {tipo!r}. "
                f"Usa uno de {sorted(TIPOS_VALIDOS)} — el panel no sabe pintar otra cosa."
            )

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
    def crear_agrupada(
        db: Session,
        *,
        id_usuario,
        tipo: str,
        mensaje: str,
        entidad_relacionada: str,
        id_entidad_relacionada,
        minutos: int = 10,
    ) -> Notificacion | None:
        """Como `crear`, pero no repite el mismo aviso sobre la misma
        entidad dentro de una ventana corta. Para eventos que llegan en
        ráfaga: publicar el horario de una ficha son decenas de llamadas
        sueltas y la persona no necesita decenas de avisos, necesita uno.
        Devuelve None si se omitió por repetida."""
        if not id_usuario:
            return None

        if NotificacionRepository.existe_reciente(
            db,
            id_usuario=id_usuario,
            tipo=tipo,
            entidad_relacionada=entidad_relacionada,
            id_entidad_relacionada=id_entidad_relacionada,
            minutos=minutos,
        ):
            return None

        return NotificacionService.crear(
            db,
            id_usuario=id_usuario,
            tipo=tipo,
            mensaje=mensaje,
            entidad_relacionada=entidad_relacionada,
            id_entidad_relacionada=id_entidad_relacionada,
        )

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