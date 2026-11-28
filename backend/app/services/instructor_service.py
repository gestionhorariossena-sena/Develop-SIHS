from uuid import UUID

from app.models.especialidad import Especialidad
from app.repositories.usuario_repository import UsuarioRepository

ROL_INSTRUCTOR = "Instructor"


class NoEsInstructorError(Exception):
    """La operación solo tiene sentido para alguien con rol Instructor
    (como administrar sus especialidades)."""


def es_instructor(usuario) -> bool:
    return any(rol.nombre == ROL_INSTRUCTOR for rol in usuario.roles)


class InstructorService:
    """Un instructor no tiene tabla propia: es un Usuario con rol
    Instructor (ver ESTRUCTURA.md). Este servicio junta lo que solo aplica
    a ese rol, que antes estaba repartido en UsuarioService y en filtros
    hechos a mano en cada pantalla del frontend."""

    @staticmethod
    def listar(db, *, busqueda: str | None = None, id_especialidad: int | None = None):
        instructores = UsuarioRepository.obtener_por_rol(db, ROL_INSTRUCTOR)

        termino = (busqueda or "").strip().lower()
        if termino:
            instructores = [
                instructor
                for instructor in instructores
                if termino in instructor.nombre.lower()
                or termino in (instructor.email or "").lower()
                or termino in (instructor.sigla or "").lower()
            ]

        if id_especialidad is not None:
            instructores = [
                instructor
                for instructor in instructores
                if any(e.idEspecialidad == id_especialidad for e in instructor.especialidades)
            ]

        return sorted(instructores, key=lambda instructor: instructor.nombre.lower())

    @staticmethod
    def reemplazar_especialidades(db, id_usuario: UUID, ids_especialidades: list[int]):
        """Fortalezas del instructor (qué sabe dictar). Junto con el mapeo
        competencia -> especialidades es lo que permite avisar cuando se
        le asigna un resultado de aprendizaje que no es de su área — ver
        HorarioService._validar_fortaleza_instructor.

        Devuelve el usuario actualizado, o None si no existe."""
        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)

        if not usuario:
            return None

        if not es_instructor(usuario):
            raise NoEsInstructorError()

        usuario.especialidades = (
            db.query(Especialidad).filter(Especialidad.idEspecialidad.in_(ids_especialidades)).all()
            if ids_especialidades
            else []
        )
        return UsuarioRepository.actualizar(db, usuario)
