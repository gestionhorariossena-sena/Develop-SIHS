from datetime import datetime, timedelta, timezone

from app.models.auditoria import Auditoria
from app.repositories.auditoria_repository import AuditoriaRepository
from app.repositories.usuario_repository import UsuarioRepository

# RF-001/RNF-06: "El sistema solo permitirá 3 intentos de inicio de sesión
# antes de bloquear el usuario." El requisito no dice cuánto dura el
# bloqueo ni cómo se levanta (no hay flujo de desbloqueo por admin en
# ningún lado de la documentación) — se asume una ventana deslizante: se
# está bloqueado mientras haya 3+ intentos fallidos en los últimos
# LOGIN_VENTANA_MINUTOS, y se desbloquea solo cuando pasa ese tiempo desde
# el último intento. Confirmar con el equipo si el negocio quiere en
# cambio un bloqueo permanente que solo un Administrador pueda levantar.
LOGIN_LIMITE_INTENTOS = 3
LOGIN_VENTANA_MINUTOS = 15


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
        """Cuenta LOGIN_FALLIDO de ese identificador en la ventana de
        tiempo dada."""
        desde = datetime.now(timezone.utc) - timedelta(minutes=minutos)
        return AuditoriaRepository.contar_login_fallido_desde(db, identificador, desde)

    @staticmethod
    def verificar_bloqueo(db, identificador: str) -> dict:
        """RF-001/RNF-06: si el identificador acumuló 3+ intentos
        fallidos de login en los últimos LOGIN_VENTANA_MINUTOS, está
        bloqueado. El frontend llama esto ANTES de intentar
        supabase.auth.signInWithPassword (ver Login.tsx) para no dejar
        seguir si ya se gastaron los intentos."""
        ahora = datetime.now(timezone.utc)
        desde = ahora - timedelta(minutes=LOGIN_VENTANA_MINUTOS)

        ultimo = AuditoriaRepository.obtener_ultimo_login_fallido_desde(db, identificador, desde)
        intentos = AuditoriaRepository.contar_login_fallido_desde(db, identificador, desde)
        bloqueado = intentos >= LOGIN_LIMITE_INTENTOS

        segundos_para_desbloqueo = None
        if bloqueado and ultimo:
            # Postgres (TIMESTAMPTZ) devuelve datetimes con tzinfo, pero no
            # asumimos que siempre sea así (ej. SQLite en tests no lo
            # preserva) — se normaliza a UTC antes de restar para no
            # romper con "offset-naive and offset-aware datetimes".
            fecha_ultimo = ultimo.fecha
            if fecha_ultimo.tzinfo is None:
                fecha_ultimo = fecha_ultimo.replace(tzinfo=timezone.utc)
            desbloqueo = fecha_ultimo + timedelta(minutes=LOGIN_VENTANA_MINUTOS)
            segundos_para_desbloqueo = max(0, int((desbloqueo - ahora).total_seconds()))

        return {
            "bloqueado": bloqueado,
            "intentos": intentos,
            "intentosRestantes": max(0, LOGIN_LIMITE_INTENTOS - intentos),
            "segundosParaDesbloqueo": segundos_para_desbloqueo,
        }
