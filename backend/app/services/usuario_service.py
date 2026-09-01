import random
import string
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
    def generar_codigo_instructor(db, id_usuario: UUID):
        usuario = UsuarioRepository.obtener_por_id(db, id_usuario)

        if not usuario:
            return None

        if usuario.codigoInstructor:
            return {
                "idUsuario": usuario.idUsuario,
                "codigo": usuario.codigoInstructor,
            }

        caracteres = string.ascii_uppercase + string.digits
        codigo = "INS-" + "".join(random.choice(caracteres) for _ in range(6))

        intento = 0
        while intento < 20 and UsuarioRepository.obtener_por_codigo_instructor(db, codigo):
            codigo = "INS-" + "".join(random.choice(caracteres) for _ in range(6))
            intento += 1

        usuario.codigoInstructor = codigo
        UsuarioRepository.actualizar(db, usuario)

        return {
            "idUsuario": usuario.idUsuario,
            "codigo": codigo,
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
