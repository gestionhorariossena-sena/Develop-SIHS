import secrets
import string
from uuid import UUID

from app.models.especialidad import Especialidad
from app.repositories.trimestre_repository import TrimestreRepository
from app.repositories.usuario_repository import UsuarioRepository

ROL_INSTRUCTOR = "Instructor"

PREFIJO_CODIGO = "INS-"
_ALFABETO_CODIGO = string.ascii_uppercase + string.digits
_LONGITUD_CODIGO = 6
_INTENTOS_CODIGO = 20


class NoEsInstructorError(Exception):
    """La operación solo tiene sentido para alguien con rol Instructor
    (código de registro, fortalezas). Antes se aceptaba cualquier usuario
    y se podía, por ejemplo, emitir un código de instructor a un aprendiz."""


class CodigoNoDisponibleError(Exception):
    """No se encontró un código libre tras varios intentos. Con 36^6
    combinaciones es prácticamente imposible, pero antes el bucle se
    rendía en silencio y guardaba el código repetido igual."""


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
                or termino in (instructor.codigoInstructor or "").lower()
            ]

        if id_especialidad is not None:
            instructores = [
                instructor
                for instructor in instructores
                if any(e.idEspecialidad == id_especialidad for e in instructor.especialidades)
            ]

        return sorted(instructores, key=lambda instructor: instructor.nombre.lower())

    @staticmethod
    def _nuevo_codigo() -> str:
        return PREFIJO_CODIGO + "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(_LONGITUD_CODIGO))

    @staticmethod
    def generar_codigo(db, id_usuario: UUID):
        """Idempotente: el código queda fijo una vez emitido. Devuelve None
        si el usuario no existe."""
        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)

        if not usuario:
            return None

        if not es_instructor(usuario):
            raise NoEsInstructorError()

        if usuario.codigoInstructor:
            return {
                "idUsuario": usuario.idUsuario,
                "codigo": usuario.codigoInstructor,
                "idTrimestre": usuario.idTrimestre,
            }

        for _ in range(_INTENTOS_CODIGO):
            codigo = InstructorService._nuevo_codigo()
            if not UsuarioRepository.obtener_por_codigo_instructor(db, codigo):
                break
        else:
            raise CodigoNoDisponibleError()

        trimestre_activo = TrimestreRepository.obtener_activo(db)

        usuario.codigoInstructor = codigo
        usuario.idTrimestre = trimestre_activo.idTrimestre if trimestre_activo else None
        UsuarioRepository.actualizar(db, usuario)

        return {
            "idUsuario": usuario.idUsuario,
            "codigo": codigo,
            "idTrimestre": usuario.idTrimestre,
        }

    @staticmethod
    def validar_codigo(db, codigo: str) -> dict:
        """Lo usa el registro público, antes de que exista sesión. Por eso
        solo dice si el código es válido: no devuelve a quién pertenece
        (antes exponía el idUsuario del instructor a cualquiera)."""
        codigo_normalizado = (codigo or "").strip().upper()

        if not codigo_normalizado:
            return {"valido": False, "codigo": None}

        usuario = UsuarioRepository.obtener_por_codigo_instructor(db, codigo_normalizado)

        return {
            "valido": usuario is not None and es_instructor(usuario),
            "codigo": codigo_normalizado,
        }

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
