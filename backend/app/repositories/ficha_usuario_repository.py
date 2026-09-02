from uuid import UUID

from sqlalchemy.orm import Session

from app.models.ficha_usuario import FichaUsuario


class FichaUsuarioRepository:
    @staticmethod
    def obtener_por_usuario(db: Session, id_usuario: UUID):
        return (
            db.query(FichaUsuario)
            .filter(FichaUsuario.idUsuario == id_usuario)
            .first()
        )

    @staticmethod
    def crear(db: Session, ficha_usuario: FichaUsuario):
        db.add(ficha_usuario)
        db.commit()
        db.refresh(ficha_usuario)
        return ficha_usuario
