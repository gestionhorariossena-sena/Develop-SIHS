from uuid import UUID

from sqlalchemy.orm import Session

from app.models.usuario_rol import UsuarioRol


class UsuarioRolRepository:
    @staticmethod
    def obtener(db: Session, id_usuario: UUID, id_rol: int):
        return (
            db.query(UsuarioRol)
            .filter(UsuarioRol.idUsuario == id_usuario, UsuarioRol.idRol == id_rol)
            .first()
        )

    @staticmethod
    def crear(db: Session, relacion: UsuarioRol):
        db.add(relacion)
        db.commit()
        db.refresh(relacion)
        return relacion

    @staticmethod
    def eliminar(db: Session, relacion: UsuarioRol):
        db.delete(relacion)
        db.commit()

    @staticmethod
    def contar_usuarios_con_rol(db: Session, id_rol: int) -> int:
        return db.query(UsuarioRol).filter(UsuarioRol.idRol == id_rol).count()
