from app.models.usuario_rol import UsuarioRol
from app.repositories.rol_repository import RolRepository
from app.repositories.usuario_repository import UsuarioRepository
from app.repositories.usuario_rol_repository import UsuarioRolRepository

NOMBRE_ROL_ADMINISTRADOR = "Administrador"


class UsuarioRolService:
    @staticmethod
    def asignar(db, id_usuario, id_rol):
        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)

        if not usuario:
            return "USUARIO_NO_EXISTE"

        rol = RolRepository.obtener_por_id(db, id_rol)

        if not rol:
            return "ROL_NO_EXISTE"

        relacion = UsuarioRolRepository.obtener(db, id_usuario, id_rol)

        if relacion:
            return "YA_EXISTE"

        nueva_relacion = UsuarioRol(idUsuario=id_usuario, idRol=id_rol)

        return UsuarioRolRepository.crear(db, nueva_relacion)

    @staticmethod
    def remover(db, id_usuario, id_rol):
        """T-13: si es el rol Administrador y a este usuario quitárselo
        dejaría el sistema sin ningún Administrador, se bloquea -- si no,
        nadie podría volver a gestionar roles."""
        relacion = UsuarioRolRepository.obtener(db, id_usuario, id_rol)

        if not relacion:
            return False

        rol = RolRepository.obtener_por_id(db, id_rol)
        if rol and rol.nombre == NOMBRE_ROL_ADMINISTRADOR:
            total_admins = UsuarioRolRepository.contar_usuarios_con_rol(db, id_rol)
            if total_admins <= 1:
                return "ULTIMO_ADMINISTRADOR"

        UsuarioRolRepository.eliminar(db, relacion)
        return True

    @staticmethod
    def obtener_roles_usuario(db, id_usuario):
        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)

        if not usuario:
            return None

        return usuario.roles
