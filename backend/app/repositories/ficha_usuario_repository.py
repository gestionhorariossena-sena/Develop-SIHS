from uuid import UUID

from sqlalchemy.orm import Session

from app.models.ficha_usuario import FichaUsuario
from app.models.usuario import Usuario


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

    @staticmethod
    def obtener_voceros_por_ficha(db: Session, id_ficha: int):
        """Filas con rolEnFicha en ('vocero', 'subvocero') para una ficha —
        junto con el Usuario para exponer nombre/email."""
        return (
            db.query(FichaUsuario, Usuario)
            .join(Usuario, Usuario.idUsuario == FichaUsuario.idUsuario)
            .filter(FichaUsuario.idFicha == id_ficha, FichaUsuario.rolEnFicha.isnot(None))
            .all()
        )
