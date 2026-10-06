from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.rol import Rol
from app.repositories.rol_repository import RolRepository

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

        try:
            RolRepository.eliminar(db, rol)
        except IntegrityError:
            # Mismo criterio que AmbienteService/SedeService: FK sin
            # ondelete cascade -- hay usuarios con este rol asignado.
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se puede eliminar un rol que tiene usuarios asignados.",
            ) from None

        return True
