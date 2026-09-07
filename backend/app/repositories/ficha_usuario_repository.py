from uuid import UUID

from sqlalchemy.orm import Session

from app.models.ficha_usuario import FichaUsuario
from app.models.rol import Rol
from app.models.usuario_rol import UsuarioRol


class FichaUsuarioRepository:
    @staticmethod
    def obtener_por_usuario(db: Session, id_usuario: UUID):
        return (
            db.query(FichaUsuario)
            .filter(FichaUsuario.idUsuario == id_usuario)
            .first()
        )

    @staticmethod
    def obtener_aprendices_por_ficha(db: Session, id_ficha: int):
        return (
            db.query(FichaUsuario)
            .join(UsuarioRol, UsuarioRol.idUsuario == FichaUsuario.idUsuario)
            .join(Rol, Rol.idRol == UsuarioRol.idRol)
            .filter(FichaUsuario.idFicha == id_ficha, Rol.nombre == "Aprendiz")
            .all()
        )

    @staticmethod
    def crear(db: Session, ficha_usuario: FichaUsuario):
        db.add(ficha_usuario)
        db.commit()
        db.refresh(ficha_usuario)
        return ficha_usuario
