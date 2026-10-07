from uuid import UUID

from app.repositories.usuario_repository import UsuarioRepository


class UsuarioService:
    @staticmethod
    def listar_usuarios(db):
        return UsuarioRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_usuario: UUID):
        return UsuarioRepository.obtener_por_id(db, id_usuario)

    @staticmethod
    def confirmar_cambio_clave(db, usuario):
        """Limpia debeCambiarClave tras un cambio de contraseña exitoso
        (supabase.auth.updateUser en el frontend, ver
        CambiarClaveObligatorio.tsx) — PATCH /usuarios/me/confirmar-cambio-clave.
        No valida la contraseña en sí: eso ya lo hizo Supabase Auth: acá
        solo se baja el flag que bloqueaba la navegación."""
        usuario.debeCambiarClave = False
        return UsuarioRepository.actualizar(db, usuario)

    @staticmethod
    def actualizar_preferencia_tema(db, usuario, tema: str):
        usuario.preferenciaTema = tema
        return UsuarioRepository.actualizar(db, usuario)

    @staticmethod
    def obtener_por_numero_documento(db, numero: str):
        return UsuarioRepository.obtener_por_numero_documento(db, numero)
