from fastapi import HTTPException, status

from app.models.rol import Rol
from app.repositories.rol_repository import RolRepository
from app.repositories.usuario_rol_repository import UsuarioRolRepository

NOMBRE_ROL_ADMINISTRADOR = "Administrador"


class RolService:
    @staticmethod
    def obtener_todos(db):
        return RolRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_rol):
        return RolRepository.obtener_por_id(db, id_rol)

    @staticmethod
    def crear(db, data):
        nuevo_rol = Rol(nombre=data.nombre)
        return RolRepository.crear(db, nuevo_rol)

    @staticmethod
    def actualizar(db, id_rol, data):
        """T-13: el nombre "Administrador" está hardcodeado en varios
        servicios (ver NOMBRE_ROL_ADMINISTRADOR) -- renombrarlo rompería
        esos chequeos silenciosamente, así que no se permite."""
        rol = RolRepository.obtener_por_id(db, id_rol)

        if not rol:
            return None

        if rol.nombre == NOMBRE_ROL_ADMINISTRADOR and data.nombre != NOMBRE_ROL_ADMINISTRADOR:
            return "ROL_PROTEGIDO"

        rol.nombre = data.nombre

        return RolRepository.actualizar(db, rol)

    @staticmethod
    def eliminar(db, id_rol):
        rol = RolRepository.obtener_por_id(db, id_rol)

        if not rol:
            return False

        if rol.nombre == NOMBRE_ROL_ADMINISTRADOR:
            return "ROL_PROTEGIDO"

        # T-10: en la BD real usuario_rol.idRol tiene ON DELETE CASCADE.
        # Esperar un IntegrityError no protege nada: Postgres podría borrar
        # automáticamente las asignaciones. Se valida explícitamente antes
        # del DELETE para que el rol y sus relaciones queden intactos.
        if UsuarioRolRepository.contar_usuarios_con_rol(db, id_rol) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se puede eliminar un rol que tiene usuarios asignados.",
            )

        RolRepository.eliminar(db, rol)
        return True
