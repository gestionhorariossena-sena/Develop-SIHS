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

ROLES_GESTION = {"Coordinador", "Administrador"}
ROLES_ADMINISTRACION = {"Administrador"}


class NotificacionService:
    @staticmethod
    def crear_transaccional(
        db: Session,
        *,
        id_usuario,
        tipo: str,
        mensaje: str,
        entidad_relacionada: str | None = None,
        id_entidad_relacionada=None,
    ) -> Notificacion:
        """Agrega una notificación a la transacción activa, sin confirmarla.

        Se usa en operaciones compuestas que deben revertir también sus
        avisos si falla cualquier escritura posterior.
        """
        if tipo not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo de notificación desconocido: {tipo!r}.")
        notificacion = Notificacion(
            idUsuario=id_usuario,
            tipo=tipo,
            mensaje=mensaje,
            entidadRelacionada=entidad_relacionada,
            idEntidadRelacionada=(
                str(id_entidad_relacionada) if id_entidad_relacionada is not None else None
            ),
        )
        db.add(notificacion)
        db.flush()
        return notificacion

    @staticmethod
    def crear_agrupada_transaccional(
        db: Session,
        *,
        id_usuario,
        tipo: str,
        mensaje: str,
        entidad_relacionada: str,
        id_entidad_relacionada,
        minutos: int = 10,
    ) -> Notificacion | None:
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
        return NotificacionService.crear_transaccional(
            db,
            id_usuario=id_usuario,
            tipo=tipo,
            mensaje=mensaje,
            entidad_relacionada=entidad_relacionada,
            id_entidad_relacionada=id_entidad_relacionada,
        )

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
    def notificar_roles_transaccional(
        db: Session,
        *,
        roles: set[str],
        tipo: str,
        mensaje: str,
        entidad_relacionada: str | None = None,
        id_entidad_relacionada=None,
        excluir=None,
    ) -> int:
        """Un aviso por cada persona con alguno de `roles`, en la misma
        transacción que la operación que lo dispara. `excluir` es quien
        provocó el evento: no tiene sentido avisarle de lo que acaba de
        hacer. Devuelve cuántos avisos se crearon."""
        destinatarios = [
            id_usuario
            for id_usuario in NotificacionRepository.ids_usuarios_con_roles(db, roles)
            if excluir is None or str(id_usuario) != str(excluir)
        ]
        for id_usuario in destinatarios:
            NotificacionService.crear_transaccional(
                db,
                id_usuario=id_usuario,
                tipo=tipo,
                mensaje=mensaje,
                entidad_relacionada=entidad_relacionada,
                id_entidad_relacionada=id_entidad_relacionada,
            )
        return len(destinatarios)

    @staticmethod
    def obtener_por_usuario(
        db: Session,
        id_usuario,
        *,
        solo_no_leidas: bool = False,
        limite: int | None = None,
    ) -> list[Notificacion]:
        return NotificacionRepository.obtener_por_usuario(
            db, id_usuario, solo_no_leidas=solo_no_leidas, limite=limite
        )

    @staticmethod
    def contar_no_leidas(db: Session, id_usuario) -> int:
        return NotificacionRepository.contar_no_leidas(db, id_usuario)

    @staticmethod
    def eliminar(db: Session, id_notificacion: int, id_usuario) -> bool:
        """Solo el dueño puede borrar su aviso; uno ajeno se trata igual
        que uno inexistente para no revelar que existe."""
        notificacion = NotificacionRepository.obtener_por_id(db, id_notificacion)
        if notificacion is None or notificacion.idUsuario != id_usuario:
            return False
        NotificacionRepository.eliminar(db, notificacion)
        return True

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
