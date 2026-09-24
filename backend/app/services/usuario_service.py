import random
import string
from uuid import UUID

from app.models.especialidad import Especialidad
from app.repositories.trimestre_repository import TrimestreRepository
from app.repositories.usuario_repository import UsuarioRepository


class UsuarioService:
    @staticmethod
    def listar_usuarios(db):
        return UsuarioRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db, id_usuario: UUID):
        return UsuarioRepository.obtener_por_id(db, id_usuario)

    @staticmethod
    def obtener_por_numero_documento(db, numero: str):
        return UsuarioRepository.obtener_por_numero_documento(db, numero)

    @staticmethod
    def generar_codigo_instructor(db, id_usuario: UUID):
        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)

        if not usuario:
            return None

        if usuario.codigoInstructor:
            return {
                "idUsuario": usuario.idUsuario,
                "codigo": usuario.codigoInstructor,
                "idTrimestre": usuario.idTrimestre,
            }

        caracteres = string.ascii_uppercase + string.digits
        codigo = "INS-" + "".join(random.choice(caracteres) for _ in range(6))

        intento = 0
        while intento < 20 and UsuarioRepository.obtener_por_codigo_instructor(db, codigo):
            codigo = "INS-" + "".join(random.choice(caracteres) for _ in range(6))
            intento += 1

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
    def validar_codigo_instructor(db, codigo: str):
        codigo_normalizado = (codigo or "").strip().upper()

        if not codigo_normalizado:
            return {"valido": False, "codigo": None, "idUsuario": None}

        usuario = UsuarioRepository.obtener_por_codigo_instructor(db, codigo_normalizado)

        if not usuario:
            return {"valido": False, "codigo": codigo_normalizado, "idUsuario": None}

        return {
            "valido": True,
            "codigo": codigo_normalizado,
            "idUsuario": usuario.idUsuario,
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

        usuario.especialidades = (
            db.query(Especialidad).filter(Especialidad.idEspecialidad.in_(ids_especialidades)).all()
            if ids_especialidades
            else []
        )
        return UsuarioRepository.actualizar(db, usuario)
