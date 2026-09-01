from sqlalchemy.orm import Session

from app.models.ficha import Ficha


class FichaRepository:
    @staticmethod
    def obtener_todos(db: Session):
        return db.query(Ficha).all()

    @staticmethod
    def obtener_por_id(db: Session, id_ficha: int):
        return db.query(Ficha).filter(Ficha.idFicha == id_ficha).first()

    @staticmethod
    def obtener_por_codigo(db: Session, codigo_ficha: str):
        return db.query(Ficha).filter(Ficha.codigoFicha == codigo_ficha).first()

    @staticmethod
    def crear(db: Session, ficha: Ficha):
        db.add(ficha)
        db.commit()
        db.refresh(ficha)
        return ficha

    @staticmethod
    def actualizar(db: Session, ficha: Ficha):
        db.commit()
        db.refresh(ficha)
        return ficha

    @staticmethod
    def eliminar(db: Session, ficha: Ficha):
        db.delete(ficha)
        db.commit()
