from datetime import datetime, timedelta, timezone

from app.models.auditoria import Auditoria
from app.repositories.auditoria_repository import AuditoriaRepository
from app.repositories.usuario_repository import UsuarioRepository


class AuditoriaService:
    @staticmethod
    def registrar(
        db,
        *,
        accion: str,
        entidad: str,
        usuario=None,
        identificador: str | None = None,
        id_entidad=None,
        detalle: str | None = None,
    ) -> Auditoria:
        """Punto único para dejar un rastro de auditoría (RNF-26/RNF-27).
        `usuario` es el Usuario autenticado que ejecutó la acción (None
        para un intento de login que nunca llegó a autenticar a nadie)."""
        registro = Auditoria(
            idUsuario=usuario.idUsuario if usuario else None,
            identificador=identificador or (usuario.email if usuario else None),
            accion=accion,
            entidad=entidad,
            idEntidad=str(id_entidad) if id_entidad is not None else None,
            detalle=detalle,
        )
        return AuditoriaRepository.crear(db, registro)

    @staticmethod
    def registrar_login_fallido(db, identificador: str) -> Auditoria:
        # Un login fallido no trae un usuario autenticado — si el
        # identificador coincide con un email ya conocido, igual se enlaza
        # el registro a esa fila de "usuarios" (RNF-27: identificar al
        # responsable cuando se pueda).
        usuario = UsuarioRepository.obtener_por_email(db, identificador)
        return AuditoriaService.registrar(
            db,
            usuario=usuario,
            identificador=identificador,
            accion="LOGIN_FALLIDO",
            entidad="auth",
        )

    @staticmethod
    def obtener_todos(db, entidad: str | None = None) -> list[Auditoria]:
        return AuditoriaRepository.obtener_todos(db, entidad)

    @staticmethod
    def contar_intentos_fallidos_recientes(db, identificador: str, minutos: int = 15) -> int:
        """Lo que necesita SCRUM-17 para decidir si bloquear tras 3
        intentos: cuenta LOGIN_FALLIDO de ese identificador en la ventana
        de tiempo dada."""
        desde = datetime.now(timezone.utc) - timedelta(minutes=minutos)
        return AuditoriaRepository.contar_login_fallido_desde(db, identificador, desde)
